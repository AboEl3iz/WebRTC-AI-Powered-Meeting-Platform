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
  ) {}

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
    console.log("Transport created:", transport.getTransportParams());
    

    this.ws.send(JSON.stringify({
      event: "transport-created",
      data: {
        direction,
        transport: transport.getTransportParams()
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

    const producer = await transport.produce({ kind, rtpParameters });

    this.roomservice.addProducer(roomId, userId, producer);

    
    const peers = this.roomservice.getUsersInRoom(roomId);

    peers.forEach(peerId => {
      const peerSocket = this.roomservice.getUserSocket(peerId);
      if (!peerSocket) return;

      peerSocket.send(JSON.stringify({
        event: "new-producer",
        data: {
          producerId: producer.id,
          kind
        }
      }));
    });

    this.ws.send(JSON.stringify({
      event: "produced",
      data: { producerId: producer.id }
    }));

    console.log(`🎥 Producer ${producer.id} (${kind}) from ${userId}`);
  }

  /* ================= CONSUMER ================= */

  private async handleConsume({ roomId, userId, producerId, rtpCapabilities }: any) {
    const mediaRoom = this.roomservice.getMediaRoom(roomId);
    const producer = this.roomservice.getProducer(producerId);
    const transport = this.roomservice.getTransport(roomId, userId, "recv");

    if (!mediaRoom || !producer || !transport) return;

    if (!mediaRoom.canConsume( producerId, rtpCapabilities )) {
      return this.sendError("Cannot consume");
    }

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      
    });

    this.roomservice.addConsumer(roomId, userId, consumer);

    this.ws.send(JSON.stringify({
      event: "consumer-created",
      data: {
        id: consumer.id,
        producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters
      }
    }));

    console.log(`📥 Consumer ${consumer.id} consuming ${producerId}`);
  }

  /* ================= ERROR ================= */

  private sendError(message: string) {
    this.ws.send(JSON.stringify({ event: "error", data: message }));
  }
}
