import { any } from "zod";
import { RoomService } from "../../../services/RoomService";
import WebSocket from "ws";
interface signalingMessage<T = any> {
    event : string;
    data : T;

}


export class SignalingHandler {
    constructor(
        private ws : WebSocket,
        private roomservice : RoomService
    ) {  }


    public handle (rawMessage : WebSocket.RawData) : void {
        let message : signalingMessage;
        console.log("🔥 SIGNALING MESSAGE RECEIVED" , typeof(rawMessage));
        try {
            message = JSON.parse(rawMessage.toString());
        } catch (error) {
            return this.sendError("Invalid JSON format");
        }

        const {event , data} = message;
         
        if (!event){
            return this.sendError("event is required");
        }

        switch (event) {
            case "join_room":
                this.handleJoinRoom(data);
                break;

            case "leave_room":
                this.handleLeaveRoom(data);
                break;

            default :
                this.sendError("Unknown event type");

            
        }

    }
    public handleLeaveRoom(data:any): void {
        const { userId, roomId } = data || {};

        if(!userId || !roomId){
            return this.sendError("userId and RoomId are required");
        }

        this.roomservice.addUserToRoom(roomId, userId);
        this.ws.send(
            JSON.stringify(
                {
                    event : "leave_room",
                    data : {roomId},
                }
            )
        );
        console.log(`User ${userId} left room ${roomId}`);
    }
    public handleJoinRoom(data:any): void {
        const {userId , roomId} = data || {};
        if(!userId || !roomId){
            return this.sendError("userId and RoomId are required");
        }

        this.roomservice.removeUserFromRoom(roomId,userId);
        this.ws.send(
            JSON.stringify(
                {
                    event : "joined_room",
                    data : {roomId},
                }
            )
        );

        console.log(`User ${userId} join room ${roomId}`)
    }

    private sendError (message: string) : void {
        this.ws.send(JSON.stringify({event : "error", data : message}));
    }
}