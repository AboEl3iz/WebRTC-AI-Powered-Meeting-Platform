import * as mediasoup from "mediasoup";
import WebSocket from "ws";
import { MediaRoomWrapper } from "../media/MediaRoomWrapper";
import { TransportWrapper } from "../media/TransportWrapper";
type WebRtcTransport = mediasoup.types.WebRtcTransport;
type Producer = mediasoup.types.Producer;
type Consumer = mediasoup.types.Consumer;

interface Peer {
    socket: WebSocket;
    transports: Map<"send" | "recv", TransportWrapper>;
    producers: Map<string, Producer>;
    consumers: Map<string, Consumer>;
}

export class RoomService {
    private rooms = new Map<string, Map<string, Peer>>();
    private mediaRooms = new Map<string, MediaRoomWrapper>();

    /* ================= USERS ================= */

    public addUserToRoom(roomId: string, userId: string, socket: WebSocket) {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Map());
        }

        this.rooms.get(roomId)!.set(userId, {
            socket,
            transports: new Map(),
            producers: new Map(),
            consumers: new Map()
        });
    }

    public removeUserFromRoom(roomId: string, userId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const peer = room.get(userId);
        if (!peer) return;

        peer.producers.forEach(p => p.close());
        peer.consumers.forEach(c => c.close());
        peer.transports.forEach(t => t.close());

        room.delete(userId);

        if (room.size === 0) {
            this.rooms.delete(roomId);

            const mediaRoom = this.mediaRooms.get(roomId);
            mediaRoom?.close();
            this.mediaRooms.delete(roomId);
        }
    }

    public getUsersInRoom(roomId: string): string[] {
        return Array.from(this.rooms.get(roomId)?.keys() || []);
    }

    // In RoomService.ts
    public getUserSocket(userId: string): WebSocket | undefined {
        for (const room of this.rooms.values()) {
            const peer = room.get(userId);
            if (peer) return peer.socket;
        }
        return undefined;
    }

    /* ================= MEDIA ROOM ================= */

    public getMediaRoom(roomId: string) {
        return this.mediaRooms.get(roomId);
    }

    public getRouter(roomId: string) {
        return this.mediaRooms.get(roomId)?.getRouter();
    }

    public async createMediaRoom(
        roomId: string,
        worker: mediasoup.types.Worker
    ) {
        if (this.mediaRooms.has(roomId)) {
            return this.mediaRooms.get(roomId)!;
        }

        const room = new MediaRoomWrapper(roomId, worker);
        await room.init();

        this.mediaRooms.set(roomId, room);
        return room;
    }

    /* ================= TRANSPORT ================= */

    public addTransport(
        roomId: string,
        userId: string,
        direction: "send" | "recv",
        transport: TransportWrapper
    ) {
        this.rooms.get(roomId)
            ?.get(userId)
            ?.transports.set(direction, transport);
    }

    public getTransport(
        roomId: string,
        userId: string,
        direction: "send" | "recv"
    ) {
        return this.rooms
            .get(roomId)
            ?.get(userId)
            ?.transports.get(direction);
    }

    /* ================= PRODUCER ================= */

    public addProducer(
        roomId: string,
        userId: string,
        producer: Producer
    ) {
        this.rooms
            .get(roomId)
            ?.get(userId)
            ?.producers.set(producer.id, producer);
    }




    public getProducer(producerId: string): Producer | undefined {
        for (const room of this.rooms.values()) {
            for (const peer of room.values()) {
                const producer = peer.producers.get(producerId);
                if (producer) return producer;
            }
        }
    }

    public getProducers(roomId: string): Producer[] {
        const producers: Producer[] = [];
        this.rooms.get(roomId)?.forEach(peer => {
            peer.producers.forEach(p => producers.push(p));
        });
        return producers;
    }

    /* ================= CONSUMER ================= */

    public addConsumer(
        roomId: string,
        userId: string,
        consumer: Consumer
    ) {
        this.rooms
            .get(roomId)
            ?.get(userId)
            ?.consumers.set(consumer.id, consumer);
    }


}
