const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { Pool } = require("pg");
const Redis = require("ioredis");
const bcrypt = require("bcryptjs");
const speakeasy = require("speakeasy");
require("dotenv").config();

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const dbPool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
});

const redisSubscriber = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
});

const connectionsByRoom = new Map();

function ensureRoomSet(roomId) {
  if (!connectionsByRoom.has(roomId)) {
    connectionsByRoom.set(roomId, new Set());
  }
  return connectionsByRoom.get(roomId);
}

function broadcastToRoom(roomId, payload) {
  const roomSet = connectionsByRoom.get(roomId);
  if (!roomSet) return;
  const message = JSON.stringify(payload);
  for (const socket of roomSet) {
    if (socket.readyState === socket.OPEN) {
      socket.send(message);
    }
  }
}

redisSubscriber.on("message", (channel, message) => {
  if (!channel.startsWith("room:")) return;
  const roomId = channel.replace("room:", "");
  try {
    const payload = JSON.parse(message);
    broadcastToRoom(roomId, payload);
  } catch (error) {
    console.error("Failed to parse redis message", error);
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function findUserByIdentifier(identifier) {
  const normalized = identifier?.trim().toLowerCase();
  if (!normalized) return null;
  const result = await dbPool.query(
    "SELECT * FROM users WHERE email = $1 OR phone = $1 LIMIT 1",
    [normalized]
  );
  return result.rows[0] || null;
}

function normalizeIdentifier(identifier) {
  return identifier?.trim().toLowerCase();
}

function isEmail(value) {
  return /\S+@\S+\.\S+/.test(value);
}

function isPhone(value) {
  return /^\+?\d{8,15}$/.test(value);
}

app.post("/auth/register", async (req, res) => {
  const { identifier, password } = req.body;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized || !password) {
    res.status(400).json({ error: "identifier and password are required" });
    return;
  }
  if (!isEmail(normalized) && !isPhone(normalized)) {
    res.status(400).json({ error: "identifier must be email or phone" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const email = isEmail(normalized) ? normalized : null;
  const phone = isPhone(normalized) ? normalized : null;

  try {
    const result = await dbPool.query(
      "INSERT INTO users (email, phone, password_hash) VALUES ($1, $2, $3) RETURNING id, email, phone, created_at",
      [email, phone, passwordHash]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    console.error("Failed to register user", error);
    res.status(500).json({ error: "Failed to register user" });
  }
});

app.post("/auth/login", async (req, res) => {
  const { identifier, password } = req.body;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized || !password) {
    res.status(400).json({ error: "identifier and password are required" });
    return;
  }

  const user = await findUserByIdentifier(normalized);
  if (!user || !user.password_hash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  res.json({ user: { id: user.id, email: user.email, phone: user.phone } });
});

app.post("/auth/request-otp", async (req, res) => {
  const { identifier } = req.body;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) {
    res.status(400).json({ error: "identifier is required" });
    return;
  }
  const user = await findUserByIdentifier(normalized);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const rawCode = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await bcrypt.hash(rawCode, 8);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await dbPool.query(
    "INSERT INTO otp_codes (user_id, code_hash, expires_at) VALUES ($1, $2, $3)",
    [user.id, codeHash, expiresAt]
  );

  res.json({
    message: "OTP generated",
    expiresAt,
    developmentCode: rawCode,
  });
});

app.post("/auth/verify-otp", async (req, res) => {
  const { identifier, code } = req.body;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized || !code) {
    res.status(400).json({ error: "identifier and code are required" });
    return;
  }

  const user = await findUserByIdentifier(normalized);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const result = await dbPool.query(
    "SELECT * FROM otp_codes WHERE user_id = $1 AND consumed_at IS NULL AND expires_at > now() ORDER BY created_at DESC LIMIT 1",
    [user.id]
  );
  const otp = result.rows[0];
  if (!otp) {
    res.status(401).json({ error: "OTP expired or not found" });
    return;
  }
  const isValid = await bcrypt.compare(String(code), otp.code_hash);
  if (!isValid) {
    res.status(401).json({ error: "Invalid OTP" });
    return;
  }

  await dbPool.query("UPDATE otp_codes SET consumed_at = now() WHERE id = $1", [
    otp.id,
  ]);

  res.json({ user: { id: user.id, email: user.email, phone: user.phone } });
});

app.post("/auth/setup-2fa", async (req, res) => {
  const { identifier } = req.body;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) {
    res.status(400).json({ error: "identifier is required" });
    return;
  }
  const user = await findUserByIdentifier(normalized);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const secret = speakeasy.generateSecret({
    name: "Redis Baraka Chat",
  });
  await dbPool.query("UPDATE users SET two_factor_secret = $1 WHERE id = $2", [
    secret.base32,
    user.id,
  ]);
  res.json({ otpauthUrl: secret.otpauth_url, secret: secret.base32 });
});

app.post("/auth/verify-2fa", async (req, res) => {
  const { identifier, token } = req.body;
  const normalized = normalizeIdentifier(identifier);
  if (!normalized || !token) {
    res.status(400).json({ error: "identifier and token are required" });
    return;
  }
  const user = await findUserByIdentifier(normalized);
  if (!user || !user.two_factor_secret) {
    res.status(404).json({ error: "2FA not configured" });
    return;
  }

  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: "base32",
    token: String(token),
    window: 1,
  });
  if (!verified) {
    res.status(401).json({ error: "Invalid 2FA token" });
    return;
  }

  res.json({ user: { id: user.id, email: user.email, phone: user.phone } });
});

wss.on("connection", (socket) => {
  let currentRoomId = null;

  socket.on("message", async (data) => {
    let payload;
    try {
      payload = JSON.parse(data.toString());
    } catch (error) {
      socket.send(
        JSON.stringify({ type: "error", message: "Invalid JSON payload" })
      );
      return;
    }

    if (payload.type === "join") {
      if (!payload.roomId) {
        socket.send(
          JSON.stringify({ type: "error", message: "roomId is required" })
        );
        return;
      }
      if (currentRoomId) {
        connectionsByRoom.get(currentRoomId)?.delete(socket);
      }
      currentRoomId = String(payload.roomId);
      ensureRoomSet(currentRoomId).add(socket);
      await redisSubscriber.subscribe(`room:${currentRoomId}`);
      socket.send(JSON.stringify({ type: "joined", roomId: currentRoomId }));
      return;
    }

    if (payload.type === "message") {
      const { roomId, userId, content } = payload;
      if (!roomId || !userId || !content) {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "roomId, userId, and content are required",
          })
        );
        return;
      }

      const messageRecord = {
        roomId: Number(roomId),
        userId: Number(userId),
        content: String(content),
      };

      try {
        const result = await dbPool.query(
          "INSERT INTO messages (room_id, user_id, content) VALUES ($1, $2, $3) RETURNING id, created_at",
          [messageRecord.roomId, messageRecord.userId, messageRecord.content]
        );
        const saved = result.rows[0];
        const eventPayload = {
          type: "message",
          id: saved.id,
          roomId: messageRecord.roomId,
          userId: messageRecord.userId,
          content: messageRecord.content,
          createdAt: saved.created_at,
        };
        await redis.publish(`room:${roomId}`, JSON.stringify(eventPayload));
      } catch (error) {
        console.error("Failed to save message", error);
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Failed to save message",
          })
        );
      }
      return;
    }

    socket.send(
      JSON.stringify({ type: "error", message: "Unknown event type" })
    );
  });

  socket.on("close", () => {
    if (currentRoomId) {
      connectionsByRoom.get(currentRoomId)?.delete(socket);
    }
  });
});

const port = Number(process.env.PORT || 3000);

server.listen(port, () => {
  console.log(`Chat server listening on ${port}`);
});
