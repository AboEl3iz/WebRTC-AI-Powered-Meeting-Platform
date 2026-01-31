import React, { useEffect, useRef } from 'react';
import { MicOff, VideoOff, Pin, ScreenShare } from 'lucide-react';
import { cn } from '../lib/utils';
import { Participant } from '../types/mediasoup';

interface VideoTileProps {
    participant: Participant;
    isPinned?: boolean;
    onPin?: () => void;
    className?: string;
}

const VideoTile: React.FC<VideoTileProps> = ({ participant, isPinned, onPin, className }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && participant.stream) {
            videoRef.current.srcObject = participant.stream;
        }
    }, [participant.stream]);

    // Screen shares should usually be contained to show full text
    const isScreenShare = participant.isScreen;

    return (
        <div
            className={cn(
                "group relative bg-gray-900 overflow-hidden shadow-lg transition-all duration-300",
                // Default aspect ratio if not overridden by className
                !className?.includes('h-') && "aspect-video",
                "rounded-2xl", // consistent rounding
                isPinned && "ring-2 ring-blue-500 z-10",
                className
            )}
            onClick={onPin}
        >
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={participant.isLocal}
                className={cn(
                    "w-full h-full transition-opacity duration-300",
                    isScreenShare ? "object-contain bg-black" : "object-cover",
                    !participant.camEnabled && !isScreenShare && "opacity-0"
                )}
            />

            {!participant.camEnabled && !isScreenShare && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 text-3xl font-bold border-2 border-gray-700">
                        {participant.userName.charAt(0).toUpperCase()}
                    </div>
                </div>
            )}

            {/* Overlays */}
            <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="flex items-center gap-2 max-w-[70%]">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-white text-sm font-medium flex items-center gap-2 truncate shadow-sm border border-white/10">
                        {isScreenShare && <ScreenShare className="w-3.5 h-3.5 text-blue-400" />}
                        <span className="truncate">
                            {participant.isLocal ? "You" : participant.userName}
                        </span>
                        {isPinned && <Pin className="w-3 h-3 fill-white text-blue-400" />}
                    </div>
                </div>

                <div className="flex gap-2">
                    {!participant.micEnabled && !isScreenShare && (
                        <div className="bg-red-500/90 backdrop-blur-md p-1.5 rounded-full text-white shadow-sm">
                            <MicOff className="w-4 h-4" />
                        </div>
                    )}
                    {!participant.camEnabled && !isScreenShare && (
                        <div className="bg-red-500/90 backdrop-blur-md p-1.5 rounded-full text-white shadow-sm border border-red-400/50">
                            <VideoOff className="w-4 h-4" />
                        </div>
                    )}
                </div>
            </div>

            {/* Hover effect for pin */}
            {!isPinned && (
                <button className={cn(
                    "absolute top-3 right-3 p-2 bg-black/40 hover:bg-blue-600 backdrop-blur-md rounded-full text-white opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100",
                    isScreenShare && "opacity-100 bg-black/20" // Always show pin control for screen shares as hint
                )}>
                    <Pin className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default VideoTile;
