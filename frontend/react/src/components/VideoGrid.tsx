import React, { useMemo, useState, useEffect } from 'react';
import { Participant } from '../types/mediasoup';
import VideoTile from './VideoTile';
import { cn } from '../lib/utils';
import { LayoutGrid, Minimize2 } from 'lucide-react';

interface VideoGridProps {
    participants: Map<string, Participant>;
}

const VideoGrid: React.FC<VideoGridProps> = ({ participants }) => {
    const [pinnedId, setPinnedId] = useState<string | null>(null);
    const [layoutMode, setLayoutMode] = useState<'auto' | 'grid'>('auto');

    const participantList = useMemo(() => Array.from(participants.values()), [participants]);

    // Detect screen share to automatically pin/feature it
    const screenShareParticipant = useMemo(() =>
        participantList.find(p => p.isScreen),
        [participantList]);

    // Determine the active featured participant (Pinned manually OR Screen share auto)
    const featuredParticipantId = useMemo(() => {
        if (pinnedId) return pinnedId;
        if (screenShareParticipant && layoutMode === 'auto') return screenShareParticipant.userId;
        return null;
    }, [pinnedId, screenShareParticipant, layoutMode]);

    // Reset pin if participant leaves
    useEffect(() => {
        if (pinnedId && !participants.has(pinnedId)) {
            setPinnedId(null);
        }
    }, [participants, pinnedId]);

    // Separate featured vs others
    const featuredParticipant = featuredParticipantId ? participants.get(featuredParticipantId) : null;
    const otherParticipants = useMemo(() =>
        participantList.filter(p => p.userId !== featuredParticipantId),
        [participantList, featuredParticipantId]);

    // Grid Layout Calculation for "Standard" view
    const getGridClass = (count: number) => {
        if (count === 1) return "grid-cols-1 max-w-4xl mx-auto h-full";
        if (count === 2) return "grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto h-[70%]";
        if (count <= 4) return "grid-cols-2 max-w-5xl mx-auto h-[80%]";
        if (count <= 6) return "grid-cols-2 md:grid-cols-3 max-w-7xl mx-auto";
        if (count <= 9) return "grid-cols-3";
        return "grid-cols-3 md:grid-cols-4";
    };

    // Render Logic
    if (featuredParticipant) {
        // === FEATURED LAYOUT (Sidebar / Filmstrip) ===
        return (
            <div className="flex h-full w-full p-4 gap-4 transition-all duration-500">
                {/* Main Stage */}
                <div className="flex-1 relative rounded-2xl overflow-hidden shadow-2xl bg-black/5 ring-1 ring-black/10">
                    <VideoTile
                        participant={featuredParticipant}
                        isPinned={true}
                        onPin={() => setPinnedId(null)} // Unpin on click
                        className="h-full w-full object-contain"
                    />

                    {/* Floating Layout Toggle */}
                    <button
                        onClick={() => setLayoutMode(layoutMode === 'auto' ? 'grid' : 'auto')}
                        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors z-20"
                        title="Toggle Layout"
                    >
                        {layoutMode === 'auto' ? <LayoutGrid size={20} /> : <Minimize2 size={20} />}
                    </button>
                </div>

                {/* Sidebar (Filmstrip) */}
                {otherParticipants.length > 0 && (
                    <div className="w-64 flex flex-col gap-3 overflow-y-auto pr-1">
                        {otherParticipants.map(participant => (
                            <div key={participant.userId} className="h-40 w-full shrink-0">
                                <VideoTile
                                    participant={participant}
                                    isPinned={false}
                                    onPin={() => setPinnedId(participant.userId)}
                                    className="rounded-xl border border-gray-200 shadow-sm"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    // === STANDARD GRID LAYOUT ===
    return (
        <div className="h-full w-full p-4 overflow-y-auto">
            <div className={cn(
                "grid gap-4 w-full h-full place-content-center transition-all duration-500",
                getGridClass(participantList.length)
            )}>
                {participantList.map((participant) => (
                    <div key={participant.userId} className="relative w-full h-full min-h-[200px]">
                        <VideoTile
                            participant={participant}
                            isPinned={pinnedId === participant.userId}
                            onPin={() => setPinnedId(participant.userId)}
                            className="w-full h-full rounded-2xl shadow-lg border border-gray-100"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VideoGrid;
