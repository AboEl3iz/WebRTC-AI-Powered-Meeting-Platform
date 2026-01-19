import  express , { Application } from "express";
import {WebSocketServer} from "./interfaces/websocket/socketServer"
import { Server as HTTPServer } from 'http';
import { MediasoupWorkerManager } from "./media/MediasoupWorkerManager";
export class App {
    private _app : Application;
    private _server: HTTPServer
    constructor(app : Application , server: HTTPServer) {
        this._app = app;
        this.setMiddlewares();
        this.setRouters();
        this._server = server;

    }



    private setMiddlewares(): void {
        this._app.use(express.json());
    }


    private setRouters() : void {
        this._app.get("/health", (req, res) => {
            res.status(200).send("Hello World!");
        });
    }


    public gitInstance () : Application {
        return this._app
    }

    public websockethandler () : void {
        const wss = new WebSocketServer(this._server);
        wss.init();
    }

    public mediasoupworker () : void {
        const media =  new MediasoupWorkerManager();
        media.init();
    }

}