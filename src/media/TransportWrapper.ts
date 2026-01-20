import * as mediasoup from 'mediasoup';
type WebRtcTransport = mediasoup.types.WebRtcTransport;

interface ITransportWrapperParams {
    id:string;
    iceParameters:mediasoup.types.IceParameters;
    iceCandidates:mediasoup.types.IceCandidate[];
    dtlsParameters:mediasoup.types.DtlsParameters;

} 
export class TransportWrapper {
    private transport: WebRtcTransport;
    constructor( transport: WebRtcTransport) {
        this.transport = transport;
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

    public getTransportParams(): ITransportWrapperParams {
        return {
            id: this.transport.id,
            iceParameters: this.transport.iceParameters,
            iceCandidates: this.transport.iceCandidates,
            dtlsParameters: this.transport.dtlsParameters,
        };
    }
}