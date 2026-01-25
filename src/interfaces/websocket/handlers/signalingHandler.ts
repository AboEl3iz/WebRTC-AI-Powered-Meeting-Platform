import WebSocket from "ws";
import { RoomService } from "../../../services/RoomService";
import { MediasoupWorkerManager } from "../../../media/MediasoupWorkerManager";

interface SignalingMessage<T = any> {
  event: string;
  data: T;
}

export class SignalingHandler {
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

      default:
        return this.sendError("Unknown event");
    }
  }

  public async close(rawMessage: WebSocket.RawData): Promise<void> {
    let message: SignalingMessage;

    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      return this.sendError("Invalid JSON");
    }

    const { event, data } = message;
    const { roomId, userId } = data;
    // 1. Tell your room service to remove the user and close their producers
    this.roomservice.removeUserFromRoom(roomId, userId); 

    // 2. Broadcast to everyone else that this user has left
    const peers = this.roomservice.getUsersInRoom(roomId);
    peers.forEach(peerId => {
        const socket = this.roomservice.getUserSocket(peerId);
        if (socket) {
            socket.send(JSON.stringify({
                event: 'peer-left',
                data: { userId: userId }
            }));
        }
    });
  }

  /* ================= ROOM ================= */

  private async handleJoinRoom({ roomId, userId }: any) {
    this.roomservice.addUserToRoom(roomId, userId, this.ws);

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

    // --- ADD THIS LOGIC ---
    producer.on('transportclose', () => producer.close());

    producer.on('@close', () => {
      console.log(`Producer ${producer.id} closed, notifying peers...`);
      const peers = this.roomservice.getUsersInRoom(roomId);
      peers.forEach(peerId => {
        if (peerId === userId) return; // Don't notify the person who closed it
        const peerSocket = this.roomservice.getUserSocket(peerId);
        if (peerSocket) {
          peerSocket.send(JSON.stringify({
            event: "producer-closed",
            data: { producerId: producer.id }
          }));
        }
      });
    });

    // 1. Reply to the SENDER (The Fix)
    // We MUST send back the producerId and the server-side rtpParameters
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
  // ```

  // ## **After applying these fixes:**

  // 1. **Restart your server** (important!)
  // 2. **Refresh the browser page**
  // 3. **Join the room again**

  // You should then see logs like:
  // ```
  // 🔗 Send transport connecting...
  // ✅ Transport send connected
  // ✅ Transport recv connected
  // 🎥 Starting media...
  // 🎤 Producing audio...
  // ✅ Audio: [id]
  // 📹 Producing video...
  // ✅ Video: [id]

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

  /* ================= ERROR ================= */

  private sendError(message: string) {
    this.ws.send(JSON.stringify({ event: "error", data: message }));
  }
}
