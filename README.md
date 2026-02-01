# Redis + Postgres Live Chat

This project provides a minimal live chat backend using WebSockets, Postgres for durable storage, and Redis Pub/Sub for real-time fan-out across multiple app instances. It also includes a fast web client (React + Vite) and a mobile client (Expo + React Native) for quick testing.

## Requirements

- Node.js 18+
- Postgres 14+
- Redis 7+

## Quick start

1. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
2. Start Postgres + Redis (optional):
   ```bash
   docker compose up -d
   ```
3. Install dependencies and run the backend:
   ```bash
   npm install
   npm run start
   ```

## Database schema

Apply the schema once:
```bash
psql "$DB_NAME" < sql/schema.sql
```

## Web client (React + Vite)

1. Install dependencies:
   ```bash
   cd web
   npm install
   ```
2. Run the dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173`.

## Mobile client (Expo + React Native)

> Note: on a real device, set the WebSocket URL to your machine's LAN IP, for example `ws://192.168.1.20:3000`.

1. Install dependencies:
   ```bash
   cd mobile
   npm install
   ```
2. Start Expo:
   ```bash
   npm run start
   ```

## WebSocket API

Connect to `ws://localhost:3000`.

### Join a room
```json
{ "type": "join", "roomId": 1 }
```

### Send a message
```json
{ "type": "message", "roomId": 1, "userId": 2, "content": "سلام!" }
```

### Message event broadcast
```json
{
  "type": "message",
  "id": 10,
  "roomId": 1,
  "userId": 2,
  "content": "سلام!",
  "createdAt": "2024-05-01T12:00:00.000Z"
}
```

## Authentication API

All auth endpoints accept JSON payloads.

### Register with email or phone + password
```json
POST /auth/register
{ "identifier": "user@example.com", "password": "StrongPassword123" }
```

### Login with email/phone + password
```json
POST /auth/login
{ "identifier": "+989123456789", "password": "StrongPassword123" }
```

### Request OTP (one-time code)
```json
POST /auth/request-otp
{ "identifier": "+989123456789" }
```

### Verify OTP
```json
POST /auth/verify-otp
{ "identifier": "+989123456789", "code": "123456" }
```

### Setup 2FA (TOTP)
```json
POST /auth/setup-2fa
{ "identifier": "user@example.com" }
```

### Verify 2FA token
```json
POST /auth/verify-2fa
{ "identifier": "user@example.com", "token": "123456" }
```

## Notes

- Each room uses a Redis channel named `room:{roomId}`.
- Postgres stores the canonical message history in `messages`.
- You can scale app instances horizontally as long as they share the same Redis + Postgres.
