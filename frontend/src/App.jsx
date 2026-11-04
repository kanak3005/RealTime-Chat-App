import { useEffect, useRef, useState } from "react";
import {
  MessageCircle, Send, Users, Wifi, WifiOff, LogOut, Hash
} from "lucide-react";
import { socket } from "./socket";

function initials(name = "?") {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function App() {
  const [usernameInput, setUsernameInput] = useState("");
  const [roomInput, setRoomInput] = useState("general");
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);
  const [connected, setConnected] = useState(socket.connected);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [notices, setNotices] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setTypingUsers([]);
    };
    const onChatMessage = (data) => setMessages((old) => [...old, data]);
    const onRoomNotice = (data) => setNotices((old) => [...old, data]);
    const onTyping = ({ username: name }) => {
      setTypingUsers((old) => old.includes(name) ? old : [...old, name]);
    };
    const onStopTyping = ({ username: name }) => {
      setTypingUsers((old) => old.filter((item) => item !== name));
    };
    const onRoomInfo = ({ onlineCount: count }) => setOnlineCount(count);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("chatMessage", onChatMessage);
    socket.on("roomNotice", onRoomNotice);
    socket.on("typing", onTyping);
    socket.on("stopTyping", onStopTyping);
    socket.on("roomInfo", onRoomInfo);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("chatMessage", onChatMessage);
      socket.off("roomNotice", onRoomNotice);
      socket.off("typing", onTyping);
      socket.off("stopTyping", onStopTyping);
      socket.off("roomInfo", onRoomInfo);
      clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, notices, typingUsers]);

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
