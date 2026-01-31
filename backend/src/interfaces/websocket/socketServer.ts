import WebSocket from "ws"
import { Server as HTTPServer } from 'http';
import { RoomService } from "../../services/RoomService";
import { SignalingHandler } from "./handlers/signalingHandler";
import { MediasoupWorkerManager } from "../../media/MediasoupWorkerManager";

export class WebSocketServer {
    private ws: WebSocket.Server;
    private _roomService: RoomService;
    private _mediasoupWorkerManager: MediasoupWorkerManager;

    constructor(server: HTTPServer, roomService: RoomService) {
        this.ws = new WebSocket.Server({ server })
        this._roomService = roomService;
        this._mediasoupWorkerManager = new MediasoupWorkerManager();
        this._mediasoupWorkerManager.init();
    }

    init(): void {
        this.ws.on('connection', (ws) => {
            const _SignalingHandler = new SignalingHandler(ws, this._roomService, this._mediasoupWorkerManager);
            console.log('Client connected');
            ws.on("message", (message) => {
                _SignalingHandler.handle(message);
            });



            ws.on('close', () => {
                console.log('Client disconnected');
                _SignalingHandler.close();
            });




        });





    }
}