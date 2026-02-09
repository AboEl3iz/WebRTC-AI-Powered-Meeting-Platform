import { spawn, ChildProcess } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import net from 'net';
import Meeting from '../../../models/Meeting';
import logger from '../../../config/logger';
import {
    calculateGrid,
    generateCompleteSDP,
    generateFFmpegArgs
} from './recordUtils';

import type * as mediasoup from 'mediasoup';
type Producer = mediasoup.types.Producer;
type Router = mediasoup.types.Router;

// Helper function for async delay
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
        // @ts-ignore - globalThis timer functions
        (globalThis as any).setTimeout(resolve, ms);
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

export interface ProducerInfo {
    userId: string;
    name: string;
    video: Producer | undefined;
    audio: Producer | undefined;
}

/**
 * Composite Recorder - Records all participants in a grid layout with mixed audio
 * Similar to Zoom's recording functionality
 */
export class Recorder {
    private ffmpegProcess: ChildProcess | null = null;
    private sdpPaths: string[] = [];
    private videoTransports: Map<string, any> = new Map(); // userId -> transport
    private audioTransports: Map<string, any> = new Map(); // userId -> transport
    private videoConsumers: Map<string, any> = new Map();  // userId -> consumer
    private audioConsumers: Map<string, any> = new Map();  // userId -> consumer
    private meetingId: string | null = null;
    private outputPath: string | null = null;

    constructor(private roomId: string) { }

