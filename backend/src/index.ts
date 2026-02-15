import { App } from "./app";
import http from 'http';
import { CustomConfig } from "./config/config";
import express, { Application } from "express";
import mongoose from 'mongoose';
import logger from './config/logger';
import { rabbitMQService } from './services/RabbitMQService';

async function Bootstrap() {
    const _express: Application = express();
    const server = http.createServer(_express);
    const app = new App(_express, server);
    app.websockethandler();
    app.mediasoupworker();
    const config = new CustomConfig()

    const mongoUri = process.env.MONGO_URI || "mongodb://root:example@localhost:27017/admin?authSource=admin";

    try {
        await mongoose.connect(mongoUri);
        logger.database.info("Connected to MongoDB");
    } catch (error) {
        logger.database.error("MongoDB connection error", { error: String(error) });
    }

    // Connect to RabbitMQ
    try {
        await rabbitMQService.connect();
        logger.info("RabbitMQ connected");
    } catch (error) {
        logger.error("RabbitMQ connection failed - AI pipeline events will not be published", { error: String(error) });
    }

    server.listen(config.port, () => {
        logger.info(`Server is running on port ${config.port}`);
    });

    // Graceful shutdown
    const shutdown = async () => {
        logger.info("Shutting down...");
        await rabbitMQService.close();
        await mongoose.disconnect();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

Bootstrap();
