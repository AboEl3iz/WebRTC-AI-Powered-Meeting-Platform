import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
    })
);

// Custom format for file output
const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
);

// Create the logger instance
const logger = winston.createLogger({
    level: 'debug',
    transports: [
        // Console transport - all levels
        new winston.transports.Console({
            format: consoleFormat,
            level: 'debug'
        }),

        // Debug log file - debug and info level
        new winston.transports.File({
            filename: path.join(logsDir, 'debug.log'),
            format: fileFormat,
            level: 'debug',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),

        // Error log file - error and warn level only
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            format: fileFormat,
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
});

// Export convenience methods
export default {
    debug: (message: string, meta?: object) => logger.debug(message, meta),
    info: (message: string, meta?: object) => logger.info(message, meta),
    warn: (message: string, meta?: object) => logger.warn(message, meta),
    error: (message: string, meta?: object) => logger.error(message, meta),

    // Specialized loggers for different components
    signaling: {
        debug: (message: string, meta?: object) => logger.debug(`[Signaling] ${message}`, meta),
        info: (message: string, meta?: object) => logger.info(`[Signaling] ${message}`, meta),
        warn: (message: string, meta?: object) => logger.warn(`[Signaling] ${message}`, meta),
        error: (message: string, meta?: object) => logger.error(`[Signaling] ${message}`, meta)
    },

    media: {
        debug: (message: string, meta?: object) => logger.debug(`[Media] ${message}`, meta),
        info: (message: string, meta?: object) => logger.info(`[Media] ${message}`, meta),
        warn: (message: string, meta?: object) => logger.warn(`[Media] ${message}`, meta),
        error: (message: string, meta?: object) => logger.error(`[Media] ${message}`, meta)
    },

    recording: {
        debug: (message: string, meta?: object) => logger.debug(`[Recording] ${message}`, meta),
        info: (message: string, meta?: object) => logger.info(`[Recording] ${message}`, meta),
        warn: (message: string, meta?: object) => logger.warn(`[Recording] ${message}`, meta),
        error: (message: string, meta?: object) => logger.error(`[Recording] ${message}`, meta)
    },

    http: {
        debug: (message: string, meta?: object) => logger.debug(`[HTTP] ${message}`, meta),
        info: (message: string, meta?: object) => logger.info(`[HTTP] ${message}`, meta),
        warn: (message: string, meta?: object) => logger.warn(`[HTTP] ${message}`, meta),
        error: (message: string, meta?: object) => logger.error(`[HTTP] ${message}`, meta)
    },

    database: {
        debug: (message: string, meta?: object) => logger.debug(`[Database] ${message}`, meta),
        info: (message: string, meta?: object) => logger.info(`[Database] ${message}`, meta),
        warn: (message: string, meta?: object) => logger.warn(`[Database] ${message}`, meta),
        error: (message: string, meta?: object) => logger.error(`[Database] ${message}`, meta)
    },

    websocket: {
        debug: (message: string, meta?: object) => logger.debug(`[WebSocket] ${message}`, meta),
        info: (message: string, meta?: object) => logger.info(`[WebSocket] ${message}`, meta),
        warn: (message: string, meta?: object) => logger.warn(`[WebSocket] ${message}`, meta),
        error: (message: string, meta?: object) => logger.error(`[WebSocket] ${message}`, meta)
    }
};