    async start(
        router: Router,
        producersInfo: ProducerInfo[],
        participants: { name: string, email: string }[]
    ) {
        const recordingsDir = path.join(process.cwd(), 'recordings');
        await fs.ensureDir(recordingsDir);

        logger.recording.info("Starting composite recorder", {
            roomId: this.roomId,
            participantCount: producersInfo.length,
            participants: producersInfo.map(p => ({ userId: p.userId, name: p.name }))
        });

        // Filter out participants without both video and audio
        const validProducers = producersInfo.filter(p => p.video && p.audio);

        if (validProducers.length === 0) {
            throw new Error("No valid producers found (need both video and audio)");
        }

        // 1. Create Meeting entry in DB
        const meeting = new Meeting({
            roomId: this.roomId,
            participants,
            status: 'recording'
        });
        await meeting.save();
        this.meetingId = meeting.id;

        // 2. Calculate grid layout
        const grid = calculateGrid(validProducers.length);
        logger.recording.info("Grid layout calculated", {
            participantCount: validProducers.length,
            grid
        });

        // 3. Create transports and consumers for each participant
        const sdpStreams: Array<{
            port: number;
            payloadType: number;
            codecName: string;
            clockRate: number;
            ssrc: number | undefined;
            mediaType: 'video' | 'audio';
            channels?: number;
        }> = [];

        for (const producerInfo of validProducers) {
            const { userId, name, video, audio } = producerInfo;

            if (!video || !audio) continue;

            logger.recording.debug("Setting up transports for user", { userId, name });

            // Get free ports for this participant
            const videoPort = await getFreePort();
            const audioPort = await getFreePort();

            // Create Plain Transports
            const videoTransport = await router.createPlainTransport({
                listenIp: { ip: '127.0.0.1', announcedIp: null },
                rtcpMux: true,
                comedia: false
            });

            const audioTransport = await router.createPlainTransport({
                listenIp: '127.0.0.1',
                rtcpMux: true,
                comedia: false
            });

            // Connect transports
            await videoTransport.connect({
                ip: '127.0.0.1',
                port: videoPort,
            });

            await audioTransport.connect({
                ip: '127.0.0.1',
                port: audioPort,
            });

            this.videoTransports.set(userId, videoTransport);
            this.audioTransports.set(userId, audioTransport);

            // Create consumers (PAUSED)
            const videoConsumer = await videoTransport.consume({
                producerId: video.id,
                rtpCapabilities: router.rtpCapabilities,
                paused: true
            });

            const audioConsumer = await audioTransport.consume({
                producerId: audio.id,
                rtpCapabilities: router.rtpCapabilities,
                paused: true
            });

            this.videoConsumers.set(userId, videoConsumer);
            this.audioConsumers.set(userId, audioConsumer);

            logger.recording.debug("Consumers created (paused)", {
                userId,
                videoConsumerId: videoConsumer.id,
                audioConsumerId: audioConsumer.id
            });

            // Extract codec info for SDP
            const videoCodecInfo = videoConsumer.rtpParameters.codecs[0];
            const audioCodecInfo = audioConsumer.rtpParameters.codecs[0];

            const videoSsrc = videoConsumer.rtpParameters.encodings?.[0]?.ssrc;
            const audioSsrc = audioConsumer.rtpParameters.encodings?.[0]?.ssrc;

            // Add video stream info
            sdpStreams.push({
                port: videoPort,
                payloadType: videoCodecInfo.payloadType,
                codecName: videoCodecInfo.mimeType.split('/')[1],
                clockRate: videoCodecInfo.clockRate,
                ssrc: videoSsrc,
                mediaType: 'video'
            });

            // Add audio stream info
            sdpStreams.push({
                port: audioPort,
                payloadType: audioCodecInfo.payloadType,
                codecName: audioCodecInfo.mimeType.split('/')[1],
                clockRate: audioCodecInfo.clockRate,
                ssrc: audioSsrc,
                mediaType: 'audio',
                channels: 2
            });
        }

        // 5. Generate SDP file
        const sdpContent = generateCompleteSDP(sdpStreams);
        const timestamp = Date.now();
        const sdpPath = path.join(recordingsDir, `${this.roomId}_${timestamp}.sdp`);
        await fs.writeFile(sdpPath, sdpContent);
        this.sdpPaths.push(sdpPath);

        logger.recording.debug("SDP file created", { sdpPath });

        // 6. Generate FFmpeg arguments
        this.outputPath = path.join(recordingsDir, `${this.roomId}_${timestamp}.mp4`);
        const ffmpegArgs = generateFFmpegArgs(
            [sdpPath],
            this.outputPath!,  // Non-null assertion - we just set it above
            validProducers.length,
            grid
        );

        logger.recording.debug("FFmpeg command prepared", {
            args: ffmpegArgs.join(' ')
        });

        // 6. Start FFmpeg
        logger.recording.info("Spawning FFmpeg process", {
            roomId: this.roomId,
            command: 'ffmpeg',
            args: ffmpegArgs
        });

        try {
            this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

            logger.recording.info("FFmpeg process spawned successfully", {
                roomId: this.roomId,
                pid: this.ffmpegProcess.pid
            });

            // Capture stdout
            // @ts-ignore - Node.js Buffer type
            this.ffmpegProcess.stdout?.on('data', (data) => {
                logger.recording.debug("FFmpeg stdout", {
                    roomId: this.roomId,
                    output: data.toString()
                });
            });

            this.ffmpegProcess.stderr?.on('data', (data) => {
                const output = data.toString();
                logger.recording.debug("FFmpeg stderr", {
                    roomId: this.roomId,
                    output: output.substring(0, 500)
                });

                // Check for errors in FFmpeg output
                if (output.toLowerCase().includes('error')) {
                    logger.recording.warn("FFmpeg error detected", {
                        roomId: this.roomId,
                        output
                    });
                }
            });
        } catch (spawnError) {
            logger.recording.error("Failed to spawn FFmpeg process", {
                roomId: this.roomId,
                error: spawnError instanceof Error ? spawnError.message : String(spawnError),
                stack: spawnError instanceof Error ? spawnError.stack : undefined
            });
            throw new Error(`Failed to spawn FFmpeg: ${spawnError instanceof Error ? spawnError.message : String(spawnError)}`);
        }

        this.ffmpegProcess.on('error', (error: Error) => {
            logger.recording.error("FFmpeg process error", {
                roomId: this.roomId,
                error: error.message
            });
        });

        // 7. Wait for FFmpeg to be ready
        await delay(1000);  // Increased delay for stability
        logger.recording.info("FFmpeg started, resuming consumers", { roomId: this.roomId });

        // 8. Resume all consumers
        const resumePromises: Promise<void>[] = [];

        this.videoConsumers.forEach((consumer, userId) => {
            resumePromises.push(consumer.resume());
            logger.recording.debug("Resuming video consumer", { userId, consumerId: consumer.id });
        });

        this.audioConsumers.forEach((consumer, userId) => {
            resumePromises.push(consumer.resume());
            logger.recording.debug("Resuming audio consumer", { userId, consumerId: consumer.id });
        });

        await Promise.all(resumePromises);

        // 9. Request keyframes for all video consumers
        const keyframePromises: Promise<void>[] = [];
        this.videoConsumers.forEach((consumer) => {
            keyframePromises.push(consumer.requestKeyFrame());
        });
        await Promise.all(keyframePromises);

        logger.recording.info("Composite recording started successfully", {
            roomId: this.roomId,
            participantCount: validProducers.length,
            outputPath: this.outputPath
        });

        // 10. Set up periodic keyframe requests (every 2 seconds)
        // @ts-ignore - globalThis timer functions
        const keyframeIntervalId = (globalThis as any).setInterval(() => {
            this.videoConsumers.forEach((consumer) => {
                consumer.requestKeyFrame().catch((err: Error) => {
                    logger.recording.warn("Failed to request keyframe", {
                        consumerId: consumer.id,
                        error: err.message
                    });
                });
            });
        }, 2000);

        // 11. Handle FFmpeg close
        this.ffmpegProcess.on('close', async (code: number | null) => {
            // @ts-ignore - globalThis timer functions
            (globalThis as any).clearInterval(keyframeIntervalId);
            logger.recording.info("FFmpeg process closed", {
                roomId: this.roomId,
                exitCode: code
            });

            // Update DB status
            if (this.meetingId) {
                if (this.outputPath) {
                    await Meeting.findOneAndUpdate(
                        { id: this.meetingId },
                        { status: 'completed', videoPath: this.outputPath }
                    );
                }
            }

            this.cleanup();
        });
    }

    private cleanup() {
        // Close all consumers
        this.videoConsumers.forEach((consumer) => {
            if (!consumer.closed) consumer.close();
        });
        this.audioConsumers.forEach((consumer) => {
            if (!consumer.closed) consumer.close();
        });

        // Close all transports
        this.videoTransports.forEach((transport) => {
            if (!transport.closed) transport.close();
        });
        this.audioTransports.forEach((transport) => {
            if (!transport.closed) transport.close();
        });

        // Clean up SDP files
        this.sdpPaths.forEach((sdpPath) => {
            if (fs.existsSync(sdpPath)) {
                fs.removeSync(sdpPath);
            }
        });

        logger.recording.info("Recorder cleanup completed", { roomId: this.roomId });
    }

    stop() {
        if (this.ffmpegProcess) {
            logger.recording.info("Stopping recording", { roomId: this.roomId });

            // Use SIGINT to allow FFmpeg to finish writing file headers
            this.ffmpegProcess.kill('SIGINT');

            this.ffmpegProcess.on('exit', () => {
                logger.recording.info("FFmpeg successfully finished writing the file", {
                    roomId: this.roomId
                });
            });

            this.ffmpegProcess = null;
        }
    }
}