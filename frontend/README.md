# 🎥 Frontend — Real-Time Video Conferencing UI

> A modern, responsive video conferencing interface built with **React**, **TypeScript**, and **Vite**, powered by **mediasoup-client** for WebRTC media handling.

---

## 📖 Overview

The frontend provides a full-featured meeting room experience where users can join rooms, share audio/video, chat in real time, manage participants, and optionally enable AI-powered features like meeting summarization and calendar event extraction.

---

## ✨ Features

### 🔗 Room Management
- **Join Room** — Enter a room code, display name, and email to join a meeting session.
- **Room Code Display** — The current room code is always visible in the footer for easy sharing.
- **Real-Time Connection Status** — Visual indicator showing whether you're connected to the signaling server.

### 📹 Video & Audio
- **Adaptive Video Grid** — Dynamically arranges participant video tiles based on the number of active participants.
- **Camera & Microphone Toggle** — Easily mute/unmute your microphone or turn your camera on/off with intuitive controls.
- **Screen Sharing** — Share your entire screen with other participants in the meeting.
- **Local Preview** — See your own video feed before and during the meeting.

### 💬 Real-Time Chat
- **In-Meeting Text Chat** — Send and receive text messages during the meeting, persisted to MongoDB.
- **System Messages** — Automatic notifications for events like users joining/leaving or recordings starting.
- **Unread Message Indicator** — A pulsing red dot on the chat icon when new messages arrive while the panel is closed.
- **Chat History** — Messages are stored and can be retrieved with pagination support.

### 👥 Participants Panel
- **Participant List** — View all connected participants with their name, email, and media status (camera/mic on or off).
- **Live Participant Count** — Badge on the participants icon shows the current number of participants.

### 🤖 AI Integration (Opt-In)
- **AI Activation Panel** — A dedicated panel to enable AI features before joining the room.
- **Notion Integration** — Provide a Notion access token and workspace ID to automatically push meeting summaries to Notion pages.
- **Google Calendar Integration** — Supply Google Calendar credentials to auto-create calendar events extracted from the meeting conversation.
- **Per-User Settings** — Each participant can independently choose which AI integrations to enable.

### 🎙️ Recording
- **Start/Stop Recording** — Trigger composite recording of the meeting (all participants combined into a single MP4).
- **Recording Indicator** — Visual indicator showing when a recording is in progress.

### 🛠️ Debug & Developer Tools
- **Debug Logs Panel** — A collapsible panel to view real-time system logs for WebSocket events, media transport status, and connection diagnostics.

---

## 🏗️ Tech Stack

| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript** | Type-safe development |
| **Vite 5** | Build tool & dev server |
| **mediasoup-client** | WebRTC media transport (SFU client-side) |
| **TailwindCSS 3** | Utility-first CSS styling |
| **Lucide React** | Icon library |
| **WebSocket** | Real-time signaling communication |

---

## 📂 Project Structure

```
frontend/react/
├── src/
│   ├── components/
│   │   ├── AIActivationPanel.tsx   # AI opt-in UI with Notion & Calendar config
│   │   ├── ChatPanel.tsx           # In-meeting chat panel
│   │   ├── Controls.tsx            # Media controls (mic, cam, screen, record)
│   │   ├── DebugLogs.tsx           # Developer debug logs panel
│   │   ├── Header.tsx              # Top bar with room info & connection status
│   │   ├── JoinRoom.tsx            # Room join form
│   │   ├── ParticipantsPanel.tsx   # Participant list sidebar
│   │   ├── VideoGrid.tsx           # Dynamic layout of video tiles
│   │   └── VideoTile.tsx           # Individual participant video
│   ├── hooks/
│   │   └── useMediasoup.ts        # Core hook — manages WebSocket, mediasoup, state
│   ├── types/
│   │   ├── mediasoup.ts            # Participant & media types
│   │   ├── chat.ts                 # Chat message types
│   │   └── integrations.ts        # AI settings & integration types
│   ├── lib/                        # Utility functions
│   ├── App.tsx                     # Root application component
│   ├── main.tsx                    # Entry point
│   └── index.css                   # Global styles
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** ≥ 18
- **pnpm** (package manager)

### Installation & Development

```bash
cd frontend/react
pnpm install
pnpm dev
```

The dev server starts at `http://localhost:5173` by default.

### Production Build

```bash
pnpm build
pnpm preview
```

---

## 🔧 Environment Configuration

The frontend connects to the backend signaling server via WebSocket. The WebSocket URL is configured in the `useMediasoup` hook and defaults to `ws://localhost:3000`.

---

## 🐳 Docker

A `Dockerfile` is included for containerized deployment:

```bash
docker build -t webrtc-frontend .
docker run -p 5173:5173 webrtc-frontend
```

---

## 📎 Related

- [📡 Backend (Signaling & Media Server)](../backend/README.md)
- [🧠 AI Service (Meeting Intelligence)](../ai/README.md)
- [📘 Full Project Overview](../README.md)

