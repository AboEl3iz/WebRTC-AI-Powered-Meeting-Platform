# WebRTC + AI application

### 📂 Proposed Project Structure (OOP Style)

``` bash

src/
├── config/           # Environment variables, constants, mediasoup settings
├── database/         # MongoDB connection setup
│
├── interfaces/       # --- Layer 1: Interface ---
│   ├── http/
│   │   ├── controllers/  # AuthController.js, RoomController.js
│   │   ├── routes/       # Express routes definitions
│   │   └── middleware/   # authMiddleware.js, validationMiddleware.js
│   └── websockets/
│       ├── socketServer.js  # Main WS setup (connection handling)
│       └── handlers/        # signalingHandler.js, mediaHandler.js
│
├── services/         # --- Layer 2: Business Logic ---
│   ├── AuthService.js
│   ├── RoomService.js    # Manages in-memory room state
│   ├── PeerService.js
│   └── SignalingService.js # Orchestrates signaling flow between WS and Media Layer
│
├── media/            # --- Layer 3: Media (Mediasoup Adapter) ---
│   ├── MediasoupWorkerManager.js # Manages worker processes
│   ├── MediaRoomWrapper.js       # Wraps a Mediasoup Router instance
│   └── TransportWrapper.js       # Wraps Mediasoup transports/producers/consumers
│
├── repositories/     # --- Layer 4: Data Access ---
│   ├── BaseRepository.js
│   ├── UserRepository.js
│   └── RoomRepository.js
│
├── models/           # Mongoose Schemas (User.js, Room.js)
│
├── utils/            # Shared infrastructure (Logger.js, AppError.js, jwtHelper.js)
│
├── app.js            # Express app setup
└── server.js         # Entry point (starts HTTP and WS servers)

```

