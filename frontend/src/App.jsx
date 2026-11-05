import { useEffect, useRef, useState } from "react";
import {
  MessageCircle, Send, Users, Wifi, WifiOff, LogOut, Hash
} from "lucide-react";
import { socket } from "./socket";

function initials(name = "?") {//Ye function username ka first character return karta hai. UI mein user avatar ke andar first letter show karne ke liye use hota hai.
  return name.trim().charAt(0).toUpperCase() || "?";
}
//Backend message ke saath time send karta hai:
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { //Is timestamp ko JavaScript Date object mein convert karta hai. Readable local time banata hai.
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function App() {

// usernameInput	Join form mein typed username
// username	Successfully joined user ka username
// roomInput	Form mein entered room ID
// roomId	Successfully joined room ID
  const [usernameInput, setUsernameInput] = useState("");//Ye login/join screen par username input ko control karta hai. user types - Rakesh, usernameInput = "Rakesh";
  const [roomInput, setRoomInput] = useState("general");//Room ID ka input store hota hai.
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false); //Ye batata hai ki user chat room mein join hua hai ya nahi. intially false h join successful hone ke baad - true
  const [connected, setConnected] = useState(socket.connected);//Ye Socket.IO connection status store karta hai. 
  const [message, setMessage] = useState(""); //User jo message input mein type kar raha hai, wo is state mein store hoga.
  const [messages, setMessages] = useState([]); //Ye received messages store karta hai.
  const [notices, setNotices] = useState([]); //Ye join/leave notifications store karta hai.
  const [typingUsers, setTypingUsers] = useState([]); //Ye un users ke usernames store karta hai jo currently typing kar rahe hain.
  const [onlineCount, setOnlineCount] = useState(0); //Current room mein kitne users connected hain, wo store karta hai.
  const bottomRef = useRef(null); //Jab new message aata hai, hum automatically bottom par scroll karenge.
  const typingTimeoutRef = useRef(null); //Typing indicator ko automatically stop karne ke liye timer ID store karta hai.
  const isTypingRef = useRef(false); //Track karta hai ki current user typing state mein hai ya nahi.
  //Because useRef ki value change karne se React component re-render nahi hota.
//Humein yahan har change par UI re-render karne ki zaroorat nahi hai
  useEffect(() => { //useEffect component render hone ke baad execute hota hai.
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setTypingUsers([]);
    };
    const onChatMessage = (data) => setMessages((old) => [...old, data]); //Matlab purane messages preserve rahenge aur new message end mein add hoga.
    const onRoomNotice = (data) => setNotices((old) => [...old, data]);
    const onTyping = ({ username: name }) => {
      setTypingUsers((old) => old.includes(name) ? old : [...old, name]);
    };
    const onStopTyping = ({ username: name }) => {
      setTypingUsers((old) => old.filter((item) => item !== name)); // sujoy ne typinf stop krdi - Matlab Sujoy typing list se remove ho gaya.
    };
    const onRoomInfo = ({ onlineCount: count }) => setOnlineCount(count);
    //Abhi tak humne functions define kiye the.
//Ab inhe actual Socket.IO events ke saath connect karenge.
  //Jab bhi backend "chatMessage" event bhejega, onChatMessage function execute hoga. 
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chatMessage", onChatMessage);
    socket.on("roomNotice", onRoomNotice);
    socket.on("typing", onTyping);
    socket.on("stopTyping", onStopTyping);
    socket.on("roomInfo", onRoomInfo);

    return () => {
      //socket.off() - Listener remove karta hai.
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chatMessage", onChatMessage);
      socket.off("roomNotice", onRoomNotice);
      socket.off("typing", onTyping);
      socket.off("stopTyping", onStopTyping);
      socket.off("roomInfo", onRoomInfo);
      clearTimeout(typingTimeoutRef.current);
      socket.disconnect(); //Socket.IO connection close kar deta hai.
    };
  }, []);

