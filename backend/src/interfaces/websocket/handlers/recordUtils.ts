/**
 * Utility functions for composite recording
 * Handles grid layout calculations, FFmpeg filter generation, and SDP creation
 */

export interface GridLayout {
    rows: number;
    cols: number;
    cellWidth: number;
    cellHeight: number;
    outputWidth: number;
    outputHeight: number;
}

/**
 * Calculate optimal grid layout for given number of participants
 * @param participantCount Number of participants to arrange in grid
 * @param maxWidth Maximum width of output video (default: 1920 for 1080p)
 * @param maxHeight Maximum height of output video (default: 1080 for 1080p)
 * @returns Grid layout configuration
 */
export function calculateGrid(
    participantCount: number,
    maxWidth: number = 1920,
    maxHeight: number = 1080
): GridLayout {
    if (participantCount === 1) {
        return {
            rows: 1,
            cols: 1,
            cellWidth: maxWidth,
            cellHeight: maxHeight,
            outputWidth: maxWidth,
            outputHeight: maxHeight
        };
    }

    // Calculate cols and rows to create a roughly square grid
    const cols = Math.ceil(Math.sqrt(participantCount));
    const rows = Math.ceil(participantCount / cols);

    const cellWidth = Math.floor(maxWidth / cols);
    const cellHeight = Math.floor(maxHeight / rows);

    return {
        rows,
        cols,
        cellWidth,
        cellHeight,
        outputWidth: cellWidth * cols,
        outputHeight: cellHeight * rows
    };
}

/**
 * Generate FFmpeg filter_complex string for video grid composition
 * @param participantCount Number of video streams
 * @param grid Grid layout configuration
 * @returns FFmpeg filter_complex string
 */
export function generateVideoFilter(participantCount: number, grid: GridLayout): string {
    if (participantCount === 1) {
        // Single participant - just scale to output size
        return `[0:0]scale=${grid.outputWidth}:${grid.outputHeight},setpts=PTS-STARTPTS[vout]`;
    }

    const filters: string[] = [];

    // Scale and normalize each video stream
    // Streams are organized as: video0, audio0, video1, audio1, video2, audio2, ...
    for (let i = 0; i < participantCount; i++) {
        const streamIndex = i * 2; // 0, 2, 4, 6, ... (video streams)
        filters.push(
            `[0:${streamIndex}]scale=${grid.cellWidth}:${grid.cellHeight},setpts=PTS-STARTPTS[v${i}]`
        );
    }

    // Build grid using hstack and vstack
    const rows: string[] = [];

    for (let row = 0; row < grid.rows; row++) {
        const startIdx = row * grid.cols;
        const endIdx = Math.min(startIdx + grid.cols, participantCount);
        const cellsInRow = endIdx - startIdx;

        if (cellsInRow === 1) {
            // Single cell in row - pad to full width
            const cellIdx = startIdx;
            filters.push(`[v${cellIdx}]pad=${grid.outputWidth}:${grid.cellHeight}[row${row}]`);
            rows.push(`[row${row}]`);
        } else if (cellsInRow === grid.cols) {
            // Full row
            const inputs = [];
            for (let col = 0; col < cellsInRow; col++) {
                inputs.push(`[v${startIdx + col}]`);
            }
            filters.push(`${inputs.join('')}hstack=inputs=${cellsInRow}[row${row}]`);
            rows.push(`[row${row}]`);
        } else {
            // Partial row - pad to match full row width
            const inputs = [];
            for (let col = 0; col < cellsInRow; col++) {
                inputs.push(`[v${startIdx + col}]`);
            }
            const rowWidth = grid.cellWidth * cellsInRow;
            filters.push(`${inputs.join('')}hstack=inputs=${cellsInRow}[row${row}_tmp]`);
            filters.push(`[row${row}_tmp]pad=${grid.outputWidth}:${grid.cellHeight}[row${row}]`);
            rows.push(`[row${row}]`);
        }
    }

    // Stack rows vertically
    if (rows.length === 1) {
        filters.push(`${rows[0]}copy[vout]`);
    } else {
        filters.push(`${rows.join('')}vstack=inputs=${rows.length}[vout]`);
    }

    return filters.join('; ');
}

/**
 * Generate FFmpeg filter_complex string for audio mixing
 * @param participantCount Number of audio streams
 * @param startInputIndex Not used - kept for backwards compatibility
 * @returns FFmpeg filter_complex string
 */
export function generateAudioFilter(participantCount: number, startInputIndex: number): string {
    if (participantCount === 1) {
        return `[0:1]anull[aout]`; // Stream 0:1 is the first audio stream
    }

    const inputs = [];
    // Audio streams are at indices 1, 3, 5, 7, ... (after each video stream)
    for (let i = 0; i < participantCount; i++) {
        const streamIndex = i * 2 + 1; // 1, 3, 5, 7, ... (audio streams)
        inputs.push(`[0:${streamIndex}]`);
    }

    // Mix all audio streams with normalization disabled (we'll handle levels manually)
    return `${inputs.join('')}amix=inputs=${participantCount}:duration=longest:dropout_transition=2:normalize=0,volume=${1.0 / Math.sqrt(participantCount)}[aout]`;
}

