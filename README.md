# Realtime Group Chat (React + Socket.IO)

## Features
- Username and room ID join screen
- Realtime group messages scoped to a room
- Join/leave notifications
- Typing indicators
- Message timestamps
- Online participant count
- Reconnection support and responsive light UI

## Run locally

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173 in multiple browser tabs/windows. Use different names and the same room ID to chat together.

## Event contract
- `joinRoom` client -> server (acknowledgement callback)
- `roomNotice` server -> members in room
- `chatMessage` client -> server and server -> all room members
- `typing` client -> server -> other room members
- `stopTyping` client -> server -> other room members
- `roomInfo` server -> room members

## Notes
This starter keeps messages in memory/browser session only; it does not persist chat history to MongoDB. Add authentication, validation/rate limiting, persistent message storage, and production origin configuration before deployment.
