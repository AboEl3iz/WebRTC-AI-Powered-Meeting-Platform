import { App } from "./app";
import http from 'http';
import { CustomConfig } from "./config/config";
import express, { Application } from "express";
import mongoose from 'mongoose';

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
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("MongoDB connection error:", error);
    }

    server.listen(config.port, () => {
        console.log(`Server is running on port ${config.port}`);
    });
}

Bootstrap();