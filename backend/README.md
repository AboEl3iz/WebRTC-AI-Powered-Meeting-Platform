# 📡 Backend — WebRTC Signaling & Media Server

> A high-performance real-time signaling and media server built with **Node.js**, **TypeScript**, **mediasoup** (SFU), **WebSocket**, and **Express**, backed by **MongoDB**, **MinIO**, and **RabbitMQ**.

---

## 📖 Overview

The backend is the core infrastructure of the video conferencing platform. It handles WebSocket-based signaling, manages mediasoup workers and routers for Selective Forwarding Unit (SFU) media routing, persists chat messages in MongoDB, stores composite recordings in MinIO (S3-compatible), and publishes events to RabbitMQ for asynchronous AI processing.

---

## ✨ Features

### 📞 WebRTC Signaling (WebSocket)
- **Room-Based Signaling** — Users join rooms via a WebSocket handshake; the server orchestrates SDP offer/answer exchange and ICE candidate relay.
- **Dynamic Room Lifecycle** — Rooms are created on-demand when the first participant joins and automatically destroyed when the last participant leaves.
- **Participant Tracking** — Each peer's metadata (name, email, AI settings, integrations) is stored in-memory for the duration of the session.
- **Peer Notifications** — All participants are notified in real time when someone joins, leaves, produces, or consumes media.

### 🎬 mediasoup SFU (Selective Forwarding Unit)
- **Worker Manager** — Spawns and load-balances across multiple mediasoup worker processes for scalability.
- **Media Room Wrapper** — Encapsulates a mediasoup Router per room, handling codec capabilities and RTP configuration.
- **Transport Wrapper** — Manages WebRTC send/receive transports per user, including DTLS parameter handling.
- **Producer/Consumer Management** — Tracks all audio and video producers and consumers per peer, with proper cleanup on disconnect.

### 🎥 Composite Recording
- **Server-Side Recording** — Uses FFmpeg to capture RTP streams from mediasoup's `PlainTransport` and compose them into a single MP4 file.
- **Multi-Participant Layout** — Records all active video/audio tracks from every participant simultaneously.
- **Recording Utilities** — Helper functions for managing FFmpeg processes, temporary files, and recording state.
- **Automatic Upload** — Finished recordings are automatically uploaded to MinIO object storage.

### 💬 Persistent Chat
- **MongoDB-Backed Chat** — All in-meeting chat messages are persisted to MongoDB via Mongoose.
- **Message Types** — Supports `text`, `system`, and `file` message types.
- **Chat History & Pagination** — Retrieve chat history with configurable limits and cursor-based pagination.
- **System Messages** — Auto-generated messages for events like "User joined", "Recording started", etc.
- **Room Cleanup** — Ability to delete all messages for a room when the meeting ends.

### 📦 MinIO Object Storage (S3-Compatible)
- **Auto-Bucket Creation** — Ensures the target bucket exists before the first upload.
- **Recording Upload** — Uploads MP4 composite recordings to MinIO with a structured key path (`recordings/<roomId>/<filename>`).
- **Singleton Service** — Thread-safe, single-instance MinIO client shared across the application.

### 🐇 RabbitMQ Event Bus
- **Topic Exchange** — Uses a `meetings` topic exchange with durable queues for reliable message delivery.
- **`recording.completed` Event** — After a recording is uploaded to MinIO, the backend publishes an event containing the meeting ID, MinIO object reference, and per-participant integration credentials.
- **Decoupled Architecture** — The AI service consumes these events asynchronously, enabling independent scaling and fault isolation.

### 🔐 Authentication (Prepared)
- **Passport.js Integration** — Passport and `passport-google-oauth20` are included as dependencies, ready for Google OAuth2 integration.
- **JWT Support** — `jsonwebtoken` is available for token-based authentication.

### 📝 Structured Logging
- **Winston Logger** — Centralized logging with Winston, supporting multiple transports and structured JSON output.

---

## 🏗️ Tech Stack

| Technology | Purpose |
|---|---|
| **Node.js + TypeScript** | Runtime & language |
| **Express 5** | HTTP REST API framework |
| **WebSocket (ws)** | Real-time signaling |
| **mediasoup 3** | SFU media server (WebRTC) |
| **MongoDB + Mongoose** | Chat persistence & meeting data |
| **MinIO (via AWS SDK v3)** | S3-compatible object storage for recordings |
| **RabbitMQ (amqplib)** | Async event bus between backend ↔ AI |
| **Winston** | Structured logging |
| **Zod** | Runtime schema validation |
| **FFmpeg** | Composite video recording |

---

## 📂 Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── config.ts                    # Environment variables & constants
│   │   └── logger.ts                    # Winston logger setup
│   ├── interfaces/
│   │   ├── http/                        # Express REST API routes
│   │   └── websocket/
│   │       ├── socketServer.ts          # WebSocket server initialization
│   │       └── handlers/
│   │           ├── signalingHandler.ts   # Core signaling logic (join, produce, consume, etc.)
│   │           ├── record.ts            # Composite recording management
│   │           └── recordUtils.ts       # FFmpeg & recording helper utilities
│   ├── media/
│   │   ├── MediasoupWorkerManager.ts    # Worker pool management
│   │   ├── MediaRoomWrapper.ts          # Per-room mediasoup Router wrapper
│   │   └── TransportWrapper.ts          # Per-user WebRTC transport wrapper
│   ├── models/
│   │   ├── ChatMessage.ts               # Mongoose schema for chat messages
│   │   └── Meeting.ts                   # Mongoose schema for meeting metadata
│   ├── services/
│   │   ├── RoomService.ts               # In-memory room & peer state management
│   │   ├── ChatService.ts               # Chat CRUD operations
│   │   ├── MinioService.ts              # MinIO S3 upload/download
│   │   └── RabbitMQService.ts           # RabbitMQ publish/subscribe
│   ├── app.ts                           # Express app bootstrap
│   └── index.ts                         # Entry point (HTTP + WS servers)
├── tsconfig.json
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **pnpm** (package manager)
- **FFmpeg** installed and available on `PATH`
- **Docker** (for infrastructure services)

### Infrastructure Setup

Start the required infrastructure services (RabbitMQ, MongoDB, MinIO):

```bash
# From the project root
docker compose up -d
```

This starts:
- **RabbitMQ** on ports `5672` (AMQP) and `15672` (Management UI)
- **MongoDB** on port `27017`
- **MinIO** on ports `9000` (API) and `9001` (Console)

### Installation & Development

```bash
cd backend
pnpm install
pnpm dev
```

The server starts on `http://localhost:3000` by default.

### Environment Variables

Create a `.env` file in the `backend/` directory:

```env
PORT=3000
MONGODB_URI=mongodb://root:example@localhost:27017/webrtc?authSource=admin
RABBITMQ_URL=amqp://admin:admin@localhost:5672
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=karim123
MINIO_SECRET_KEY=karim123
MINIO_BUCKET=recordings
```

---

## ⚠️ Platform Requirements

> **This project must be run on Linux, WSL, or macOS.**
> Running on Windows natively is **not supported** due to mediasoup's native dependency requirements.

---

## 📎 Related

- [🖥️ Frontend (Video Conferencing UI)](../frontend/README.md)
- [🧠 AI Service (Meeting Intelligence)](../ai/README.md)
- [📘 Full Project Overview](../README.md)

