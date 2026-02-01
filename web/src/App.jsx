import React, { useMemo, useState } from "react";

const DEFAULT_WS_URL = "ws://localhost:3000";

export default function App() {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [roomId, setRoomId] = useState("1");
  const [userId, setUserId] = useState("1");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("disconnected");
  const [events, setEvents] = useState([]);
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [authNote, setAuthNote] = useState("");

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

  const handleSignup = (event) => {
    event.preventDefault();
    if (!signupUsername.trim() || !signupPassword.trim()) {
      setAuthNote("نام کاربری و رمز عبور را کامل وارد کنید.");
      return;
    }
    if (signupPassword !== signupConfirm) {
      setAuthNote("رمز عبور و تکرار آن یکسان نیست.");
      return;
    }
    setAuthNote(`حساب ${signupUsername} ساخته شد. حالا وارد شوید.`);
    setSignupPassword("");
    setSignupConfirm("");
  };

  const handleLogin = (event) => {
    event.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setAuthNote("برای ورود نام کاربری و رمز عبور لازم است.");
      return;
    }
    setAuthNote(`خوش آمدید، ${loginUsername}!`);
    setLoginPassword("");
  };

  return (
    <div className="app">
      <header className="hero">
        <div>
          <h1>چت زنده Redis + Postgres</h1>
          <p>الهام‌گرفته از قالب Chatview</p>
        </div>
        <div className="status">
          <span>وضعیت اتصال</span>
          <strong>{status}</strong>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <section className="card auth-card">
            <h2>ایجاد حساب</h2>
            <form onSubmit={handleSignup} className="form-grid">
              <label>
                نام کاربری
                <input
                  value={signupUsername}
                  onChange={(event) => setSignupUsername(event.target.value)}
                  placeholder="مثلا ali" />
              </label>
              <label>
                رمز عبور
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  placeholder="رمز عبور" />
              </label>
              <label>
                تکرار رمز عبور
                <input
                  type="password"
                  value={signupConfirm}
                  onChange={(event) => setSignupConfirm(event.target.value)}
                  placeholder="تکرار رمز عبور" />
              </label>
              <button type="submit">ثبت نام</button>
            </form>
          </section>

          <section className="card auth-card">
            <h2>ورود</h2>
            <form onSubmit={handleLogin} className="form-grid">
              <label>
                نام کاربری
                <input
                  value={loginUsername}
                  onChange={(event) => setLoginUsername(event.target.value)}
                  placeholder="نام کاربری" />
              </label>
              <label>
                رمز عبور
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="رمز عبور" />
              </label>
              <button type="submit">ورود</button>
            </form>
            {authNote && <p className="auth-note">{authNote}</p>}
          </section>
        </aside>

        <main className="chat-shell">
          <section className="card">
            <h2>اتصال</h2>
            <div className="form-grid">
              <label>
                آدرس وب‌سوکت
                <input value={wsUrl} onChange={(e) => setWsUrl(e.target.value)} />
              </label>
              <label>
                اتاق
                <input value={roomId} onChange={(e) => setRoomId(e.target.value)} />
              </label>
              <label>
                شناسه کاربر
                <input value={userId} onChange={(e) => setUserId(e.target.value)} />
              </label>
            </div>
            <div className="actions">
              <button onClick={handleJoin}>وصل شو</button>
              <button className="ghost" onClick={() => socket.close()}>
                قطع اتصال
              </button>
            </div>
          </section>

          <section className="card">
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

          <section className="card events-card">
            <div className="events-header">
              <h2>رویدادها</h2>
              <span>آخرین پیام‌ها</span>
            </div>
            <div className="events">
              {events.length === 0 && <p>هنوز پیامی نرسیده است.</p>}
              {events.map((event, index) => (
                <pre key={`${event.type}-${index}`}>{JSON.stringify(event, null, 2)}</pre>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
