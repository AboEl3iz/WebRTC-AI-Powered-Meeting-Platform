import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

export class Recorder {
    private ffmpegProcess: ChildProcess | null = null;
    private sdpPath: string;

    constructor(private roomId: string) {
        this.sdpPath = path.join(__dirname, `../../recordings/${this.roomId}.sdp`);
    }

    async start(router: any, videoProducer: any, audioProducer: any) {
        // 1. Create PlainTransport for FFmpeg to "join" the room
        const transport = await router.createPlainTransport({
            listenIp: '127.0.0.1', // Internal communication within WSL
            rtcpMux: true,
            comedia: false
        });

        // 2. Create consumers for the tracks you want to record
        const videoConsumer = await transport.consume({ producerId: videoProducer.id, rtpCapabilities: router.rtpCapabilities });
        const audioConsumer = await transport.consume({ producerId: audioProducer.id, rtpCapabilities: router.rtpCapabilities });

        // 3. Generate the SDP file so FFmpeg knows how to read the RTP packets
        const sdpContent = `
        v=0
        o=- 0 0 IN IP4 127.0.0.1
        s=Mediasoup Recording
        c=IN IP4 127.0.0.1
        t=0 0
        m=video ${transport.tuple.localPort} RTP/AVP ${videoConsumer.rtpParameters.codecs[0].payloadType}
        a=rtpmap:${videoConsumer.rtpParameters.codecs[0].payloadType} VP8/90000
        m=audio ${transport.tuple.localPort} RTP/AVP ${audioConsumer.rtpParameters.codecs[0].payloadType}
        a=rtpmap:${audioConsumer.rtpParameters.codecs[0].payloadType} opus/48000/2
        `.trim();

        await fs.ensureDir(path.dirname(this.sdpPath));
        await fs.writeFile(this.sdpPath, sdpContent);

        // 4. Spawn FFmpeg process
        const outputPath = path.join(__dirname, `../../recordings/${this.roomId}_${Date.now()}.mp4`);

        this.ffmpegProcess = spawn('ffmpeg', [
            '-protocol_whitelist', 'file,rtp,udp',
            '-i', this.sdpPath,
            '-c:v', 'copy', // 'copy' saves CPU by not re-encoding the video
            '-c:a', 'aac',  // Convert opus audio to aac for mp4 compatibility
            '-flags', '+global_header',
            outputPath
        ]);

        this.ffmpegProcess.stderr?.on('data', (data) => console.log(`FFmpeg Log: ${data}`));
    }

    stop() {
        if (this.ffmpegProcess) {
            this.ffmpegProcess.kill('SIGINT'); // Send interrupt signal to save the file correctly
            this.ffmpegProcess = null;
            fs.removeSync(this.sdpPath); // Clean up the temporary SDP file
        }
    }
}