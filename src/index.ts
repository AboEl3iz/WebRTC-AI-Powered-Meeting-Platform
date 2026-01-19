import { App } from "./app";
import http from 'http';
import { CustomConfig } from "./config/config";
import  express , { Application } from "express";

function Bootstrap() {
    const _express : Application = express();
    const server = http.createServer(_express);
    const app = new App(_express,server);
    app.websockethandler();
    app.mediasoupworker();
    const config = new CustomConfig()
    


    


    



    server.listen(config.port, () => {
        console.log("Server is running on port 3000");
    });
}

Bootstrap();