/**
 * Generate SDP content for a single media stream (video or audio)
 * @param port RTP port
 * @param payloadType RTP payload type
 * @param codecName Codec name (e.g., 'VP8', 'opus')
 * @param clockRate Clock rate (e.g., 90000 for video, 48000 for audio)
 * @param ssrc SSRC identifier
 * @param mediaType 'video' or 'audio'
 * @param channels Number of audio channels (only for audio)
 * @returns SDP media section
 */
export function generateSDPSection(
    port: number,
    payloadType: number,
    codecName: string,
    clockRate: number,
    ssrc: number | undefined,
    mediaType: 'video' | 'audio',
    channels?: number
): string {
    const lines = [
        `m=${mediaType} ${port} RTP/AVP ${payloadType}`,
        `a=rtpmap:${payloadType} ${codecName}/${clockRate}${channels ? `/${channels}` : ''}`
    ];

    // Add format-specific parameters
    if (mediaType === 'audio' && codecName.toLowerCase() === 'opus') {
        lines.push(`a=fmtp:${payloadType} minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1`);
    }

    // Add SSRC if available
    if (ssrc) {
        lines.push(`a=ssrc:${ssrc} cname:mediasoup-${mediaType}`);
    }

    return lines.join('\n');
}

/**
 * Generate complete SDP file content for multiple streams
 * @param streams Array of stream configurations
 * @returns Complete SDP content
 */
export function generateCompleteSDP(streams: Array<{
    port: number;
    payloadType: number;
    codecName: string;
    clockRate: number;
    ssrc: number | undefined;
    mediaType: 'video' | 'audio';
    channels?: number;
}>): string {
    const header = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=Mediasoup Composite Recording
c=IN IP4 127.0.0.1
t=0 0`;

    const mediaSections = streams.map(stream =>
        generateSDPSection(
            stream.port,
            stream.payloadType,
            stream.codecName,
            stream.clockRate,
            stream.ssrc,
            stream.mediaType,
            stream.channels
        )
    );

    return [header, ...mediaSections].join('\n');
}

/**
 * Generate FFmpeg arguments for composite recording
 * @param inputSDPs Array of SDP file paths
 * @param outputPath Output file path
 * @param participantCount Number of participants
 * @param grid Grid layout configuration
 * @returns FFmpeg command arguments
 */
export function generateFFmpegArgs(
    inputSDPs: string[],
    outputPath: string,
    participantCount: number,
    grid: GridLayout
): string[] {
    // We have participantCount participants, each with video and audio
    const videoCount = participantCount;
    const audioCount = participantCount;

    const videoFilter = generateVideoFilter(videoCount, grid);
    const audioFilter = generateAudioFilter(audioCount, videoCount);
    const filterComplex = `${videoFilter}; ${audioFilter}`;

    const args = [
        '-loglevel', 'debug',
        '-protocol_whitelist', 'file,rtp,udp',
        // Handle missing/corrupt packets
        '-fflags', '+genpts+discardcorrupt+igndts',
        // INCREASED buffers for network jitter and packet loss prevention
        '-reorder_queue_size', '10000',     // Increased from 5000
        '-max_delay', '20000000',           // Increased from 5000000 (20 seconds)
        // Stream detection
        '-analyzeduration', '20000000',     // Increased from 10000000
        '-probesize', '20000000',           // Increased from 10000000
        // Receive buffer - SIGNIFICANTLY INCREASED
        '-rtbufsize', '200M',               // Increased from 50M
        // Additional buffering
        '-thread_queue_size', '4096'        // Add thread queue for better buffering
    ];

    // Add all input SDP files
    inputSDPs.forEach(sdp => {
        args.push('-i', sdp);
    });

    // Add filter complex
    args.push(
        '-filter_complex', filterComplex,
        // Map outputs
        '-map', '[vout]',
        '-map', '[aout]',
        // Video encoding
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'ultrafast',    // Fast encoding for real-time
        '-tune', 'zerolatency',    // Low latency
        '-crf', '23',              // Quality (lower = better, 18-28 is good range)
        '-g', '60',                // Keyframe interval (2 seconds at 30fps)
        '-sc_threshold', '0',      // Disable scene change detection
        // Audio encoding - optimized for AI transcription
        '-c:a', 'aac',
        '-ar', '48000',            // 48kHz sample rate (high quality for Whisper)
        '-ac', '2',                // Stereo
        '-b:a', '192k',            // High bitrate for clarity
        // MP4 settings
        '-flags', '+global_header',
        '-movflags', '+faststart',
        '-y',                      // Overwrite output file
        outputPath
    );

    return args;
}
