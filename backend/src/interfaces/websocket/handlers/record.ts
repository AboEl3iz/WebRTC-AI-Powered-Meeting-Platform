import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import net from 'net';
import Meeting from '../../../models/Meeting';
import logger from '../../../config/logger';

// Helper function for async delay
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        (global as NodeJS.Global).setTimeout(resolve, ms);
    });
}

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

        // Debug: Verify producers are valid and active
        logger.recording.info("Starting recorder with producers", {
            roomId: this.roomId,
            videoProducerId: videoProducer?.id,
            audioProducerId: audioProducer?.id,
            videoProducerPaused: videoProducer?.paused,
            audioProducerPaused: audioProducer?.paused,
            videoProducerClosed: videoProducer?.closed,
            audioProducerClosed: audioProducer?.closed,
            videoProducerKind: videoProducer?.kind,
            audioProducerKind: audioProducer?.kind
        });

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

        // 4. Create consumers (PAUSED - don't start sending yet)
        this.videoConsumer = await this.videoTransport.consume({
            producerId: videoProducer.id,
            rtpCapabilities: router.rtpCapabilities,
            paused: true  // Keep paused until FFmpeg is ready
        });

        this.audioConsumer = await this.audioTransport.consume({
            producerId: audioProducer.id,
            rtpCapabilities: router.rtpCapabilities,
            paused: true  // Keep paused until FFmpeg is ready
        });

        logger.recording.info("Consumers created (paused)", {
            roomId: this.roomId,
            videoConsumerId: this.videoConsumer.id,
            audioConsumerId: this.audioConsumer.id
        });

        // 5. Generate SDP file BEFORE starting FFmpeg
        const videoCodecInfo = this.videoConsumer.rtpParameters.codecs[0];
        const videoPayloadType = videoCodecInfo.payloadType;
        const videoCodecName = videoCodecInfo.mimeType.split('/')[1]; // e.g., 'VP8', 'H264'
        const videoClockRate = videoCodecInfo.clockRate;

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
a=rtpmap:${videoPayloadType} ${videoCodecName}/${videoClockRate}
${videoSsrc ? `a=ssrc:${videoSsrc} cname:mediasoup-video` : ''}
m=audio ${audioPort} RTP/AVP ${audioPayloadType}
a=rtpmap:${audioPayloadType} opus/48000/2
a=fmtp:${audioPayloadType} minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1
${audioSsrc ? `a=ssrc:${audioSsrc} cname:mediasoup-audio` : ''}
`.trim();

        await fs.writeFile(this.sdpPath, sdpContent);

        // 6. Start FFmpeg FIRST so it's listening on the ports
        this.outputPath = path.join(recordingsDir, `${this.roomId}_${Date.now()}.mp4`);

        this.ffmpegProcess = spawn('ffmpeg', [
            '-loglevel', 'debug',
            '-protocol_whitelist', 'file,rtp,udp',
            // Generate timestamps and handle corrupt/missing packets
            '-fflags', '+genpts+discardcorrupt+igndts',
            // Large buffers for RTP jitter and reordering
            '-reorder_queue_size', '5000',
            '-max_delay', '5000000',
            // Longer analysis for detecting streams
            '-analyzeduration', '10000000',
            '-probesize', '10000000',
            // Receive buffer size for UDP
            '-rtbufsize', '50M',
            '-i', this.sdpPath,
            // Use optional stream mapping (? means don't fail if stream is missing)
            '-map', '0:v?',
            '-map', '0:a?',
            // Video: Transcode to H.264 for MP4 compatibility
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p',
            '-preset', 'ultrafast',   // Faster encoding, less CPU
            '-tune', 'zerolatency',   // Better for real-time streams
            '-crf', '23',
            // Audio: decode Opus and encode to AAC with proper settings
            '-c:a', 'aac',
            '-ar', '48000',
            '-ac', '2',
            '-b:a', '128k',
            '-flags', '+global_header',
            '-movflags', '+faststart',
            '-y',
            this.outputPath
        ]);

        this.ffmpegProcess.stderr?.on('data', (data) => {
            logger.recording.debug("FFmpeg output", { roomId: this.roomId, output: data.toString().substring(0, 200) });
        });

        // 7. Wait for FFmpeg to be ready (listening on UDP ports)
        await delay(500);
        logger.recording.info("FFmpeg started, now resuming consumers", { roomId: this.roomId });

        // 8. NOW resume consumers so RTP packets start flowing to FFmpeg
        await this.videoConsumer.resume();
        await this.audioConsumer.resume();

        // 9. Request a keyframe so FFmpeg can start decoding video
        await this.videoConsumer.requestKeyFrame();
        logger.recording.info("Consumers resumed and keyframe requested", {
            roomId: this.roomId,
            videoConsumerPaused: this.videoConsumer.paused,
            audioConsumerPaused: this.audioConsumer.paused
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