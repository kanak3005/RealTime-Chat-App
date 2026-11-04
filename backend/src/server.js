import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Realtime chat server is running" });
});

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"]
  }
});

// Each socket stores its current username and room in socket.data.
io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on("joinRoom", ({ username, roomId }, callback) => {
    const cleanName = String(username || "").trim().slice(0, 24);
    const cleanRoom = String(roomId || "").trim().slice(0, 32);

    if (!cleanName || !cleanRoom) {
      callback?.({ ok: false, error: "Username and room ID are required." });
      return;
    }

    // If this socket changes rooms, leave the previous room first.
    const previousRoom = socket.data.roomId;
    const previousName = socket.data.username;

    if (previousRoom) {
      socket.to(previousRoom).emit("roomNotice", {
        text: `${previousName} left the room`,
        time: new Date().toISOString()
      });
      socket.leave(previousRoom);
    }

    socket.data.username = cleanName;
    socket.data.roomId = cleanRoom;
    socket.join(cleanRoom);

    socket.to(cleanRoom).emit("roomNotice", {
      text: `${cleanName} joined the room`,
      time: new Date().toISOString()
    });

    const roomSize = io.sockets.adapter.rooms.get(cleanRoom)?.size || 0;

    callback?.({
      ok: true,
      username: cleanName,
      roomId: cleanRoom,
      onlineCount: roomSize
    });

    // Let everyone in the room know the updated participant count.
    io.to(cleanRoom).emit("roomInfo", { onlineCount: roomSize });
    console.log(`${cleanName} joined ${cleanRoom}`);
  });

  socket.on("chatMessage", ({ text } = {}) => {
    const roomId = socket.data.roomId;
    const username = socket.data.username;
    const cleanText = String(text || "").trim().slice(0, 2000);

    if (!roomId || !username || !cleanText) return;

    io.to(roomId).emit("chatMessage", {
      id: `${socket.id}-${Date.now()}`,
      username,
      text: cleanText,
      time: new Date().toISOString()
    });
  });

  socket.on("typing", () => {
    const { roomId, username } = socket.data;
    if (!roomId || !username) return;

    socket.to(roomId).emit("typing", { username });
  });

  socket.on("stopTyping", () => {
    const { roomId, username } = socket.data;
    if (!roomId || !username) return;

    socket.to(roomId).emit("stopTyping", { username });
  });

  socket.on("disconnect", () => {
    const { roomId, username } = socket.data;

    if (roomId && username) {
      socket.to(roomId).emit("roomNotice", {
        text: `${username} left the room`,
        time: new Date().toISOString()
      });

      const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0;
      io.to(roomId).emit("roomInfo", { onlineCount: roomSize });
    }

    console.log(`Disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`HTTP + Socket.IO server listening on http://localhost:${PORT}`);
});
