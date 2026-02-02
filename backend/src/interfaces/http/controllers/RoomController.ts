import { Request, Response, Router } from 'express';
import { RoomService } from '../../../services/RoomService';
import { chatService } from '../../../services/ChatService';
import logger from '../../../config/logger';

/**
 * RoomController
 * Handles HTTP endpoints for room-related operations
 */
export class RoomController {
    public router: Router;
    private roomService: RoomService;

    constructor(roomService: RoomService) {
        this.router = Router();
        this.roomService = roomService;
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        // GET /api/rooms/:roomId/participants
        this.router.get('/:roomId/participants', this.getParticipants.bind(this));

        // GET /api/rooms/:roomId/messages
        this.router.get('/:roomId/messages', this.getChatHistory.bind(this));
    }

    /**
     * Get all participants in a room
     * GET /api/rooms/:roomId/participants
     */
    private getParticipants(req: Request, res: Response): void {
        try {
            const roomId = req.params.roomId as string;

            if (!roomId) {
                res.status(400).json({
                    success: false,
                    error: 'Room ID is required'
                });
                return;
            }

            const participants = this.roomService.getParticipantsDetails(roomId);

            res.status(200).json({
                success: true,
                data: {
                    roomId,
                    count: participants.length,
                    participants
                }
            });
        } catch (error) {
            logger.http.error("Error fetching participants", { error: String(error) });
            res.status(500).json({
                success: false,
                error: 'Failed to fetch participants'
            });
        }
    }

    /**
     * Get chat history for a room
     * GET /api/rooms/:roomId/messages?limit=50&before=timestamp
     */
    private async getChatHistory(req: Request, res: Response): Promise<void> {
        try {
            const roomId = req.params.roomId as string;
            const limit = parseInt(req.query.limit as string) || 50;
            const before = req.query.before ? new Date(req.query.before as string) : undefined;

            if (!roomId) {
                res.status(400).json({
                    success: false,
                    error: 'Room ID is required'
                });
                return;
            }

            const messages = await chatService.getChatHistory(roomId, limit, before);

            res.status(200).json({
                success: true,
                data: {
                    roomId,
                    count: messages.length,
                    messages
                }
            });
        } catch (error) {
            logger.http.error("Error fetching chat history", { error: String(error) });
            res.status(500).json({
                success: false,
                error: 'Failed to fetch chat history'
            });
        }
    }
}
