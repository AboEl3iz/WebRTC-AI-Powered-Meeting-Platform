import React from 'react';
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, Radio } from 'lucide-react';
import { cn } from '../lib/utils';

interface ControlsProps {
    micEnabled: boolean;
    camEnabled: boolean;
    screenSharing: boolean;
    isRecording: boolean;
    onToggleMic: () => void;
    onToggleCam: () => void;
    onToggleScreen: () => void;
    onToggleRecord: () => void;
    onLeave: () => void;
}

const Controls: React.FC<ControlsProps> = ({
    micEnabled,
    camEnabled,
    screenSharing,
    isRecording,
    onToggleMic,
    onToggleCam,
    onToggleScreen,
    onToggleRecord,
    onLeave
}) => {
    return (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 px-6 py-4 glass-panel rounded-full animate-in slide-in-from-bottom-10 duration-700 z-50">
            <button
                onClick={onToggleMic}
                className={cn("control-btn", micEnabled ? "control-btn-active" : "control-btn-danger")}
                title={micEnabled ? "Mute Microphone" : "Unmute Microphone"}
            >
                {micEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>

            <button
                onClick={onToggleCam}
                className={cn("control-btn", camEnabled ? "control-btn-active" : "control-btn-danger")}
                title={camEnabled ? "Turn off Camera" : "Turn on Camera"}
            >
                {camEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>

            <button
                onClick={onToggleScreen}
                className={cn("control-btn", screenSharing ? "control-btn-active" : "control-btn-inactive")}
                title={screenSharing ? "Stop Sharing" : "Share Screen"}
            >
                <ScreenShare className="w-6 h-6" />
            </button>

            <button
                onClick={onToggleRecord}
                className={cn("control-btn", isRecording ? "control-btn-danger animate-pulse" : "control-btn-inactive")}
                title={isRecording ? "Stop Recording" : "Start Recording"}
            >
                <Radio className="w-6 h-6" />
            </button>

            <div className="w-px h-8 bg-gray-200 mx-2" />

            <button
                onClick={onLeave}
                className="control-btn control-btn-danger"
                title="Leave Meeting"
            >
                <PhoneOff className="w-6 h-6" />
            </button>
        </div>
    );
};

export default Controls;
