import React, { useMemo, useState } from "react";

const DEFAULT_WS_URL = "ws://localhost:3000";

export default function App() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [roomId, setRoomId] = useState("1");
  const [userId, setUserId] = useState("1");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("disconnected");
  const [events, setEvents] = useState([]);

  const socket = useMemo(() => {
    let connection;
    return {
      connect() {
        connection = new WebSocket(wsUrl);
        connection.onopen = () => setStatus("connected");
        connection.onclose = () => setStatus("disconnected");
        connection.onmessage = (event) => {
          setEvents((prev) => [JSON.parse(event.data), ...prev]);
        };
        connection.onerror = () => setStatus("error");
      },
      send(payload) {
        if (!connection || connection.readyState !== WebSocket.OPEN) return;
        connection.send(JSON.stringify(payload));
      },
      close() {
        if (connection) connection.close();
      },
    };
  }, [wsUrl]);

  const handleJoin = () => {
    socket.connect();
    socket.send({ type: "join", roomId: Number(roomId) });
  };

  const handleSend = () => {
    socket.send({
      type: "message",
      roomId: Number(roomId),
      userId: Number(userId),
      content: message.trim(),
    });
    setMessage("");
  };

  return (
    <div className="app">
      <header>
        <h1>چت زنده Redis + Postgres</h1>
        <p>وضعیت اتصال: {status}</p>
      </header>

      <section className="panel">
        <h2>اتصال</h2>
        <label>
          آدرس وب‌سوکت
          <input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} />
        </label>
        <label>
          اتاق
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        </label>
        <label>
          کاربر
          <input value={userId} onChange={(e) => setUserId(e.target.value)} />
        </label>
        <div className="actions">
          <button onClick={handleJoin}>وصل شو</button>
          <button onClick={() => socket.close()}>قطع اتصال</button>
        </div>
      </section>

      <section className="panel">
        <h2>ارسال پیام</h2>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="پیام خود را بنویسید"
        />
        <button onClick={handleSend} disabled={!message.trim()}>
          ارسال
        </button>
      </section>

      <section className="panel">
        <h2>رویدادها</h2>
        <div className="events">
          {events.length === 0 && <p>هنوز پیامی نرسیده است.</p>}
          {events.map((event, index) => (
            <pre key={`${event.type}-${index}`}>{JSON.stringify(event, null, 2)}</pre>
          ))}
        </div>
      </section>
    </div>
  );
}
