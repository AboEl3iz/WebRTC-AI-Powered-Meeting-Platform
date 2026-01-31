import WebSocket from "ws";
import { RoomService } from "../../../services/RoomService";
import { MediasoupWorkerManager } from "../../../media/MediasoupWorkerManager";
import { Recorder } from "./record";
import { chatService, ChatMessageResponse } from "../../../services/ChatService";
import logger from "../../../config/logger";

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

      case "send-message":
        return this.handleSendMessage(data);

      case "get-chat-history":
        return this.handleGetChatHistory(data);

      case "get-participants":
        return this.handleGetParticipants(data);

      default:
        return this.sendError("Unknown event");
    }
  }

  public async close(): Promise<void> {

    if (!this.currentRoomId || !this.currentUserId) {
      logger.signaling.warn("Could not close: User was not fully joined");
      return;
    }

    logger.signaling.info("Cleaning up user session", {
      userId: this.currentUserId,
      roomId: this.currentRoomId
    });

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

    logger.signaling.info("User joined room", { userId, roomId, name });
  }

  private handleLeaveRoom({ roomId, userId }: any) {
    this.roomservice.removeUserFromRoom(roomId, userId);
    logger.signaling.info("User left room", { userId, roomId });
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

    logger.media.info("Producer created", { producerId: producer.id, kind, userId });

    // FIX: Add transportclose handler
    producer.on('transportclose', () => {
      logger.media.debug("Transport closed for producer", { producerId: producer.id });
      producer.close();
    });


    const broadcastClose = () => {
      logger.media.info("Producer closed", { producerId: producer.id, kind, userId });

      const peers = this.roomservice.getUsersInRoom(roomId);
      logger.media.debug("Broadcasting producer-closed", { peerCount: peers.length });

      let notifiedCount = 0;
      peers.forEach(peerId => {
        if (peerId === userId) {
          logger.media.debug("Skipping self notification", { peerId });
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
          logger.media.debug("Notified peer about producer closure", { peerId });
        } else {
          logger.media.warn("Could not notify peer - socket not ready", { peerId });
        }
      });

      logger.media.debug("Producer closure notification complete", { notifiedCount, producerId: producer.id });
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

    // 2. Notify OTHERS (FIX: Include user info to prevent audio display bug)
    const peers = this.roomservice.getUsersInRoom(roomId);
    const peerInfo = this.roomservice.getPeerInfo(roomId, userId);
    peers.forEach(peerId => {
      if (peerId === userId) return;
      const peerSocket = this.roomservice.getUserSocket(peerId);
      if (peerSocket) {
        peerSocket.send(JSON.stringify({
          event: "new-producer",
          data: {
            producerId: producer.id,
            kind,
            userId,
            producerName: peerInfo?.name || 'Unknown',
            producerEmail: peerInfo?.email || ''
          }
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
    logger.media.info("Close producer request received", { roomId, userId, producerId });

    const producer = this.roomservice.getProducer(producerId);

    if (!producer) {
      logger.media.warn("Producer not found in room service", { producerId });
      return this.sendError("Producer not found");
    }

    logger.media.debug("Found producer", { producerId: producer.id, kind: producer.kind });

    // Close the producer on the server
    producer.close();
    logger.media.info("Producer closed on server", { producerId });

    // Manually broadcast to other peers (since close event might not fire)
    const peers = this.roomservice.getUsersInRoom(roomId);
    logger.media.debug("Room peers for notification", { peerCount: peers.length, peers });

    let notifiedCount = 0;
    peers.forEach(peerId => {
      if (peerId === userId) {
        logger.media.debug("Skipping self", { peerId });
        return;
      }

      logger.media.debug("Attempting to notify peer", { peerId });
      const peerSocket = this.roomservice.getUserSocket(peerId);

      if (!peerSocket) {
        logger.media.warn("No socket found for peer", { peerId });
        return;
      }

      logger.media.debug("Socket state check", { peerId, state: peerSocket.readyState, openState: WebSocket.OPEN });

      if (peerSocket.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
          event: "producer-closed",
          data: {
            producerId: producer.id,
            userId: userId,
            kind: producer.kind
          }
        });
        logger.media.debug("Sending producer-closed message", { peerId });
        peerSocket.send(message);
        notifiedCount++;
        logger.media.debug("Successfully sent to peer", { peerId });
      } else {
        logger.media.warn("Socket not open for peer", { peerId });
      }
    });

    logger.media.info("Producer closure notification complete", { notifiedCount, producerId });
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

      logger.recording.info("Recording started", { roomId, startedBy: userId });
    } catch (error) {
      logger.recording.error("Failed to start recording", { roomId, error: String(error) });
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

      logger.recording.info("Recording stopped", { roomId });
    }
  }

  /* ================= CHAT ================= */

  private async handleSendMessage(data: any) {
    // Use stored context as fallback if not provided in data
    const roomId = data.roomId || this.currentRoomId;
    const userId = data.userId || this.currentUserId;
    // Accept multiple common property names for message content
    const content = data.content || data.message || data.text;

    logger.signaling.debug("Chat message request", { roomId, userId, contentPreview: content?.substring(0, 50) });
    logger.signaling.debug("Raw chat data received", { data });

    if (!roomId || !userId) {
      logger.signaling.warn("Missing roomId or userId for chat message");
      return this.sendError("You must be in a room to send messages");
    }

    if (!content || String(content).trim().length === 0) {
      logger.signaling.warn("Missing message content");
      return this.sendError("Message content cannot be empty");
    }

    const peerInfo = this.roomservice.getPeerInfo(roomId, userId);
    if (!peerInfo) {
      logger.signaling.warn("User not found in room", { userId, roomId });
      return this.sendError("User not found in room");
    }

    try {
      // Save message to database
      const message = await chatService.saveMessage({
        roomId,
        senderId: userId,
        senderName: peerInfo.name,
        senderEmail: peerInfo.email,
        content: content.trim()
      });

      logger.signaling.info("Message saved", { messageId: message.id, roomId });

      // Broadcast to all participants
      this.broadcastToRoom(roomId, {
        event: 'new-message',
        data: message
      });

      // Also send confirmation to sender
      this.ws.send(JSON.stringify({
        event: 'message-sent',
        data: message
      }));
    } catch (error) {
      logger.signaling.error("Failed to save chat message", { error: String(error) });
      this.sendError("Failed to send message");
    }
  }

  private async handleGetChatHistory(data: any) {
    const { roomId, limit, before } = data;

    if (!roomId) {
      return this.sendError("Room ID is required");
    }

    try {
      const messages = await chatService.getChatHistory(
        roomId,
        limit || 50,
        before ? new Date(String(before)) : undefined
      );

      this.ws.send(JSON.stringify({
        event: 'chat-history',
        data: {
          roomId,
          messages
        }
      }));
    } catch (error) {
      logger.signaling.error("Failed to fetch chat history", { roomId, error: String(error) });
      this.sendError("Failed to fetch chat history");
    }
  }

  /* ================= PARTICIPANTS ================= */

  private handleGetParticipants(data: any) {
    const { roomId } = data;

    if (!roomId) {
      return this.sendError("Room ID is required");
    }

    const participants = this.roomservice.getParticipantsDetails(roomId);

    this.ws.send(JSON.stringify({
      event: 'participants-list',
      data: {
        roomId,
        count: participants.length,
        participants
      }
    }));
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