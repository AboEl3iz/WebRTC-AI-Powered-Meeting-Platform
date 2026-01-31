import React, { useState, useRef, useEffect } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { cn } from '../lib/utils';

interface ChatPanelProps {
    isOpen: boolean;
    onClose: () => void;
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    currentUserId: string;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    isOpen,
    onClose,
    messages,
    onSendMessage,
    currentUserId
}) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (isOpen) {
            inputRef.current?.focus();
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputValue.trim()) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const formatTime = (date: Date) => {
        return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    console.log('🎨 ChatPanel Render:', { isOpen, messagesCount: messages.length, messages });

    return (
        <div
            className={cn(
                "fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-[60] flex flex-col transition-transform duration-300 ease-out",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                        <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-semibold text-gray-900">In-call messages</h2>
                        <p className="text-xs text-gray-500">{messages.length} messages</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <X className="w-5 h-5 text-gray-500" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-8">
                        <div className="p-4 bg-gray-50 rounded-full mb-4">
                            <MessageSquare className="w-8 h-8 text-gray-300" />
                        </div>
                        <h3 className="font-medium text-gray-700 mb-1">No messages yet</h3>
                        <p className="text-sm text-gray-400">
                            Messages sent during this call will appear here
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isOwn = msg.senderId === currentUserId;
                        return (
                            <div
                                key={msg.id}
                                className={cn(
                                    "flex flex-col max-w-[85%] animate-in fade-in duration-300",
                                    isOwn ? "ml-auto items-end" : "mr-auto items-start"
                                )}
                            >
                                {!isOwn && (
                                    <span className="text-xs font-medium text-gray-500 mb-1 ml-1">
                                        {msg.senderName}
                                    </span>
                                )}
                                <div
                                    className={cn(
                                        "px-4 py-2.5 rounded-2xl",
                                        isOwn
                                            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-br-md"
                                            : "bg-gray-100 text-gray-800 rounded-bl-md"
                                    )}
                                >
                                    <p className="text-sm leading-relaxed break-words">
                                        {msg.message || <span className="italic opacity-50">No content</span>}
                                    </p>
                                </div>
                                <span className="text-[10px] text-gray-400 mt-1 mx-1">
                                    {formatTime(msg.timestamp)}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Send a message to everyone"
                        className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none"
                    />
                    <button
                        type="submit"
                        disabled={!inputValue.trim()}
                        className={cn(
                            "p-2 rounded-full transition-all",
                            inputValue.trim()
                                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        )}
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatPanel;
