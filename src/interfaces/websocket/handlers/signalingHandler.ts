import { any } from "zod";
import { RoomService } from "../../../services/RoomService";
import WebSocket from "ws";
import { WebRtcTransport } from "mediasoup/node/lib/WebRtcTransportTypes";
import { MediasoupWorkerManager } from "../../../media/MediasoupWorkerManager";
interface signalingMessage<T = any> {
    event : string;
    data : T;

}


export class SignalingHandler {
    
    constructor(
        private ws : WebSocket,
        private roomservice : RoomService,
        private mediasoupWorkerManager: MediasoupWorkerManager
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
        const {roomId , userId , direction,  dtlsParameters } = data;
         
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
                const roomm = this.roomservice.getMediaRoom(data.roomId);  
                if(!roomm) return this.sendError("Room not found");

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
                        paused: false,
                        
                    });
                    this.roomservice.addConsumer(userId, consumer);
                    console.log(`🧩 Consumer created for peer=${userId} consuming producer=${produce.id}`);
                    // send consumer info to the client (pseudo)
                    // In real frontend, you send consumer's parameters via WS
                });

                break;

            case "create-transport":
                
                const room = this.roomservice.getMediaRoom(roomId);  
                if(!room) return this.sendError("Room not found");
                const transport = await room.createWebRtcTransport(userId, direction);
                this.ws.send(
                    JSON.stringify({
                        event : "transport-created",
                        data : transport.getTransportParams(),
                    })
                );
                break;

            case "connect-transport" :
                
               const mediaRoom = this.roomservice.getMediaRoom(roomId);
               const transportToConnect = mediaRoom?.getTransport(userId, direction);
               if (!transportToConnect) {
                    return this.sendError("Transport not found for user");
               }
               await transportToConnect.connect(dtlsParameters);

               this.ws.send(
                JSON.stringify({
                    event: "transport-connected",
                    data: { 
                        id: transportToConnect.getTransportParams().id,
                        iceParameters: transportToConnect.getTransportParams().iceParameters,
                        iceCandidates: transportToConnect.getTransportParams().iceCandidates,
                        dtlsParameters: transportToConnect.getTransportParams().dtlsParameters,
                        direction
                     },
                })
               );
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

        this.roomservice.removeUserFromRoom(roomId, userId);
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

        this.roomservice.addUserToRoom(roomId,userId);
        let room = this.roomservice.getMediaRoom(roomId);
        if(!room){
            const worker = this.mediasoupWorkerManager.getNextWorker();
            this.roomservice.createMediaRoom(roomId, worker);
            
        }
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