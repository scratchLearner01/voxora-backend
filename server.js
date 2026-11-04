
import { Server } from "socket.io";
import 'dotenv/config';
import {createServer} from "http";
import express from "express";


const app = express();

const server = createServer(app);

const PORT = process.env.PORT || 3001;

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:3000",
            "http://localhost:3002",
            "https://voxora-eta.vercel.app",
        ],
        methods: ["GET", "POST"],
    },
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Users waiting for a stranger
const waitingQueue = [];

// Stores active pairs: userA -> userB and userB -> userA
const partners = new Map();

// Stores pairs that have skipped each other
const skippedPairs = new Set();

// Generate a consistent key for a pair
function getPairKey(userA, userB) {
    return [userA, userB].sort().join(":");
}

const SKIP_COOLDOWN = 5000;


function rememberSkippedPair(userA, userB) {
    const pairKey = getPairKey(userA, userB);

    skippedPairs.add(pairKey);

    setTimeout(() => {
        skippedPairs.delete(pairKey);

        console.log("Skip cooldown expired:", pairKey);

        // Reconsider everyone currently waiting
        findMatches();

    }, SKIP_COOLDOWN);
}

// Remove a user from the waiting queue
function removeFromQueue(userId) {
    const index = waitingQueue.indexOf(userId);

    if (index !== -1) {
        waitingQueue.splice(index, 1);
    }
}

// Add a user to matchmaking
function addToQueue(userId) {
    // Prevent duplicate queue entries
    if (!io.sockets.sockets.has(userId)) return;
    if (partners.has(userId)) return;
    if (waitingQueue.includes(userId)) return;

    waitingQueue.push(userId);

    console.log("Waiting queue:", waitingQueue);

    findMatches();
}

// Find eligible pairs
function findMatches() {
    let i = 0;

    while (i < waitingQueue.length) {
        const userA = waitingQueue[i];
        let matched = false;

        for (let j = i + 1; j < waitingQueue.length; j++) {
            const userB = waitingQueue[j];

            // Remove disconnected users
            if (!io.sockets.sockets.has(userA)) {
                removeFromQueue(userA);
                matched = true;
                break;
            }

            if (!io.sockets.sockets.has(userB)) {
                removeFromQueue(userB);
                j--;
                continue;
            }

            // Don't immediately rematch users who skipped each other
            const pairKey = getPairKey(userA, userB);

            if (skippedPairs.has(pairKey)) {
                continue;
            }

            // Remove both users from the queue
            waitingQueue.splice(j, 1);
            waitingQueue.splice(i, 1);

            // Store their partnership
            partners.set(userA, userB);
            partners.set(userB, userA);

            // Notify both users
            io.to(userA).emit("matched", {
                partnerId: userB,
            });

            io.to(userB).emit("matched", {
                partnerId: userA,
            });

            console.log("Matched:", userA, "<->", userB);

            matched = true;
            break;
        }

        // If userA was not matched or removed, check the next user
        if (!matched) {
            i++;
        }
    }
}

// Disconnect a user's current partner
function disconnectPartner(userId, shouldRememberSkip = false) {
    const partnerId = partners.get(userId);

    if (!partnerId) return null;

    // Remove both sides of the relationship
    partners.delete(userId);
    partners.delete(partnerId);

    // Remember that these users skipped each other
    if (shouldRememberSkip) {
        rememberSkippedPair(userId, partnerId);
    }

    // Tell the other user their partner has left
    io.to(partnerId).emit("partner-left");

    return partnerId;
}

function removeSkippedPairs(userId) {
    for (const pairKey of skippedPairs) {
        if (pairKey.split(":").includes(userId)) {
            skippedPairs.delete(pairKey);
        }
    }
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // User searches for a stranger
    socket.on("find-stranger", () => {
        addToQueue(socket.id);
    });

    // Either user clicks Next
    socket.on("next", () => {
        console.log("Next requested by:", socket.id);

        // Remove user from queue if already waiting
        removeFromQueue(socket.id);

        // Disconnect the current pair
        const partnerId = disconnectPartner(socket.id, true);

        // Put both users back into matchmaking
        addToQueue(socket.id);

        if (partnerId && io.sockets.sockets.has(partnerId)) {
            addToQueue(partnerId);
        }
    });

    // WebRTC signaling
    socket.on("offer", ({ partnerId, offer }) => {
        if (partners.get(socket.id) !== partnerId) return;

        io.to(partnerId).emit("offer", {
            offer,
            senderId: socket.id,
        });
    });

    socket.on("answer", ({ partnerId, answer }) => {
        if (partners.get(socket.id) !== partnerId) return;

        io.to(partnerId).emit("answer", {
            answer,
            senderId: socket.id,
        });
    });

    socket.on("ice-candidate", ({ partnerId, candidate }) => {
        if (partners.get(socket.id) !== partnerId) return;

        io.to(partnerId).emit("ice-candidate", {
            candidate,
            senderId: socket.id,
        });
    });

    socket.on("chat-message", ({ message }) => {
        // Find the sender's current partner
        const partnerId = partners.get(socket.id);

        // Check whether the sender is currently matched
        if (!partnerId) return;

        // Validate the message
        if (typeof message !== "string") return;

        const trimmedMessage = message.trim();

        if (!trimmedMessage || trimmedMessage.length > 1000) return;

        // Forward the message to the partner
        io.to(partnerId).emit("chat-message", {
            message: trimmedMessage,
            senderId: socket.id,
            timestamp: Date.now(),
        });
    });

    socket.on("typing", () => {
        const partnerId = partners.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("partner-typing");
        }
    });

    socket.on("stop-typing", () => {
        const partnerId = partners.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("partner-stop-typing");
        }
    });

    socket.on("get-ice-servers", async (callback) => {
        try {
            const appName = process.env.METERED_APP_NAME;
            const apiKey = process.env.METERED_API_KEY;

            const response = await fetch(
                `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`
            );

            if (!response.ok) {
                throw new Error("Failed to fetch TURN credentials");
            }

            const iceServers = await response.json();

            callback({
                success: true,
                iceServers,
            });

        } catch (error) {
            console.error("TURN configuration error:", error);

            callback({
                success: false,
                message: "Unable to retrieve ICE servers",
            });
        }
    });

    // User closes the tab or loses connection
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        // Remove from waiting queue
        removeFromQueue(socket.id);

        // Disconnect and notify their partner
        const partnerId = disconnectPartner(socket.id);

        // Remove all skip history involving this user
        removeSkippedPairs(socket.id);

        // Return the remaining partner to matchmaking
        if (partnerId && io.sockets.sockets.has(partnerId)) {
            addToQueue(partnerId);
        }

        console.log("Cleanup completed:", socket.id);
    });
});

console.log("Socket.IO server running on port 3001");
