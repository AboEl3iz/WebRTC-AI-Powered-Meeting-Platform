import * as mediasoup from "mediasoup";

type WebRtcTransport = mediasoup.types.WebRtcTransport;

export interface ITransportWrapperParams {
    id: string;
    iceParameters: mediasoup.types.IceParameters;
    iceCandidates: mediasoup.types.IceCandidate[];
}

export class TransportWrapper {
    constructor(private transport: WebRtcTransport) { }

    async connect(dtlsParameters: mediasoup.types.DtlsParameters) {
        await this.transport.connect({ dtlsParameters });
    }

    async produce(params: {
        kind: "audio" | "video";
        rtpParameters: any;
    }): Promise<mediasoup.types.Producer> {
        return await this.transport.produce(params);
    }

    async consume(params: {
        producerId: string;
        rtpCapabilities: any;
    }): Promise<mediasoup.types.Consumer> {
        return await this.transport.consume({
            producerId: params.producerId,
            rtpCapabilities: params.rtpCapabilities,
            paused: false,
        });
    }

    close() {
        this.transport.close();
    }

    getTransportParams(): ITransportWrapperParams {
        return {
            id: this.transport.id,
            iceParameters: this.transport.iceParameters,
            iceCandidates: this.transport.iceCandidates,
        };
    }
}
