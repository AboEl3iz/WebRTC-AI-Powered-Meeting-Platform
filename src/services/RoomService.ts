import * as mediasoup from 'mediasoup';
type WebRtcTransport = mediasoup.types.WebRtcTransport;
type Producer = mediasoup.types.Producer;
type Consumer = mediasoup.types.Consumer;
import { MediaRoomWrapper } from "../media/MediaRoomWrapper";

export class RoomService {
    private rooms: Map<string, Set<string>>;
    private transports: Map<string, WebRtcTransport>;
    private producers: Map<string, Producer>;
    private consumers: Map<string, Consumer>;
    private mediaRooms: Map<string, MediaRoomWrapper> = new Map();

    constructor() {
        this.rooms = new Map<string, Set<string>>();
        this.transports = new Map<string, WebRtcTransport>();
        this.producers = new Map<string, Producer>();
        this.consumers = new Map<string, Consumer>();
    }

    public addUserToRoom(roomId: string, userId: string): void {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, new Set<string>());
        }
        this.rooms.get(roomId)?.add(userId);
    }

    public removeUserFromRoom(roomId: string, userId: string): void {
        const room = this.rooms.get(roomId);
        if (!room) return;
        room.delete(userId);
    }

    public getUsersInRoom(roomId: string): string[] | undefined {
        return Array.from(this.rooms.get(roomId) || []);
    }

    public getRoom(roomId: string): Set<string> | undefined {
        return this.rooms.get(roomId);
    }

    public getMediaRoom(roomId: string): MediaRoomWrapper | undefined {
        return this.mediaRooms.get(roomId);
    }

    public async createMediaRoom(
        roomId: string,
        worker: mediasoup.types.Worker
    ): Promise<MediaRoomWrapper> {
        if (this.mediaRooms.has(roomId)) {
            return this.mediaRooms.get(roomId)!;
        }

        const room = new MediaRoomWrapper(roomId, worker);
        await room.init();

        this.mediaRooms.set(roomId, room);
        return room;
    }

    





    // Transports
    public addTransport(userId: string, transport: WebRtcTransport) {
        this.transports.set(userId, transport);
    }

    public getTransport(userId: string) {
        return this.transports.get(userId);
    }

    // Producers
    public addProducer(userId: string, producer: Producer) {
        this.producers.set(userId, producer);
    }

    public getProducer(userId: string) {
        return this.producers.get(userId);
    }

    // Consumers
    public addConsumer(userId: string, consumer: Consumer) {
        this.consumers.set(userId, consumer);
    }

    public getConsumer(userId: string) {
        return this.consumers.get(userId);
    }
}