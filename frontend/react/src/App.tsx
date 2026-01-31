import { useState, useMemo } from 'react'
import { Info, MessageSquare, Users, Settings } from 'lucide-react'
import { useMediasoup } from './hooks/useMediasoup'
import Header from './components/Header'
import VideoGrid from './components/VideoGrid'
import Controls from './components/Controls'
import JoinRoom from './components/JoinRoom'
import DebugLogs from './components/DebugLogs'
import ChatPanel from './components/ChatPanel'
import ParticipantsPanel from './components/ParticipantsPanel'

function App() {
    const {
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
        getCurrentUserId
    } = useMediasoup()

    const [isJoined, setIsJoined] = useState(false)
    const [showLogs, setShowLogs] = useState(false)
    const [showChat, setShowChat] = useState(false)
    const [showParticipants, setShowParticipants] = useState(false)
    const [roomCode, setRoomCode] = useState('')

    const handleJoin = async (roomId: string, name: string, email: string) => {
        setRoomCode(roomId)
        await join(roomId, name, email)
        setIsJoined(true)
    }

    const localParticipant = useMemo(() => {
        return Array.from(participants.values()).find(p => p.isLocal && !p.isScreen)
    }, [participants])

    const isScreenSharing = useMemo(() => {
        return Array.from(participants.values()).some(p => p.isLocal && p.isScreen)
    }, [participants])

    const currentUserId = getCurrentUserId()

    // Close other panels when opening one
    const handleToggleChat = () => {
        setShowChat(!showChat)
        if (!showChat) {
            setShowParticipants(false)
            setShowLogs(false)
        }
    }

    const handleToggleParticipants = () => {
        setShowParticipants(!showParticipants)
        if (!showParticipants) {
            setShowChat(false)
            setShowLogs(false)
        }
    }

    const handleToggleLogs = () => {
        setShowLogs(!showLogs)
        if (!showLogs) {
            setShowChat(false)
            setShowParticipants(false)
        }
    }

    // Calculate unread messages indicator
    const hasUnreadMessages = chatMessages.length > 0 && !showChat

    if (!isJoined) {
        return <JoinRoom onJoin={handleJoin} />
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden font-sans">
            <Header roomCode={roomCode} isConnected={isConnected} />

            <main className="flex-1 relative bg-gray-50/50 overflow-hidden">
                <VideoGrid participants={participants} />

                <Controls
                    micEnabled={localParticipant?.micEnabled ?? true}
                    camEnabled={localParticipant?.camEnabled ?? true}
                    screenSharing={isScreenSharing}
                    isRecording={isRecording}
                    onToggleMic={toggleMic}
                    onToggleCam={toggleCam}
                    onToggleScreen={isScreenSharing ? stopScreenShare : startScreenShare}
                    onToggleRecord={toggleRecord}
                    onLeave={leave}
                />

                <DebugLogs
                    logs={logs}
                    isOpen={showLogs}
                    onClose={() => setShowLogs(false)}
                />

                <ChatPanel
                    isOpen={showChat}
                    onClose={() => setShowChat(false)}
                    messages={chatMessages}
                    onSendMessage={sendChatMessage}
                    currentUserId={currentUserId}
                />

                <ParticipantsPanel
                    isOpen={showParticipants}
                    onClose={() => setShowParticipants(false)}
                    participants={participants}
                    currentUserId={currentUserId}
                />

                {/* Overlay when panel is open */}
                {(showChat || showParticipants) && (
                    <div
                        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
                        onClick={() => {
                            setShowChat(false)
                            setShowParticipants(false)
                        }}
                    />
                )}
            </main>

            <footer className="h-14 border-t border-gray-100 flex items-center justify-between px-6 text-sm text-gray-500 bg-white">
                <div className="flex items-center gap-4">
                    <span className="font-medium">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <div className="w-px h-4 bg-gray-200" />
                    <span className="font-mono uppercase tracking-widest">{roomCode}</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleToggleLogs}
                        className={`p-2 rounded-full transition-colors ${showLogs ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}
                        title="System Logs"
                    >
                        <Info className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleToggleParticipants}
                        className={`p-2 rounded-full transition-colors relative ${showParticipants ? 'bg-emerald-50 text-emerald-600' : 'hover:bg-gray-100'}`}
                        title="Participants"
                    >
                        <Users className="w-5 h-5" />
                        <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px]">
                            {Array.from(participants.values()).filter(p => !p.isScreen).length}
                        </span>
                    </button>
                    <button
                        onClick={handleToggleChat}
                        className={`p-2 rounded-full transition-colors relative ${showChat ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'}`}
                        title="Chat"
                    >
                        <MessageSquare className="w-5 h-5" />
                        {hasUnreadMessages && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        )}
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </footer>
        </div>
    )
}

export default App
