import amqplib, { ChannelModel, Channel } from 'amqplib';
import logger from '../config/logger';

export interface RecordingCompletedEvent {
    meetingId: string;
    roomId: string;
    videoUrl: string;       // MinIO object URL (S3-compatible)
    videoBucket: string;    // MinIO bucket name
    videoKey: string;       // MinIO object key
    participants: Array<{
        user_email: string;
        integrations: {
            notion?: {
                access_token: string;
                workspace_id: string;
                database_id?: string;
            };
            google_calendar?: {
                access_token: string;
                refresh_token?: string;
                calendar_id?: string;
            };
        };
    }>;
}

const EXCHANGE_NAME = 'meetings';
const QUEUE_NAME = 'recording.completed';
const ROUTING_KEY = 'recording.completed';

class RabbitMQService {
    private connection: ChannelModel | null = null;
    private channel: Channel | null = null;
    private url: string;

    constructor() {
        this.url = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';
    }

    async connect(): Promise<void> {
        try {
            this.connection = await amqplib.connect(this.url);
            this.channel = await this.connection.createChannel();

            // Declare topic exchange
            await this.channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

            // Declare and bind queue
            await this.channel.assertQueue(QUEUE_NAME, { durable: true });
            await this.channel.bindQueue(QUEUE_NAME, EXCHANGE_NAME, ROUTING_KEY);

            logger.info('RabbitMQ connected and exchange/queue set up');

            // Handle connection errors
            this.connection.on('error', (err: any) => {
                logger.error('RabbitMQ connection error', { error: String(err) });
            });

            this.connection.on('close', () => {
                logger.warn('RabbitMQ connection closed');
            });
        } catch (error) {
            logger.error('Failed to connect to RabbitMQ', { error: String(error) });
            throw error;
        }
    }

    async publishRecordingComplete(data: RecordingCompletedEvent): Promise<void> {
        if (!this.channel) {
            throw new Error('RabbitMQ channel not available. Call connect() first.');
        }

        const message = Buffer.from(JSON.stringify(data));

        this.channel.publish(EXCHANGE_NAME, ROUTING_KEY, message, {
            persistent: true,
            contentType: 'application/json',
        });

        logger.info('Published recording.completed event', {
            meetingId: data.meetingId,
            roomId: data.roomId,
            participantCount: data.participants.length,
        });
    }

    async close(): Promise<void> {
        try {
            await this.channel?.close();
            await this.connection?.close();
            logger.info('RabbitMQ connection closed gracefully');
        } catch (error) {
            logger.error('Error closing RabbitMQ connection', { error: String(error) });
        }
    }
}

// Singleton
export const rabbitMQService = new RabbitMQService();
