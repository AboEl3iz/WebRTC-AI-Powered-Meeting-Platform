import WebSocket from "ws"
import { Server as HTTPServer } from 'http';
import { RoomService } from "../../services/RoomService";
import { SignalingHandler } from "./handlers/signalingHandler";
export class WebSocketServer {
    private ws: WebSocket.Server;
    private _roomService : RoomService;
    constructor(server: HTTPServer) {
        this.ws = new WebSocket.Server({ server })
        this._roomService = new RoomService();
    }

    init(): void {
        this.ws.on('connection', (ws) => {
            const _SignalingHandler = new SignalingHandler(ws, this._roomService);
            console.log('Client connected');
            ws.on("message", (message) => {
                _SignalingHandler.handle(message);
            });



            ws.on('close', () => {
                console.log('Client disconnected');
                });

            
        });

        

    

    }
}