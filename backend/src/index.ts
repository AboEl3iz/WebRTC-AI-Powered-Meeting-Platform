import { App } from "./app";
import http from 'http';
import { CustomConfig } from "./config/config";
import express, { Application } from "express";
import mongoose from 'mongoose';
import logger from './config/logger';

async function Bootstrap() {
    const _express: Application = express();
    const server = http.createServer(_express);
    const app = new App(_express, server);
    app.websockethandler();
    app.mediasoupworker();
    const config = new CustomConfig()

    const mongoUri = process.env.MONGO_URI || "mongodb://admin:password@localhost:27017/webrtc?authSource=admin";

    try {
        await mongoose.connect(mongoUri);
        logger.database.info("Connected to MongoDB");
    } catch (error) {
        logger.database.error("MongoDB connection error", { error: String(error) });
    }

    server.listen(config.port, () => {
        logger.info(`Server is running on port ${config.port}`);
    });
}

Bootstrap();