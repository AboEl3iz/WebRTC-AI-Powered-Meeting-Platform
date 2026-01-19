import * as mediasoup from 'mediasoup';
type WebRtcTransport = mediasoup.types.WebRtcTransport;
type Producer = mediasoup.types.Producer;
type Consumer = mediasoup.types.Consumer;
export class RoomService {
    private rooms : Map<string, Set<string>>;
    private transports : Map<string, WebRtcTransport> ;
    private producers : Map<string, Producer>;
    private consumers : Map<string, Consumer>;

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