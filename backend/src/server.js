import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app); //Ab humare paas ek HTTP server hai jisme Express ki functionality available hai.

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(cors({ origin: CLIENT_URL })); //Matlab humne backend ko bataya ki kaunsa frontend origin allowed hai.
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: "Realtime chat server is running" });
});
//Hum Socket.IO ka server create kar rahe hain aur existing HTTP server ko pass kar rahe hain.
//Yaani Express aur Socket.IO dono same HTTP server par run karenge.
const io = new Server(httpServer, { 
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"]
  }
});

// Jab bhi koi frontend client backend ke saath Socket.IO connection establish karega, ye callback execute hoga.
io.on("connection", (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on("joinRoom", ({ username, roomId }, callback) => {
    const cleanName = String(username || "").trim().slice(0, 24); //Agar username available hai toh usko string mein convert karo. Agar username undefined ya null hai toh empty string use karo Username ke maximum 24 characters rakhega.
    const cleanRoom = String(roomId || "").trim().slice(0, 32); // Room ID ke maximum 32 characters rakhega.

    if (!cleanName || !cleanRoom) {//check Username ya room ID empty toh nahi? Agar dono mein se koi bhi empty hai toh error response bhej do.
      callback?.({ ok: false, error: "Username and room ID are required." }); //Ye optional chaining ke saath function call hai. Agar callback nahi diya gaya toh error nahi aayega.
      return; //Current callback execution yahin stop ho jayega. Matlab invalid username ke saath user room join nahi kar payega.
    }

    // If this socket changes rooms, leave the previous room first.
    // Previous room check karna
    const previousRoom = socket.data.roomId;
    const previousName = socket.data.username;
 //Abhi hum previous room check kar rahe hain, taaki agar same socket/client kisi doosre room mein jaana chahe toh use purane room se remove kar saken.
    if (previousRoom) {
      socket.to(previousRoom).emit("roomNotice", { //Ye previous room ke baaki members ko notify karega ki Rakesh left the room.
        text: `${previousName} left the room`,
        time: new Date().toISOString()
      });
      socket.leave(previousRoom); //Ye current socket ko previous room se remove kar deta hai.
    }
  //if condition false h then aab hum Ab current socket ke andar username aur room ID save kar di.
    socket.data.username = cleanName; 
    socket.data.roomId = cleanRoom;
    socket.join(cleanRoom);

    socket.to(cleanRoom).emit("roomNotice", { //Ye current room ke baaki members ko notify karega ki Rakesh joined the room.
      text: `${cleanName} joined the room`,
      time: new Date().toISOString()
    });

    const roomSize = io.sockets.adapter.rooms.get(cleanRoom)?.size || 0; // ek room mein kitne log hai ye check karne ke liye humne Socket.IO ke adapter ka use kiya hai. Socket.IO server ke connected sockets ka access. adapter.rooms-> Socket.IO adapter rooms ka record maintain karta hai. .get(cleanRoom) -> Particular room ka set of connected sockets return karta hai. ?.size - Us room mein kitne sockets hain, ye count return karta hai.
    callback?.({ //Ab backend frontend ko response bhej raha hai.
      ok: true,
      username: cleanName,
      roomId: cleanRoom,
      onlineCount: roomSize
    }); //iska fayda: frontend ko pata chal jayega ki room successfully join hua ya nahi.

    // . Room information broadcast Let everyone in the room know the updated participant count.
    io.to(cleanRoom).emit("roomInfo", { onlineCount: roomSize }); //Yahan hum sabko online count bhej rahe hain. Frontend isko receive karke UI mein show karega: 3 online
    console.log(`${cleanName} joined ${cleanRoom}`); // rakesh joind general (general - room name)
  });

  socket.on("chatMessage", ({ text } = {}) => {
    //Humne username pehle hi joinRoom ke time socket.data mein save kiya tha.
//Isliye current socket ka username aur room ID retrieve kar rahe hain.
    const roomId = socket.data.roomId;
    const username = socket.data.username;
    const cleanText = String(text || "").trim().slice(0, 2000); // string conversion, trim, aur max 2000 characters limit. Agar text undefined ya null hai toh empty string use karo.

    if (!roomId || !username || !cleanText) return;

    io.to(roomId).emit("chatMessage", { //jo message bheja h vo baaki sab ko broadcast kar diya jaayega. Yaani jo user message bhej raha hai, usko bhi receive hoga.
      id: `${socket.id}-${Date.now()}`,
      username,
      text: cleanText,
      time: new Date().toISOString() //Message send hone ka timestamp.
    });
  });

  socket.on("typing", () => {
    const { roomId, username } = socket.data;
    if (!roomId || !username) return;

    socket.to(roomId).emit("typing", { username }); // Yahan sender ko chhodkar room ke baaki users ko notification milta hai. jab Sujoy type karega toh Rakesh aur John ko dikhega:
  });
 //Jab user type karna stop karega toh backend baaki users ko stopTyping event send karega.
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

      const roomSize = io.sockets.adapter.rooms.get(roomId)?.size || 0; //Remaining room members ka count retrieve karenge.
      io.to(roomId).emit("roomInfo", { onlineCount: roomSize }); //Sabhi remaining users ko updated online count bhej denge.
    }

    console.log(`Disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`HTTP + Socket.IO server listening on http://localhost:${PORT}`);
});
