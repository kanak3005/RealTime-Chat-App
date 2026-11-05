import { io } from "socket.io-client";
// define backend url
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

// autoConnect:false lets the component attach listeners before connecting.
export const socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000
});
//autoConnect: false – import karte hi connection automatically start nahi hoga.
// reconnection: true – connection break hone par reconnect karne ki koshish karega.
// reconnectionAttempts: 10 – maximum 10 reconnection attempts.
// reconnectionDelay: 1000 – attempts ke beech initial delay 1000 milliseconds.