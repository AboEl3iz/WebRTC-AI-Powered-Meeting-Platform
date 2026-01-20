import { any } from "zod";
import { RoomService } from "../../../services/RoomService";
import WebSocket from "ws";
import { WebRtcTransport } from "mediasoup/node/lib/WebRtcTransportTypes";
interface signalingMessage<T = any> {
    event : string;
    data : T;

}


export class SignalingHandler {
    constructor(
        private ws : WebSocket,
        private roomservice : RoomService
    ) {  }


    public async handle (rawMessage : WebSocket.RawData) : Promise<void> {
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

            case "produce":
                const userTransporter : WebRtcTransport | undefined = this.roomservice.getTransport(data.userId);
                if(!userTransporter){
                        return this.sendError("Transport not found for user");
                }
                const produce  = await userTransporter.produce({
                        kind : data.kind,
                        rtpParameters : data.rtpParameters,
                    });

                this.roomservice.addProducer(data.userId,   produce);

                this.ws.send(
                    JSON.stringify({
                        event : "produced",
                        data : { producerId : produce.id , kind : produce.kind },
                    })
                )

                // Broadcast to other users to consume
                const roomUsers = this.roomservice.getUsersInRoom(data.roomId)!.filter(id => id !== data.userId);
                roomUsers.forEach(async userId => {
                    const transport = this.roomservice.getTransport(userId);
                    if (!transport) return;
                    const consumer = await transport.consume({
                        producerId: produce.id,
                        rtpCapabilities: data.rtpCapabilities,
                        paused: false
                    });
                    this.roomservice.addConsumer(userId, consumer);
                    // send consumer info to the client (pseudo)
                    // In real frontend, you send consumer's parameters via WS
                });

                break;

            default :
                return this.sendError("Unknown event type");

            
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