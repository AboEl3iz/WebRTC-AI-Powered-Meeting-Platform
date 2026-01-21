import * as mediasoup from "mediasoup";
import { types } from "mediasoup";
import { TransportWrapper } from "./TransportWrapper";

export class MediaRoomWrapper {
    private router!: types.Router;
    private roomId: string;
    private worker: types.Worker;
    private transports: Map<string, TransportWrapper> = new Map();

    private mediaCodecs: types.RtpCodecCapability[] = [
        {
            kind: "audio",
            mimeType: "audio/opus",
            clockRate: 48000,
            channels: 2,
            preferredPayloadType: 0
        },
        {
            kind: "video",
            mimeType: "video/VP8",
            clockRate: 90000,
            preferredPayloadType: 1
        },
    ];

    constructor(roomId: string, worker: mediasoup.types.Worker) {
        this.roomId = roomId;
        this.worker = worker;

    }

    public async init(): Promise<void> {
        this.router = await this.worker.createRouter({
            mediaCodecs: this.mediaCodecs,
        });

        console.log(`🎥 Router created for room ${this.roomId}`);
    }


    public getRouter(): types.Router {

        return this.router

    }
    public canConsume(producerId: string, rtpCapabilities: any): boolean {
        return this.router.canConsume({ producerId, rtpCapabilities });
    }


    /**
     * 
     *  userId-send
        userId-recv

     */
    public async createWebRtcTransport(userId: string, direction: "send" | "recv"): Promise<TransportWrapper> {
        const transport = await this.router.createWebRtcTransport({
            listenIps: [{ ip: "127.0.0.1", announcedIp: undefined }],
            enableUdp: true,
            enableTcp: true,
            preferUdp: true,
        });

        const transportwrapper = new TransportWrapper(transport);
        const key = `${userId}-${direction}`;
        this.transports.set(key, transportwrapper);
        console.log(
            `🚚 Transport created for peer=${userId}, direction=${direction}`
        );
        return transportwrapper;
    }

    public getTransport(userId: string, direction: "send" | "recv"): TransportWrapper | undefined {
        return this.transports.get(`${userId}-${direction}`);
    }

    close() {
        this.router.close();
    }



}