import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import fs from 'fs-extra';
import path from 'path';
import logger from '../config/logger';

const BUCKET_NAME = process.env.MINIO_BUCKET || 'recordings';

class MinioService {
    private client: S3Client;
    private bucket: string;
    private endpoint: string;
    private bucketEnsured = false;

    constructor() {
        this.endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
        this.bucket = BUCKET_NAME;

        this.client = new S3Client({
            endpoint: this.endpoint,
            region: 'us-east-1',    // MinIO doesn't care, but SDK requires it
            credentials: {
                accessKeyId: process.env.MINIO_ACCESS_KEY || 'karim123',
                secretAccessKey: process.env.MINIO_SECRET_KEY || 'karim123',
            },
            forcePathStyle: true,   // Required for MinIO (not virtual-hosted buckets)
        });
    }

    /**
     * Ensure the bucket exists, creating it if necessary.
     * Only runs once (first upload).
     */
    async ensureBucket(): Promise<void> {
        if (this.bucketEnsured) return;

        try {
            await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
            logger.info(`MinIO bucket '${this.bucket}' exists`);
        } catch (err: any) {
            // Bucket doesn't exist — create it
            try {
                await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
                logger.info(`MinIO bucket '${this.bucket}' created`);
            } catch (createErr: any) {
                // Bucket may have been created between the head and create calls
                if (createErr.name !== 'BucketAlreadyOwnedByYou' && createErr.name !== 'BucketAlreadyExists') {
                    throw createErr;
                }
            }
        }

        this.bucketEnsured = true;
    }

    /**
     * Upload a local file to MinIO and return the object key + URL
     */
    async uploadRecording(filePath: string, roomId: string): Promise<{ key: string; url: string; bucket: string }> {
        await this.ensureBucket();

        const fileName = path.basename(filePath);
        const key = `recordings/${roomId}/${fileName}`;

        const fileStream = fs.createReadStream(filePath);
        const fileStats = await fs.stat(filePath);

        try {
            await this.client.send(new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: fileStream,
                ContentLength: fileStats.size,
                ContentType: 'video/mp4',
            }));

            const url = `${this.endpoint}/${this.bucket}/${key}`;

            logger.info('Uploaded recording to MinIO', {
                key,
                bucket: this.bucket,
                size: fileStats.size,
                url,
            });

            return { key, url, bucket: this.bucket };
        } catch (error) {
            logger.error('Failed to upload recording to MinIO', {
                filePath,
                key,
                error: String(error),
            });
            throw error;
        }
    }

    /**
     * Get the S3 client (for cases where direct access is needed)
     */
    getClient(): S3Client {
        return this.client;
    }

    getBucket(): string {
        return this.bucket;
    }
}

// Singleton
export const minioService = new MinioService();

