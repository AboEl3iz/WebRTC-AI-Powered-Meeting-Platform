import React from 'react';
import { Terminal, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface Log {
    msg: string;
    type: string;
    time: string;
}

interface DebugLogsProps {
    logs: Log[];
    isOpen: boolean;
    onClose: () => void;
}

const DebugLogs: React.FC<DebugLogsProps> = ({ logs, isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed bottom-24 right-6 w-96 max-h-[400px] glass-panel rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-300">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/50">
                <div className="flex items-center gap-2 font-semibold text-gray-700">
                    <Terminal className="w-4 h-4" />
                    System Logs
                </div>
                <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-[11px] space-y-2">
                {logs.map((log, i) => (
                    <div key={i} className={cn(
                        "p-2 rounded-lg border",
                        log.type === 'error' ? "bg-red-50 border-red-100 text-red-600" :
                            log.type === 'success' ? "bg-green-50 border-green-100 text-green-600" :
                                log.type === 'warn' ? "bg-amber-50 border-amber-100 text-amber-600" :
                                    "bg-gray-50 border-gray-100 text-gray-600"
                    )}>
                        <span className="opacity-50">[{log.time}]</span> {log.msg}
                    </div>
                ))}
                {logs.length === 0 && (
                    <div className="text-gray-400 text-center py-8">No system messages yet.</div>
                )}
            </div>
        </div>
    );
};

export default DebugLogs;
