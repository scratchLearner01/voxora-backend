# Voxora Backend

**The real-time engine behind Voxora.**

Voxora Backend powers the real-time communication infrastructure of Voxora, an anonymous video and text chat platform that connects users through random matchmaking.

Built with Node.js and Socket.IO, it manages user connections, matchmaking, WebRTC signalling, and real-time messaging. It also integrates Metered TURN to help establish peer-to-peer connections across different networks.

## Features

- **Random Matchmaking:** Pairs users with available strangers.
- **WebRTC Signalling:** Exchanges connection information required to establish peer-to-peer audio and video calls.
- **Real-Time Messaging:** Handles instant text messages between connected users.
- **Typing Indicators:** Relays typing events between participants.
- **Skip & Rematch:** Handles users leaving conversations and finding new matches.
- **Connection Management:** Handles socket connections and disconnections.
- **ICE Server Configuration:** Retrieves TURN credentials dynamically through the Metered API.
- **STUN/TURN Support:** Helps establish WebRTC connections across different network environments.

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Socket.IO | Real-time communication |
| WebRTC | Peer-to-peer audio/video |
| Metered | TURN credential integration |
| dotenv | Environment variable management |
| JavaScript | Backend development |

## Architecture

Voxora uses a separate frontend and backend architecture.

1. The frontend connects to the backend through Socket.IO.
2. The backend manages matchmaking and pairs available users.
3. Socket.IO exchanges WebRTC signalling information between participants.
4. WebRTC establishes the peer-to-peer audio/video connection.
5. Socket.IO continues handling chat messages and other real-time events.
6. Metered provides TURN credentials to assist connectivity when direct peer-to-peer communication is unavailable.

**Important:** Socket.IO handles signalling and application events; the actual audio/video media is transmitted through WebRTC.

## Environment Variables

Create a `.env` file in the backend root directory:

```env
METERED_APP_NAME=your_metered_app_name
METERED_API_KEY=your_metered_api_key
```

Never commit your `.env` file or expose your API key publicly.

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/scratchLearner01/voxora-backend.git
```

### 2. Navigate into the project

```bash
cd voxora-backend
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create the `.env` file and add your Metered credentials.

### 5. Start the backend

Use the appropriate start command configured in your `package.json`.

For example:

```bash
npm start
```

The backend currently runs locally on port `3001`.

## Project Structure

The project is organized around the backend server, Socket.IO event handling, matchmaking, and TURN configuration.

Refer to the source files for the current implementation.

## Future Improvements

- Improved matchmaking and reconnection handling.
- Better error handling and connection recovery.
- Rate limiting and abuse prevention.
- Scalable matchmaking infrastructure.
- Deployment and monitoring improvements.

---

**Voxora — Connecting people, one conversation at a time.**
