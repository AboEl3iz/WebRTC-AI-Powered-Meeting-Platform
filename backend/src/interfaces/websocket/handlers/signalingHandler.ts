import WebSocket from "ws";
import { RoomService } from "../../../services/RoomService";
import { MediasoupWorkerManager } from "../../../media/MediasoupWorkerManager";
import { Recorder } from "./record";

interface SignalingMessage<T = any> {
  event: string;
  data: T;
}

export class SignalingHandler {
  private currentRoomId?: string;
  private currentUserId?: string;
  private recorders = new Map<string, Recorder>();
  constructor(
    private ws: WebSocket,
    private roomservice: RoomService,
    private mediasoupWorkerManager: MediasoupWorkerManager
  ) { }

  public async handle(rawMessage: WebSocket.RawData): Promise<void> {
    let message: SignalingMessage;

    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      return this.sendError("Invalid JSON");
    }

    const { event, data } = message;


    switch (event) {
      case "join_room":
        return this.handleJoinRoom(data);

      case "leave_room":
        return this.handleLeaveRoom(data);

      case "create-transport":
        return this.handleCreateTransport(data);

      case "connect-transport":
        return this.handleConnectTransport(data);

      case "produce":
        return this.handleProduce(data);

      case "consume":
        return this.handleConsume(data);

      case "close-producer":
        return this.handleCloseProducer(data);

      case "start-recording":
        return this.handleStartRecording(data);

      case "stop-recording":
        return this.handleStopRecording(data);

      default:
        return this.sendError("Unknown event");
    }
  }

  public async close(): Promise<void> {

    if (!this.currentRoomId || !this.currentUserId) {
      console.error("Could not close: User was not fully joined.");
      return;
    }

    console.log(`Cleaning up for ${this.currentUserId} in ${this.currentRoomId}`);

    // 1. Remove user (this closes producers on the server)
    this.roomservice.removeUserFromRoom(this.currentRoomId, this.currentUserId);

    // 2. Broadcast 'peer-left'
    const peers = this.roomservice.getUsersInRoom(this.currentRoomId);
    peers.forEach(peerId => {
      const socket = this.roomservice.getUserSocket(peerId);
      if (socket && socket !== this.ws) {
        socket.send(JSON.stringify({
          event: 'peer-left',
          data: { userId: this.currentUserId }
        }));
      }
    });
  }

  /* ================= ROOM ================= */

  private async handleJoinRoom({ roomId, userId, name, email }: any) {
    this.roomservice.addUserToRoom(roomId, userId, name || "Guest", email || "guest@example.com", this.ws);
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    let mediaRoom = this.roomservice.getMediaRoom(roomId);
    if (!mediaRoom) {
      const worker = this.mediasoupWorkerManager.getNextWorker();
      mediaRoom = await this.roomservice.createMediaRoom(roomId, worker);
    }

    const rtpCapabilities = mediaRoom.getRouter().rtpCapabilities;
    this.ws.send(JSON.stringify({
      event: "router-rtp-capabilities",
      data: rtpCapabilities
    }));


    const producers = this.roomservice.getProducers(roomId);
    producers.forEach(producer => {
      this.ws.send(JSON.stringify({
        event: "new-producer",
        data: {
          producerId: producer.id,
          kind: producer.kind
        }
      }));
    });



    this.ws.send(JSON.stringify({
      event: "joined_room",
      data: { roomId }
    }));

    console.log(`👤 ${userId} joined room ${roomId}`);
  }

  private handleLeaveRoom({ roomId, userId }: any) {
    this.roomservice.removeUserFromRoom(roomId, userId);
    console.log(`👋 ${userId} left room ${roomId}`);
  }

  /* ================= TRANSPORT ================= */

  private async handleCreateTransport({ roomId, userId, direction }: any) {
    const room = this.roomservice.getMediaRoom(roomId);
    if (!room) return this.sendError("Room not found");

    const transport = await room.createWebRtcTransport(userId, direction);
    this.roomservice.addTransport(roomId, userId, direction, transport);

    const params = transport.getTransportParams();

    this.ws.send(JSON.stringify({
      event: "transport-created",
      data: {
        direction,
        transport: {
          id: params.id,
          iceParameters: params.iceParameters,
          iceCandidates: params.iceCandidates,
          dtlsParameters: transport.getDtlsParameters()
        }
      }
    }));
  }

  private async handleConnectTransport({ roomId, userId, direction, dtlsParameters }: any) {
    const transport = this.roomservice.getTransport(roomId, userId, direction);
    if (!transport) return this.sendError("Transport not found");

    await transport.connect(dtlsParameters);

    this.ws.send(JSON.stringify({
      event: "transport-connected",
      data: { direction }
    }));
  }

  /* ================= PRODUCER ================= */

  private async handleProduce({ roomId, userId, kind, rtpParameters }: any) {
    const transport = this.roomservice.getTransport(roomId, userId, "send");
    if (!transport) return this.sendError("Send transport not found");

    // Create the producer on the server
    const producer = await transport.produce({ kind, rtpParameters });
    this.roomservice.addProducer(roomId, userId, producer);

    console.log(`📹 Producer created: ${producer.id} (kind: ${kind}) by user: ${userId}`);

    // FIX: Add transportclose handler
    producer.on('transportclose', () => {
      console.log(`🚚 Transport closed for producer ${producer.id}`);
      producer.close();
    });


    const broadcastClose = () => {
      console.log(`❌ Producer ${producer.id} closed (kind: ${kind}, user: ${userId})`);

      const peers = this.roomservice.getUsersInRoom(roomId);
      console.log(`📢 Broadcasting producer-closed to ${peers.length} peers`);

      let notifiedCount = 0;
      peers.forEach(peerId => {
        if (peerId === userId) {
          console.log(`  ⏭️  Skipping self: ${peerId}`);
          return;
        }

        const peerSocket = this.roomservice.getUserSocket(peerId);
        if (peerSocket && peerSocket.readyState === WebSocket.OPEN) {
          peerSocket.send(JSON.stringify({
            event: "producer-closed",
            data: {
              producerId: producer.id,
              userId: userId,
              kind: kind
            }
          }));
          notifiedCount++;
          console.log(`  ✅ Notified peer: ${peerId}`);
        } else {
          console.log(`  ❌ Could not notify peer: ${peerId} (socket not ready)`);
        }
      });

      console.log(`📢 Notified ${notifiedCount} peers about producer ${producer.id} closure`);
    };

    // Listen to both possible event names
    // producer.on('close', broadcastClose);
    producer.on('@close', broadcastClose);

    // 1. Acknowledge to the producer
    this.ws.send(JSON.stringify({
      event: "produced",
      data: {
        producerId: producer.id,
        kind: kind,
        rtpParameters: producer.rtpParameters
      }
    }));

    // 2. Notify OTHERS
    const peers = this.roomservice.getUsersInRoom(roomId);
    peers.forEach(peerId => {
      if (peerId === userId) return;
      const peerSocket = this.roomservice.getUserSocket(peerId);
      if (peerSocket) {
        peerSocket.send(JSON.stringify({
          event: "new-producer",
          data: { producerId: producer.id, kind }
        }));
      }
    });
  }


  /* ================= CONSUMER ================= */

  private async handleConsume({ roomId, userId, producerId, rtpCapabilities }: any) {
    const mediaRoom = this.roomservice.getMediaRoom(roomId);
    const producer = this.roomservice.getProducer(producerId);
    const transport = this.roomservice.getTransport(roomId, userId, "recv");

    if (!mediaRoom || !producer || !transport) {
      return this.sendError("Missing room, producer, or transport");
    }

    if (!mediaRoom.canConsume(producerId, rtpCapabilities)) {
      return this.sendError("Cannot consume");
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
    });

    this.roomservice.addConsumer(roomId, userId, consumer);

    // FIX: Resume the consumer
    await consumer.resume();

    this.ws.send(JSON.stringify({
      event: "consumer-created",
      data: {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      }
    }));
  }

  /* ================= CLOSE PRODUCER ================= */

  private async handleCloseProducer({ roomId, userId, producerId }: any) {
    console.log(`🛑 Received close-producer request`);
    console.log(`   roomId: ${roomId}`);
    console.log(`   userId: ${userId}`);
    console.log(`   producerId: ${producerId}`);

    const producer = this.roomservice.getProducer(producerId);

    if (!producer) {
      console.log(`❌ Producer ${producerId} not found in room service`);
      return this.sendError("Producer not found");
    }

    console.log(`✅ Found producer: ${producer.id}, kind: ${producer.kind}`);

    // Close the producer on the server
    producer.close();
    console.log(`✅ Producer ${producerId} closed on server`);

    // Manually broadcast to other peers (since close event might not fire)
    const peers = this.roomservice.getUsersInRoom(roomId);
    console.log(`📢 Room has ${peers.length} total peers: ${JSON.stringify(peers)}`);

    let notifiedCount = 0;
    peers.forEach(peerId => {
      if (peerId === userId) {
        console.log(`  ⏭️  Skipping self: ${peerId}`);
        return;
      }

      console.log(`  🔍 Trying to notify peer: ${peerId}`);
      const peerSocket = this.roomservice.getUserSocket(peerId);

      if (!peerSocket) {
        console.log(`    ❌ No socket found for peer: ${peerId}`);
        return;
      }

      console.log(`    Socket state: ${peerSocket.readyState} (OPEN=${WebSocket.OPEN})`);

      if (peerSocket.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
          event: "producer-closed",
          data: {
            producerId: producer.id,
            userId: userId,
            kind: producer.kind
          }
        });
        console.log(`    📤 Sending: ${message}`);
        peerSocket.send(message);
        notifiedCount++;
        console.log(`    ✅ Successfully sent to peer: ${peerId}`);
      } else {
        console.log(`    ❌ Socket not open for peer: ${peerId}`);
      }
    });

    console.log(`📢 Total notified: ${notifiedCount} peers about producer ${producerId} closure`);
  }

  /**=======================Recorder Management=========== */
  private async handleStartRecording(data: any) {
    const { roomId, userId, videoProducerId, audioProducerId } = data;

    // 1. Check if recording is already active
    if (this.recorders.has(roomId)) {
      return this.sendError("Recording is already in progress.");
    }

    const router = this.roomservice.getRouter(roomId);
    const videoProducer = this.roomservice.getProducer(videoProducerId);
    const audioProducer = this.roomservice.getProducer(audioProducerId);

    if (!router || !videoProducer || !audioProducer) {
      return this.sendError("Required producers or router not found.");
    }

    // 2. Initialize and start the recorder
    const recorder = new Recorder(roomId);
    try {
      const peers = this.roomservice.getUsersInRoom(roomId);
      const participants = peers.map(peerId => {
        // Need to find peer info. I'll add a helper to RoomService or use existing data if possible.
        // For now I'll assume I can get it from RoomService (I'll need to add a getter).
        return (this.roomservice as any).getPeerInfo(roomId, peerId);
      }).filter(p => p !== undefined);

      await recorder.start(router, videoProducer, audioProducer, participants);
      this.recorders.set(roomId, recorder);

      // 3. Notify all peers that recording has started
      this.broadcastToRoom(roomId, {
        event: 'recording-started',
        data: { startedBy: userId }
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      this.sendError("Server failed to start the recording process.");
    }
  }

  private handleStopRecording(data: any) {
    const { roomId } = data;
    const recorder = this.recorders.get(roomId);

    if (recorder) {
      recorder.stop();
      this.recorders.delete(roomId);

      this.broadcastToRoom(roomId, {
        event: 'recording-stopped',
        data: {}
      });
    }
  }

  private broadcastToRoom(roomId: string, message: SignalingMessage) {
    const peers = this.roomservice.getUsersInRoom(roomId);
    peers.forEach(peerId => {
      const socket = this.roomservice.getUserSocket(peerId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });
  }


  /* ================= ERROR ================= */

  private sendError(message: string) {
    this.ws.send(JSON.stringify({ event: "error", data: message }));
  }
}