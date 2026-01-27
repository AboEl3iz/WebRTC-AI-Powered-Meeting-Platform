import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import net from 'net';

async function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on('error', reject);
        server.listen(0, () => {
            const address = server.address();
            const port = typeof address === 'string' ? 0 : address?.port || 0;
            server.close(() => resolve(port));
        });
    });
}

export class Recorder {
    private ffmpegProcess: ChildProcess | null = null;
    private sdpPath: string;
    private videoTransport: any;
    private audioTransport: any;
    private videoConsumer: any;
    private audioConsumer: any;

    constructor(private roomId: string) {
        this.sdpPath = path.join(process.cwd(), `recordings/${this.roomId}.sdp`);
    }

    async start(router: any, videoProducer: any, audioProducer: any) {
        const recordingsDir = path.join(process.cwd(), 'recordings');
        await fs.ensureDir(recordingsDir);

        // 1. Get free ports for FFmpeg to listen on
        const videoPort = await getFreePort();
        const audioPort = await getFreePort();

        // 2. Create PlainTransports for Mediasoup to send RTP
        this.videoTransport = await router.createPlainTransport({
            listenIp: '127.0.0.1',
            rtcpMux: true,
            comedia: false
        });

        this.audioTransport = await router.createPlainTransport({
            listenIp: '127.0.0.1',
            rtcpMux: true,
            comedia: false
        });

        // 3. Connect transports to the ports FFmpeg will listen on
        await this.videoTransport.connect({
            ip: '127.0.0.1',
            port: videoPort,
        });

        await this.audioTransport.connect({
            ip: '127.0.0.1',
            port: audioPort,
        });

        // 4. Create consumers
        this.videoConsumer = await this.videoTransport.consume({
            producerId: videoProducer.id,
            rtpCapabilities: router.rtpCapabilities,
            paused: false
        });

        this.audioConsumer = await this.audioTransport.consume({
            producerId: audioProducer.id,
            rtpCapabilities: router.rtpCapabilities,
            paused: false
        });

        // 5. Generate SDP file
        const videoPayloadType = this.videoConsumer.rtpParameters.codecs[0].payloadType;
        const audioPayloadType = this.audioConsumer.rtpParameters.codecs[0].payloadType;

        const sdpContent = `
            v=0
            o=- 0 0 IN IP4 127.0.0.1
            s=Mediasoup Recording
            c=IN IP4 127.0.0.1
            t=0 0
            m=video ${videoPort} RTP/AVP ${videoPayloadType}
            a=rtpmap:${videoPayloadType} VP8/90000
            m=audio ${audioPort} RTP/AVP ${audioPayloadType}
            a=rtpmap:${audioPayloadType} opus/48000/2
        `.trim();

        await fs.writeFile(this.sdpPath, sdpContent);

        // 6. Spawn FFmpeg process
        const outputPath = path.join(recordingsDir, `${this.roomId}_${Date.now()}.mp4`);

        this.ffmpegProcess = spawn('ffmpeg', [
            '-loglevel', 'debug',
            '-protocol_whitelist', 'file,rtp,udp',
            '-i', this.sdpPath,
            '-c:v', 'copy', // Copy VP8 as is
            '-c:a', 'aac',  // Convert opus to aac for mp4
            '-flags', '+global_header',
            '-y',
            outputPath
        ]);

        this.ffmpegProcess.stderr?.on('data', (data) => console.log(`FFmpeg [${this.roomId}]: ${data}`));

        this.ffmpegProcess.on('close', (code) => {
            console.log(`FFmpeg process for room ${this.roomId} closed with code ${code}`);
            this.cleanup();
        });
    }

    private cleanup() {
        if (this.videoConsumer) this.videoConsumer.close();
        if (this.audioConsumer) this.audioConsumer.close();
        if (this.videoTransport) this.videoTransport.close();
        if (this.audioTransport) this.audioTransport.close();
        if (fs.existsSync(this.sdpPath)) {
            fs.removeSync(this.sdpPath);
        }
    }

    stop() {
       if (this.ffmpegProcess) {
        // Use SIGINT to allow FFmpeg to finish writing file headers
        this.ffmpegProcess.kill('SIGINT'); 
        
        this.ffmpegProcess.on('exit', () => {
            console.log('💾 FFmpeg successfully finished writing the file.');
            if (fs.existsSync(this.sdpPath)) {
                fs.removeSync(this.sdpPath); // Clean up the SDP
            }
        });
        
        this.ffmpegProcess = null;
    }
    }
}