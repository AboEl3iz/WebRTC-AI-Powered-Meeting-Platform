import * as mediasoup from "mediasoup";
import { types } from "mediasoup";


export class MediaRoomWrapper {
    private router!: types.Router;
    private roomId: string;
    private worker: types.Worker;
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

}