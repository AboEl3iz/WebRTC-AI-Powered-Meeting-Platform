import React from 'react';
import { X, Users, Mic, MicOff, Video, VideoOff, Crown, ScreenShare } from 'lucide-react';
import { Participant } from '../types/mediasoup';
import { cn } from '../lib/utils';

interface ParticipantsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    participants: Map<string, Participant>;
    currentUserId: string;
}

const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({
    isOpen,
    onClose,
    participants,
    currentUserId
}) => {
    const participantsList = Array.from(participants.values()).filter(p => !p.isScreen);
    const screenShares = Array.from(participants.values()).filter(p => p.isScreen);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const getAvatarColor = (userId: string) => {
        const colors = [
            'from-violet-500 to-purple-600',
            'from-blue-500 to-indigo-600',
            'from-emerald-500 to-teal-600',
            'from-orange-500 to-red-600',
            'from-pink-500 to-rose-600',
            'from-cyan-500 to-blue-600',
        ];
        const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[index % colors.length];
    };

    return (
        <div
            className={cn(
                "fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl">
                        <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-900">People</h2>
                        <p className="text-xs text-gray-500">
                            {participantsList.length} participant{participantsList.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            {/* Participants List */}
            <div className="flex-1 overflow-y-auto">
                {/* In Call Section */}
                <div className="p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        In this call
                    </h3>
                    <div className="space-y-2">
                        {participantsList.map((participant) => {
                            const isCurrentUser = participant.userId === currentUserId;
                            return (
                                <div
                                    key={participant.userId}
                                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                                >
                                    {/* Avatar */}
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm bg-gradient-to-br shadow-md",
                                        getAvatarColor(participant.userId)
                                    )}>
                                        {getInitials(participant.userName)}
                                    </div>

                                    {/* Name & Status */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-gray-900 truncate">
                                                {participant.userName}
                                            </span>
                                            {isCurrentUser && (
                                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                    You
                                                </span>
                                            )}
                                            {participant.isLocal && !isCurrentUser && (
                                                <Crown className="w-4 h-4 text-amber-500" />
                                            )}
                                        </div>
                                        {participant.userEmail && (
                                            <p className="text-xs text-gray-400 truncate">
                                                {participant.userEmail}
                                            </p>
                                        )}
                                    </div>

                                    {/* Media Status */}
                                    <div className="flex items-center gap-1">
                                        <div className={cn(
                                            "p-1.5 rounded-full",
                                            participant.micEnabled ? "text-gray-400" : "text-red-500 bg-red-50"
                                        )}>
                                            {participant.micEnabled ? (
                                                <Mic className="w-4 h-4" />
                                            ) : (
                                                <MicOff className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div className={cn(
                                            "p-1.5 rounded-full",
                                            participant.camEnabled ? "text-gray-400" : "text-red-500 bg-red-50"
                                        )}>
                                            {participant.camEnabled ? (
                                                <Video className="w-4 h-4" />
                                            ) : (
                                                <VideoOff className="w-4 h-4" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Screen Shares Section */}
                {screenShares.length > 0 && (
                    <div className="p-4 border-t border-gray-100">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Presenting
                        </h3>
                        <div className="space-y-2">
                            {screenShares.map((screen) => (
                                <div
                                    key={screen.userId}
                                    className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100"
                                >
                                    <div className="p-2 bg-blue-500 rounded-lg">
                                        <ScreenShare className="w-4 h-4 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-medium text-blue-900 truncate">
                                            {screen.userName}
                                        </span>
                                        <p className="text-xs text-blue-600">Screen sharing</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-center text-gray-400">
                    Participants can join using the room code
                </p>
            </div>
        </div>
    );
};

export default ParticipantsPanel;
