import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import net from 'net';
import Meeting from '../../../models/Meeting';
import logger from '../../../config/logger';

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
    private meetingId: string | null = null;
    private outputPath: string | null = null;

    constructor(private roomId: string) {
        this.sdpPath = path.join(process.cwd(), `recordings/${this.roomId}.sdp`);
    }

    async start(router: any, videoProducer: any, audioProducer: any, participants: { name: string, email: string }[]) {
        const recordingsDir = path.join(process.cwd(), 'recordings');
        await fs.ensureDir(recordingsDir);

        // 0. Create Meeting entry in DB
        const meeting = new Meeting({
            roomId: this.roomId,
            participants,
            status: 'recording'
        });
        await meeting.save();
        this.meetingId = meeting.id;

        // 1. Get free ports for FFmpeg to listen on
        const videoPort = await getFreePort();
        const audioPort = await getFreePort();

        // 2. Create PlainTransports for Mediasoup to send RTP
        this.videoTransport = await router.createPlainTransport({
            listenIp: { ip: '127.0.0.1', announcedIp: null },
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

        // Extract SSRC from RTP parameters for proper stream identification
        const videoSsrc = this.videoConsumer.rtpParameters.encodings?.[0]?.ssrc;
        const audioSsrc = this.audioConsumer.rtpParameters.encodings?.[0]?.ssrc;

        const sdpContent = `
            v=0
            o=- 0 0 IN IP4 127.0.0.1
            s=Mediasoup Recording
            c=IN IP4 127.0.0.1
            t=0 0
            m=video ${videoPort} RTP/AVP ${videoPayloadType}
            a=rtpmap:${videoPayloadType} VP8/90000
            ${videoSsrc ? `a=ssrc:${videoSsrc} cname:mediasoup-video` : ''}
            m=audio ${audioPort} RTP/AVP ${audioPayloadType}
            a=rtpmap:${audioPayloadType} opus/48000/2
            a=fmtp:${audioPayloadType} minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1
            ${audioSsrc ? `a=ssrc:${audioSsrc} cname:mediasoup-audio` : ''}
            `.trim();

        await fs.writeFile(this.sdpPath, sdpContent);

        // 6. Spawn FFmpeg process
        this.outputPath = path.join(recordingsDir, `${this.roomId}_${Date.now()}.mp4`);

        this.ffmpegProcess = spawn('ffmpeg', [
            '-loglevel', 'debug',
            '-protocol_whitelist', 'file,rtp,udp',
            // Buffer and reorder settings for RTP streams
            '-reorder_queue_size', '500',
            '-max_delay', '500000',
            '-i', this.sdpPath,
            // Video: copy VP8 as is (for WebM compatibility)
            '-c:v', 'copy',
            // Audio: decode Opus and encode to AAC with proper settings
            '-c:a', 'aac',
            '-ar', '48000',           // Sample rate matching Opus source
            '-ac', '2',               // Stereo channels
            '-b:a', '128k',           // Audio bitrate for good quality
            '-af', 'aresample=async=1:first_pts=0', // Fix audio sync issues
            '-flags', '+global_header',
            '-movflags', '+faststart', // Enable streaming-friendly output
            '-y',
            this.outputPath
        ]);

        this.ffmpegProcess.stderr?.on('data', (data) => {
            logger.recording.debug("FFmpeg output", { roomId: this.roomId, output: data.toString().substring(0, 200) });
        });

        this.ffmpegProcess.on('close', async (code) => {
            logger.recording.info("FFmpeg process closed", { roomId: this.roomId, exitCode: code });

            // Update DB status
            if (this.meetingId) {
                await Meeting.findOneAndUpdate(
                    { id: this.meetingId },
                    { status: 'completed', videoPath: this.outputPath }
                );
            }

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
                logger.recording.info("FFmpeg successfully finished writing the file", { roomId: this.roomId });
                if (fs.existsSync(this.sdpPath)) {
                    fs.removeSync(this.sdpPath); // Clean up the SDP
                }
            });

            this.ffmpegProcess = null;
        }
    }
}