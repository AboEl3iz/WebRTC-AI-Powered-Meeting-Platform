import React, { useState } from 'react';
import { Sparkles, Calendar, BookOpen, ChevronDown, ChevronUp, Check, X, ExternalLink } from 'lucide-react';
import { AISettings, UserIntegrations } from '../types/integrations';

interface AIActivationPanelProps {
    aiSettings: AISettings;
    onSettingsChange: (settings: AISettings) => void;
}

const AIActivationPanel: React.FC<AIActivationPanelProps> = ({ aiSettings, onSettingsChange }) => {
    const [expanded, setExpanded] = useState(false);
    const [notionToken, setNotionToken] = useState('');
    const [notionWorkspaceId, setNotionWorkspaceId] = useState('');
    const [notionDatabaseId, setNotionDatabaseId] = useState('');
    const [gcalToken, setGcalToken] = useState('');
    const [gcalRefreshToken, setGcalRefreshToken] = useState('');
    const [notionConnected, setNotionConnected] = useState(false);
    const [gcalConnected, setGcalConnected] = useState(false);

    const handleToggleAI = () => {
        const newEnabled = !aiSettings.aiEnabled;
        if (!newEnabled) {
            // Turning off — clear integrations
            setNotionConnected(false);
            setGcalConnected(false);
            onSettingsChange({ aiEnabled: false, integrations: undefined });
        } else {
            onSettingsChange({ ...aiSettings, aiEnabled: true });
        }
    };

    const handleConnectNotion = () => {
        if (!notionToken.trim() || !notionWorkspaceId.trim()) return;

        const integrations: UserIntegrations = {
            ...aiSettings.integrations,
            notion: {
                access_token: notionToken.trim(),
                workspace_id: notionWorkspaceId.trim(),
                database_id: notionDatabaseId.trim() || undefined,
            },
        };

        setNotionConnected(true);
        onSettingsChange({ aiEnabled: true, integrations });
    };

    const handleDisconnectNotion = () => {
        const integrations = { ...aiSettings.integrations };
        delete integrations.notion;
        setNotionConnected(false);
        setNotionToken('');
        setNotionWorkspaceId('');
        setNotionDatabaseId('');
        onSettingsChange({
            aiEnabled: !!(integrations.google_calendar),
            integrations: Object.keys(integrations).length > 0 ? integrations : undefined,
        });
    };

    const handleConnectGCal = () => {
        if (!gcalToken.trim()) return;

        const integrations: UserIntegrations = {
            ...aiSettings.integrations,
            google_calendar: {
                access_token: gcalToken.trim(),
                refresh_token: gcalRefreshToken.trim() || undefined,
                calendar_id: 'primary',
            },
        };

        setGcalConnected(true);
        onSettingsChange({ aiEnabled: true, integrations });
    };

    const handleDisconnectGCal = () => {
        const integrations = { ...aiSettings.integrations };
        delete integrations.google_calendar;
        setGcalConnected(false);
        setGcalToken('');
        setGcalRefreshToken('');
        onSettingsChange({
            aiEnabled: !!(integrations.notion),
            integrations: Object.keys(integrations).length > 0 ? integrations : undefined,
        });
    };

    const hasAnyIntegration = notionConnected || gcalConnected;

    return (
        <div className="rounded-2xl border border-gray-200 overflow-hidden transition-all duration-300">
            {/* Header */}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50/80 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-colors ${aiSettings.aiEnabled
                        ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-purple-200'
                        : 'bg-gray-100 text-gray-400'
                        }`}>
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <div className="font-semibold text-gray-900 text-sm">AI Features</div>
                        <div className="text-xs text-gray-500">
                            {aiSettings.aiEnabled && hasAnyIntegration
                                ? `${[notionConnected && 'Notion', gcalConnected && 'Calendar'].filter(Boolean).join(' + ')} connected`
                                : 'Summarize meetings & sync to your tools'}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {aiSettings.aiEnabled && hasAnyIntegration && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 rounded-full">
                            Active
                        </span>
                    )}
                    {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
            </button>

            {/* Expandable Content */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3 animate-in fade-in duration-300">
                    {/* Master Toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <span className="text-sm font-medium text-gray-700">Enable AI processing</span>
                        <button
                            type="button"
                            onClick={handleToggleAI}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${aiSettings.aiEnabled ? 'bg-purple-600' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${aiSettings.aiEnabled ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>

                    {aiSettings.aiEnabled && (
                        <div className="space-y-3">
                            {/* Notion Integration */}
                            <div className="border border-gray-100 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-gray-600" />
                                        <span className="text-sm font-medium text-gray-700">Notion</span>
                                    </div>
                                    {notionConnected ? (
                                        <button
                                            type="button"
                                            onClick={handleDisconnectNotion}
                                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                                        >
                                            <X className="w-3 h-3" /> Disconnect
                                        </button>
                                    ) : null}
                                </div>

                                {notionConnected ? (
                                    <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        <span className="text-xs text-emerald-700 font-medium">
                                            Connected — summaries will be pushed to Notion
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500">
                                            Paste your Notion Integration Token to automatically push meeting summaries.
                                        </p>
                                        <input
                                            type="password"
                                            value={notionToken}
                                            onChange={(e) => setNotionToken(e.target.value)}
                                            placeholder="Notion Integration Token"
                                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        />
                                        <input
                                            type="text"
                                            value={notionWorkspaceId}
                                            onChange={(e) => setNotionWorkspaceId(e.target.value)}
                                            placeholder="Workspace ID"
                                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        />
                                        <input
                                            type="text"
                                            value={notionDatabaseId}
                                            onChange={(e) => setNotionDatabaseId(e.target.value)}
                                            placeholder="Database ID (optional)"
                                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleConnectNotion}
                                            disabled={!notionToken.trim() || !notionWorkspaceId.trim()}
                                            className="w-full py-2 text-xs font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Connect Notion
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Google Calendar Integration */}
                            <div className="border border-gray-100 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-gray-700">Google Calendar</span>
                                    </div>
                                    {gcalConnected ? (
                                        <button
                                            type="button"
                                            onClick={handleDisconnectGCal}
                                            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600"
                                        >
                                            <X className="w-3 h-3" /> Disconnect
                                        </button>
                                    ) : null}
                                </div>

                                {gcalConnected ? (
                                    <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                                        <Check className="w-4 h-4 text-emerald-500" />
                                        <span className="text-xs text-emerald-700 font-medium">
                                            Connected — events will be created in your calendar
                                        </span>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-500">
                                            Paste your Google OAuth access token. Events extracted from the meeting will be added to your calendar.
                                        </p>
                                        <input
                                            type="password"
                                            value={gcalToken}
                                            onChange={(e) => setGcalToken(e.target.value)}
                                            placeholder="Google OAuth Access Token"
                                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                        <input
                                            type="password"
                                            value={gcalRefreshToken}
                                            onChange={(e) => setGcalRefreshToken(e.target.value)}
                                            placeholder="Refresh Token (optional)"
                                            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleConnectGCal}
                                            disabled={!gcalToken.trim()}
                                            className="w-full py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                        >
                                            Connect Google Calendar
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Info note */}
                            <p className="text-[11px] text-gray-400 text-center pt-1">
                                Your tokens are sent securely to the backend and never stored in the browser.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AIActivationPanel;
