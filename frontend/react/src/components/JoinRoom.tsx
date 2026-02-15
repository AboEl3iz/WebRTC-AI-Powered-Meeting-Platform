import React, { useState } from 'react';
import { Video } from 'lucide-react';
import AIActivationPanel from './AIActivationPanel';
import { AISettings } from '../types/integrations';

interface JoinRoomProps {
    onJoin: (roomId: string, name: string, email: string, aiSettings: AISettings) => void;
}

const JoinRoom: React.FC<JoinRoomProps> = ({ onJoin }) => {
    const [name, setName] = useState('User');
    const [email, setEmail] = useState('');
    const [roomId, setRoomId] = useState('test-room');
    const [aiSettings, setAISettings] = useState<AISettings>({
        aiEnabled: false,
        integrations: undefined,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.trim() && roomId.trim() && email.trim()) {
            onJoin(roomId, name, email, aiSettings);
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center p-3 bg-blue-50 rounded-2xl mb-4">
                        <Video className="w-10 h-10 text-blue-600" />
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-2">WebRTC AI Meeting</h1>
                    <p className="text-gray-500">Secure, encrypted, and AI-powered video calls</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 glass-panel p-8 rounded-2xl">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Display Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="e.g. John Doe"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="e.g. john@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Room Code</label>
                        <input
                            type="text"
                            value={roomId}
                            onChange={(e) => setRoomId(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            placeholder="e.g. test-room"
                            required
                        />
                    </div>

                    {/* AI Features Activation */}
                    <AIActivationPanel
                        aiSettings={aiSettings}
                        onSettingsChange={setAISettings}
                    />

                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
                    >
                        Join Meeting
                    </button>
                </form>

                <p className="text-center text-sm text-gray-400">
                    {aiSettings.aiEnabled
                        ? '✨ AI features enabled — your meeting will be summarized automatically'
                        : 'Joining as a guest. All data is ephemeral.'
                    }
                </p>
            </div>
        </div>
    );
};

export default JoinRoom;
