import React from 'react';
import { Video, Globe } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
    roomCode: string;
    isConnected: boolean;
}

const Header: React.FC<HeaderProps> = ({ roomCode, isConnected }) => {
    return (
        <header className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white z-40">
            <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                    <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="font-bold text-gray-900 leading-none">WebRTC AI</h2>
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">{roomCode}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-colors",
                    isConnected
                        ? "bg-green-50 text-green-600 border-green-100"
                        : "bg-red-50 text-red-600 border-red-100"
                )}>
                    {isConnected ? (
                        <>
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                            CONNECTED
                        </>
                    ) : (
                        <>
                            <Globe className="w-3 h-3 animate-spin" />
                            DISCONNECTED
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
