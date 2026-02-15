import { useState, useCallback, useRef, useEffect } from 'react';
import * as mediasoupClient from 'mediasoup-client';
import { Device, Transport, Producer, Consumer } from 'mediasoup-client/lib/types';
import { Participant } from '../types/mediasoup';
import { ChatMessage } from '../types/chat';
import { AISettings } from '../types/integrations';

export const useMediasoup = () => {
    const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [logs, setLogs] = useState<{ msg: string, type: string, time: string }[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    const ws = useRef<WebSocket | null>(null);
    const device = useRef<Device | null>(null);
    const sendTransport = useRef<Transport | null>(null);
    const recvTransport = useRef<Transport | null>(null);
    const producers = useRef(new Map<string, Producer>());
    const consumers = useRef(new Map<string, { consumer: Consumer, producerId: string, participantId: string }>());
    const pendingProducers = useRef<{ producerId: string, kind: 'video' | 'audio', userId?: string, userName?: string }[]>([]);
    const producerUserMap = useRef(new Map<string, { userId: string, userName: string }>());

    const stateRef = useRef({
        roomId: '',
        userId: '',
        userName: '',
        userEmail: '',
        isReady: false,
        aiEnabled: false as boolean,
        integrations: undefined as AISettings['integrations'],
    });

    const addLog = useCallback((msg: string, type: string = 'info') => {
        const entry = { msg, type, time: new Date().toLocaleTimeString() };
        setLogs(prev => [...prev.slice(-49), entry]);
        console.log(`[${type}] ${msg}`);
    }, []);

    const updateParticipant = useCallback((userId: string, updates: Partial<Participant>) => {
        setParticipants(prev => {
            const next = new Map(prev);
            const current = next.get(userId) || {
                userId,
                userName: 'Unknown',
                isLocal: false,
                micEnabled: true,
                camEnabled: true,
                stream: new MediaStream()
            };
            next.set(userId, { ...current, ...updates });
            return next;
        });
    }, []);

    const removeParticipant = useCallback((userId: string) => {
        setParticipants(prev => {
            const next = new Map(prev);
            next.delete(userId);
            return next;
        });
    }, []);

    const consumeMedia = useCallback((producerId: string, kind: string) => {
        addLog(`🔄 Requesting to consume producer ${producerId} (${kind})`, 'info');
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                event: 'consume',
                data: {
                    producerId,
                    rtpCapabilities: device.current?.rtpCapabilities,
                    userId: stateRef.current.userId,
                    roomId: stateRef.current.roomId
                }
            }));
        }
    }, [addLog]);

    const handleMessage = useCallback(async (event: MessageEvent) => {
        const message = JSON.parse(event.data);
        addLog(`📨 Received: ${message.event}`, 'info');

        switch (message.event) {
            case 'router-rtp-capabilities':
                device.current = new mediasoupClient.Device();
                await device.current.load({ routerRtpCapabilities: message.data });
                ws.current?.send(JSON.stringify({
                    event: 'create-transport',
                    data: { direction: 'send', userId: stateRef.current.userId, roomId: stateRef.current.roomId }
                }));
                setTimeout(() => ws.current?.send(JSON.stringify({
                    event: 'create-transport',
                    data: { direction: 'recv', userId: stateRef.current.userId, roomId: stateRef.current.roomId }
                })), 200);
                break;

            case 'transport-created':
                if (message.data.direction === 'send') {
                    sendTransport.current = device.current!.createSendTransport(message.data.transport);
                    sendTransport.current.on('connect', ({ dtlsParameters }, cb) => {
                        ws.current?.send(JSON.stringify({
                            event: 'connect-transport',
                            data: { direction: 'send', dtlsParameters, userId: stateRef.current.userId, roomId: stateRef.current.roomId }
                        }));
                        cb();
                    });
                    sendTransport.current.on('produce', async ({ kind, rtpParameters }, cb) => {
                        ws.current?.send(JSON.stringify({
                            event: 'produce',
                            data: { kind, rtpParameters, userId: stateRef.current.userId, roomId: stateRef.current.roomId }
                        }));
                        const h = (e: MessageEvent) => {
                            const m = JSON.parse(e.data);
                            if (m.event === 'produced' && m.data.kind === kind) {
                                ws.current?.removeEventListener('message', h);
                                cb({ id: m.data.producerId });
                            }
                        };
                        ws.current?.addEventListener('message', h);
                    });
                } else {
                    recvTransport.current = device.current!.createRecvTransport(message.data.transport);
                    recvTransport.current.on('connect', ({ dtlsParameters }, cb) => {
                        ws.current?.send(JSON.stringify({
                            event: 'connect-transport',
                            data: { direction: 'recv', dtlsParameters, userId: stateRef.current.userId, roomId: stateRef.current.roomId }
                        }));
                        cb();
                    });
                    stateRef.current.isReady = true;
                    // Consume pending producers
                    pendingProducers.current.forEach(p => consumeMedia(p.producerId, p.kind));
                    pendingProducers.current = [];
                }
                break;

            case 'new-producer': {
                const { producerId, kind, userId, userName } = message.data;
                // Store producer -> user mapping
                if (userId && userName) {
                    producerUserMap.current.set(producerId, { userId, userName });
                }
                if (recvTransport.current) {
                    consumeMedia(producerId, kind);
                } else {
                    pendingProducers.current.push({ producerId, kind, userId, userName });
                }
                break;
            }

            case 'consumer-created': {
                const consumer = await recvTransport.current!.consume(message.data);
                const { producerId, userId: remoteUserId, userName: remoteUserName } = message.data;

                // Get user info from the message or from our map
                const userInfo = producerUserMap.current.get(producerId);
                const finalUserId = remoteUserId || userInfo?.userId || `peer-${producerId}`;
                const finalUserName = remoteUserName || userInfo?.userName || `Participant`;

                // Create participant ID based on kind to support multiple tracks
                const participantId = `${finalUserId}-${message.data.kind}`;

                // Check if we already have this participant (for adding audio to existing video)
                const existingParticipant = participants.get(finalUserId);

                if (existingParticipant && message.data.kind === 'audio') {
                    // Add audio track to existing stream
                    existingParticipant.stream?.addTrack(consumer.track);
                    updateParticipant(finalUserId, {
                        stream: existingParticipant.stream
                    });
                } else if (message.data.kind === 'video') {
                    // Create new participant with video
                    const remoteStream = new MediaStream([consumer.track]);
                    updateParticipant(finalUserId, {
                        userId: finalUserId,
                        userName: finalUserName,
                        isLocal: false,
                        stream: remoteStream,
                        micEnabled: true,
                        camEnabled: true
                    });
                }

                consumers.current.set(consumer.id, {
                    consumer,
                    producerId,
                    participantId: finalUserId
                });
                break;
            }

            case 'producer-closed': {
                const { producerId, userId: closedUserId } = message.data;
                const consumerEntry = Array.from(consumers.current.values()).find(c => c.producerId === producerId);
                if (consumerEntry) {
                    consumerEntry.consumer.close();
                    consumers.current.delete(consumerEntry.consumer.id);

                    // Check if this user has any remaining consumers
                    const hasOtherConsumers = Array.from(consumers.current.values()).some(
                        c => c.participantId === consumerEntry.participantId
                    );
                    if (!hasOtherConsumers) {
                        removeParticipant(consumerEntry.participantId);
                    }
                }
                break;
            }

            case 'peer-left': {
                const { userId: leftUserId } = message.data;
                // Remove all consumers for this peer
                consumers.current.forEach((entry, key) => {
                    if (entry.participantId === leftUserId || entry.participantId.startsWith(leftUserId)) {
                        entry.consumer.close();
                        consumers.current.delete(key);
                    }
                });
                removeParticipant(leftUserId);
                addLog(`👋 ${leftUserId} left the room`, 'info');
                break;
            }

            case 'recording-started':
                setIsRecording(true);
                addLog('⏺️ Recording started', 'success');
                break;

            case 'recording-stopped':
                setIsRecording(false);
                addLog('⏹️ Recording stopped', 'warn');
                break;

            // Chat events
            case 'new-message': {
                console.log('🔔 NEW MESSAGE RECEIVED:', message.data);
                // Helper to find the message content from various possible fields
                const rawData = message.data;
                const content = rawData.message || rawData.content || rawData.text || rawData.body || '';

                const chatMsg: ChatMessage = {
                    id: rawData.id || rawData._id || `${Date.now()}-${Math.random()}`,
                    roomId: rawData.roomId,
                    senderId: rawData.senderId,
                    senderName: rawData.senderName || 'Unknown',
                    senderEmail: rawData.senderEmail,
                    message: content,
                    timestamp: new Date(rawData.timestamp || rawData.createdAt || Date.now())
                };
                console.log('📝 Parsed chat message:', chatMsg);
                setChatMessages(prev => {
                    console.log('📊 Previous messages count:', prev.length);
                    const newMessages = [...prev, chatMsg];
                    console.log('📊 New messages count:', newMessages.length);
                    return newMessages;
                });
                addLog(`💬 Message from ${chatMsg.senderName}`, 'info');
                break;
            }

            case 'chat-history': {
                const history: ChatMessage[] = message.data.messages.map((m: any) => ({
                    id: m.id || m._id,
                    roomId: m.roomId,
                    senderId: m.senderId,
                    senderName: m.senderName,
                    senderEmail: m.senderEmail,
                    message: m.message,
                    timestamp: new Date(m.timestamp || m.createdAt)
                }));
                setChatMessages(history);
                addLog(`📜 Loaded ${history.length} chat messages`, 'info');
                break;
            }

            case 'participants-list': {
                // Update participant list from server
                addLog(`👥 Received participants list: ${message.data.participants?.length || 0}`, 'info');
                break;
            }

            case 'error':
                addLog(`❌ Error: ${message.data}`, 'error');
                break;
        }
    }, [addLog, consumeMedia, updateParticipant, removeParticipant, participants]);

    const join = useCallback(async (roomId: string, name: string, email: string, aiSettings?: AISettings) => {
        stateRef.current.roomId = roomId;
        stateRef.current.userName = name;
        stateRef.current.userEmail = email;
        stateRef.current.userId = `${name}-${Date.now()}`;
        stateRef.current.aiEnabled = aiSettings?.aiEnabled || false;
        stateRef.current.integrations = aiSettings?.integrations;

        // Get local stream first
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            updateParticipant(stateRef.current.userId, {
                userId: stateRef.current.userId,
                userName: name,
                userEmail: email,
                isLocal: true,
                stream,
                micEnabled: true,
                camEnabled: true
            });

            // Connect WS via Vite proxy
            const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws.current = new WebSocket(`${proto}//${window.location.host}/ws`);
            ws.current.onopen = () => {
                addLog('🔌 WebSocket connected', 'success');
                setIsConnected(true);
                ws.current?.send(JSON.stringify({
                    event: 'join_room',
                    data: {
                        roomId: stateRef.current.roomId,
                        userId: stateRef.current.userId,
                        name: stateRef.current.userName,
                        email: stateRef.current.userEmail,
                        aiEnabled: stateRef.current.aiEnabled,
                        integrations: stateRef.current.integrations,
                    }
                }));

                // Request chat history after joining
                setTimeout(() => {
                    ws.current?.send(JSON.stringify({
                        event: 'get-chat-history',
                        data: { roomId: stateRef.current.roomId }
                    }));
                }, 500);
            };
            ws.current.onmessage = handleMessage;
            ws.current.onclose = () => {
                addLog('🔌 WebSocket disconnected', 'warn');
                setIsConnected(false);
            };

            // Wait for transport readiness to produce
            const checkReady = setInterval(async () => {
                if (stateRef.current.isReady && sendTransport.current) {
                    clearInterval(checkReady);

                    const audioTrack = stream.getAudioTracks()[0];
                    const videoTrack = stream.getVideoTracks()[0];

                    if (audioTrack) {
                        const p = await sendTransport.current.produce({ track: audioTrack });
                        producers.current.set('audio', p);
                    }
                    if (videoTrack) {
                        const p = await sendTransport.current.produce({ track: videoTrack });
                        producers.current.set('video', p);
                    }
                    addLog('✅ Local media producing', 'success');
                }
            }, 500);

        } catch (err: any) {
            addLog(`❌ Failed to join: ${err.message}`, 'error');
        }
    }, [addLog, handleMessage, updateParticipant]);

    const toggleMic = useCallback(() => {
        const p = producers.current.get('audio');
        if (p) {
            if (p.paused) p.resume(); else p.pause();
            updateParticipant(stateRef.current.userId, { micEnabled: !p.paused });
        }
    }, [updateParticipant]);

    const toggleCam = useCallback(() => {
        const p = producers.current.get('video');
        if (p) {
            if (p.paused) p.resume(); else p.pause();
            updateParticipant(stateRef.current.userId, { camEnabled: !p.paused });
        }
    }, [updateParticipant]);

    const startScreenShare = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            const track = stream.getVideoTracks()[0];

            if (sendTransport.current) {
                const p = await sendTransport.current.produce({ track, appData: { source: 'screen' } });
                producers.current.set('screen', p);

                const screenParticipantId = `${stateRef.current.userId}-screen`;
                updateParticipant(screenParticipantId, {
                    userId: screenParticipantId,
                    userName: `${stateRef.current.userName} (Screen)`,
                    isLocal: true,
                    isScreen: true,
                    stream,
                    micEnabled: false,
                    camEnabled: true
                });

                track.onended = () => stopScreenShare();
            }
        } catch (err: any) {
            addLog(`❌ Screen share error: ${err.message}`, 'error');
        }
    }, [addLog, updateParticipant]);

    const stopScreenShare = useCallback(() => {
        const p = producers.current.get('screen');
        if (p) {
            ws.current?.send(JSON.stringify({
                event: 'close-producer',
                data: {
                    producerId: p.id,
                    userId: stateRef.current.userId,
                    roomId: stateRef.current.roomId
                }
            }));
            p.close();
            producers.current.delete('screen');
            setParticipants(prev => {
                const next = new Map(prev);
                next.delete(`${stateRef.current.userId}-screen`);
                return next;
            });
        }
    }, []);

    const toggleRecord = useCallback(() => {
        if (!isRecording) {
            const videoProducer = producers.current.get('video');
            const audioProducer = producers.current.get('audio');

            if (!videoProducer || !audioProducer) {
                addLog('❌ Need both video and audio to record', 'error');
                return;
            }

            ws.current?.send(JSON.stringify({
                event: 'start-recording',
                data: {
                    roomId: stateRef.current.roomId,
                    userId: stateRef.current.userId,
                    videoProducerId: videoProducer.id,
                    audioProducerId: audioProducer.id
                }
            }));
        } else {
            ws.current?.send(JSON.stringify({
                event: 'stop-recording',
                data: { roomId: stateRef.current.roomId }
            }));
        }
    }, [isRecording, addLog]);

    const sendChatMessage = useCallback((message: string) => {
        if (ws.current?.readyState === WebSocket.OPEN && message.trim()) {
            ws.current.send(JSON.stringify({
                event: 'send-message',
                data: {
                    roomId: stateRef.current.roomId,
                    senderId: stateRef.current.userId,
                    senderName: stateRef.current.userName,
                    senderEmail: stateRef.current.userEmail,
                    message: message.trim()
                }
            }));
            addLog(`💬 Sent message`, 'info');
        }
    }, [addLog]);

    const requestParticipants = useCallback(() => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                event: 'get-participants',
                data: { roomId: stateRef.current.roomId }
            }));
        }
    }, []);

    const getCurrentUserId = useCallback(() => {
        return stateRef.current.userId;
    }, []);

    const leave = useCallback(() => {
        window.location.reload();
    }, []);

    return {
        participants,
        isConnected,
        isRecording,
        logs,
        chatMessages,
        join,
        leave,
        toggleMic,
        toggleCam,
        toggleRecord,
        startScreenShare,
        stopScreenShare,
        sendChatMessage,
        requestParticipants,
        getCurrentUserId
    };
};
