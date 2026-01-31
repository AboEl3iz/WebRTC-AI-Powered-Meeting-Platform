import express, { Application } from "express";
import { WebSocketServer } from "./interfaces/websocket/socketServer"
import { Server as HTTPServer } from 'http';
import { MediasoupWorkerManager } from "./media/MediasoupWorkerManager";
import { MediaRoomWrapper } from "./media/MediaRoomWrapper";
import { TransportWrapper } from "./media/TransportWrapper";
import { RoomController } from "./interfaces/http/controllers/RoomController";
import { RoomService } from "./services/RoomService";

export class App {
    private _app: Application;
    private _server: HTTPServer
    private _roomService: RoomService;

    constructor(app: Application, server: HTTPServer) {
        this._app = app;
        this._roomService = new RoomService();
        this.setMiddlewares();
        this.setRouters();
        this._server = server;

    }



    private setMiddlewares(): void {
        this._app.use(express.json());
    }


    private setRouters(): void {
        // Health check endpoint
        this._app.get("/health", (req, res) => {
            res.status(200).send("Hello World!");
        });

        // Room API endpoints (participants, messages)
        const roomController = new RoomController(this._roomService);
        this._app.use('/api/rooms', roomController.router);
    }


    public gitInstance(): Application {
        return this._app
    }

    public websockethandler(): void {
        const wss = new WebSocketServer(this._server, this._roomService);
        wss.init();
    }

    public async mediasoupworker(): Promise<void> {
        // const media = new MediasoupWorkerManager();
        // await media.init();
        // const worker = media.getNextWorker();
        // const room = new MediaRoomWrapper("test-room", worker);
        // await room.init();

        // const router = room.getRouter();


        // const sendTransport = await room.createWebRtcTransport("peer1", "send");
        // console.log("Send transport ID:", sendTransport.getTransportParams().id);

        // const recvTransport = await room.createWebRtcTransport("peer2", "recv");
        // console.log("Recv transport ID:", recvTransport.getTransportParams().id);

    }

}