//Auto scroll functionality - Chat automatically bottom par scroll ho gayi.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, notices, typingUsers]); //Jab bhi messages, notices, ya typingUsers change hoga, ye effect execute hoga aur chat bottom par scroll ho jayegi.

  //Frontend se backend ko connect karna
  const joinRoom = (event) => {
    event.preventDefault();
    const cleanName = usernameInput.trim();
    const cleanRoom = roomInput.trim();
    if (!cleanName || !cleanRoom) return;

    if (!socket.connected) socket.connect();

    const enter = () => {
      socket.emit("joinRoom", {
        username: cleanName,
        roomId: cleanRoom
      }, (response) => {
        if (!response?.ok) {
          alert(response?.error || "Could not join room.");
          return;
        }
        setUsername(response.username);
        setRoomId(response.roomId);
        setJoined(true);
        setMessages([]);
        setNotices([]);
        setOnlineCount(response.onlineCount);
      });
    };

    if (socket.connected) enter();
    else socket.once("connect", enter);
  };

  const sendMessage = (event) => {
    event?.preventDefault();
    const cleanText = message.trim();
    if (!cleanText || !joined || !socket.connected) return;

    socket.emit("chatMessage", { text: cleanText });
    setMessage("");
    stopTyping();
  };

  const stopTyping = () => {
    if (isTypingRef.current) {
      socket.emit("stopTyping");
      isTypingRef.current = false;
    }
    clearTimeout(typingTimeoutRef.current);
  };

  const handleMessageChange = (value) => {
    setMessage(value);
    if (!joined || !socket.connected) return;

    if (value.trim() && !isTypingRef.current) {
      socket.emit("typing");
      isTypingRef.current = true;
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 900);

    if (!value.trim()) stopTyping();
  };

  const leaveRoom = () => {
    stopTyping();
    socket.disconnect();
    setJoined(false);
    setUsername("");
    setRoomId("");
    setMessages([]);
    setNotices([]);
    setTypingUsers([]);
    setOnlineCount(0);
  };

  if (!joined) {
    return (
      <main className="entry-page">
        <form className="entry-card" onSubmit={joinRoom}>
          <div className="brand-mark"><MessageCircle size={25} /></div>
          <p className="eyebrow">REALTIME MESSAGING</p>
          <h1>Join the conversation</h1>
          <p className="entry-copy">Choose a name and room to start chatting with your group.</p>

          <label htmlFor="username">Your name</label>
          <input
            id="username"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="e.g. Rakesh"
            maxLength={24}
            required
          />

          <label htmlFor="room">Room ID</label>
          <input
            id="room"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="e.g. general"
            maxLength={32}
            required
          />

          <button className="join-button" type="submit">
            Join chat <span>→</span>
          </button>
          <p className="entry-footnote">Anyone using the same room ID can join this chat.</p>
        </form>
      </main>
    );
  }

  return (
    <main className="chat-page">
      <section className="chat-shell">
        <header className="chat-header">
          <div className="brand-mark small"><MessageCircle size={19} /></div>
          <div className="header-title">
            <h1>Realtime group chat</h1>
            <p>
              {typingUsers.length > 0
                ? `${typingUsers.join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing...`
                : `Welcome, ${username}`}
            </p>
          </div>
          <div className="header-right">
            <span className={`connection ${connected ? "online" : "offline"}`}>
              {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
              {connected ? "Connected" : "Reconnecting"}
            </span>
            <span className="signed-in">Signed in as <b>{username}</b></span>
            <button className="leave-button" onClick={leaveRoom} title="Leave room">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="room-strip">
          <span><Hash size={14} /> {roomId}</span>
          <span><Users size={14} /> {onlineCount} online</span>
        </div>

        <section className="messages-area">
          {messages.length === 0 && notices.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon"><MessageCircle size={23} /></div>
              <h2>Your conversation starts here</h2>
              <p>Send a message to everyone in #{roomId}.</p>
            </div>
          )}

          {notices.map((notice, index) => (
            <div className="notice" key={`notice-${index}`}>
              <span>{notice.text}</span>
              <time>{formatTime(notice.time)}</time>
            </div>
          ))}

          {messages.map((item) => {
            const own = item.username === username;
            return (
              <article className={`message-row ${own ? "own" : "other"}`} key={item.id}>
                {!own && <div className="avatar">{initials(item.username)}</div>}
                <div className="message-content">
                  {!own && <span className="message-sender">{item.username}</span>}
                  <div className="bubble">{item.text}</div>
                  <div className="message-meta">
                    <time>{formatTime(item.time)}</time>
                    {own && <span className="you-label">You</span>}
                  </div>
                </div>
                {own && <div className="avatar own-avatar">{initials(username)}</div>}
              </article>
            );
          })}

          {typingUsers.length > 0 && (
            <div className="typing-line">
              <span className="typing-dots"><i></i><i></i><i></i></span>
              {typingUsers.join(", ")} typing
            </div>
          )}
          <div ref={bottomRef} />
        </section>

        <form className="composer" onSubmit={sendMessage}>
          <input
            value={message}
            onChange={(e) => handleMessageChange(e.target.value)}
            onBlur={stopTyping}
            placeholder="Type a message..."
            maxLength={2000}
            aria-label="Type a message"
          />
          <button type="submit" disabled={!message.trim() || !connected}>
            Send <Send size={15} />
          </button>
        </form>
      </section>
    </main>
  );
}
