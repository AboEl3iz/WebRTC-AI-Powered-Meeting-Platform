import * as mediasoup from 'mediasoup';
type WebRtcTransport = mediasoup.types.WebRtcTransport;

export class TransportWrapper {
    constructor(public transport: WebRtcTransport) {

    }

    async connect(dtlsParameters: mediasoup.types.DtlsParameters) {
        await this.transport.connect({ dtlsParameters });
    }

    async produce(kind: "audio" | "video", rtpParameters: any): Promise<mediasoup.types.Producer> {
        return await this.transport.produce({ kind, rtpParameters });
    }

    async consume(producerId: string, rtpCapabilities: any): Promise<mediasoup.types.Consumer> {
        return await this.transport.consume({ producerId, rtpCapabilities, paused: false });
    }

    async close() {
        this.transport.close();
    }
}