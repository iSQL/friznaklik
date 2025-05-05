// src/app/admin/chat/page.tsx
'use client'; // Required for hooks like useState, useEffect

import React, { useState, useEffect, useCallback } from 'react';

// --- Types (Define interfaces for the data structures) ---

interface User {
    id: string;
    name: string | null;
    email: string;
}

interface ChatMessage {
    id: string;
    sessionId: string;
    sender: 'user' | 'ai' | 'admin';
    message: string;
    timestamp: string; // Keep as string from API, format later
    isReadByAdmin?: boolean; // Optional, from original schema
}

// Type for the data returned by /api/admin/chat/sessions
interface SessionListItem {
    sessionId: string;
    userId: string | null;
    userName: string;
    userEmail: string;
    latestMessage: {
        message: string;
        timestamp: string;
        sender: 'user' | 'ai' | 'admin';
    } | null;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
}

// Type for the data returned by /api/admin/chat/history/[sessionId]
interface ChatSessionWithHistory {
    id: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
    user: User;
    messages: ChatMessage[];
}


// --- ChatSessionList Component ---

interface ChatSessionListProps {
    onSelectSession: (sessionId: string) => void; // Callback to parent
}

function ChatSessionList({ onSelectSession }: ChatSessionListProps) {
    const [sessions, setSessions] = useState<SessionListItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSessions = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch('/api/admin/chat/sessions');
                if (!response.ok) {
                    throw new Error(`Failed to fetch sessions: ${response.statusText}`);
                }
                const data: SessionListItem[] = await response.json();
                setSessions(data);
            } catch (err: any) {
                console.error("Error fetching chat sessions:", err);
                setError(err.message || 'An unknown error occurred');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSessions();
    }, []); // Fetch only once on mount

    if (isLoading) {
        return <div className="p-4 text-center text-gray-500">Loading chat sessions...</div>;
    }

    if (error) {
        return <div className="p-4 text-center text-red-500">Error loading sessions: {error}</div>;
    }

    if (sessions.length === 0) {
        return <div className="p-4 text-center text-gray-500">No chat sessions found.</div>;
    }

    // Helper to format date/time
    const formatTimestamp = (timestamp: string) => {
        try {
            return new Date(timestamp).toLocaleString();
        } catch {
            return 'Invalid Date';
        }
    };

    return (
        <div className="space-y-4 p-4">
            <h2 className="text-2xl font-semibold mb-4">Chat Sessions</h2>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {sessions.map((session) => (
                    <li
                        key={session.sessionId}
                        onClick={() => onSelectSession(session.sessionId)}
                        className="py-3 px-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded-md transition-colors duration-150"
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">{session.userName}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{session.userEmail}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 truncate">
                                    {session.latestMessage ? `${session.latestMessage.sender}: ${session.latestMessage.message}` : 'No messages yet'}
                                </p>
                            </div>
                            <div className="text-right text-sm text-gray-500 dark:text-gray-400">
                                <p>{session.messageCount} message(s)</p>
                                <p>Updated: {formatTimestamp(session.updatedAt)}</p>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}


// --- AdminChatView Component ---

interface AdminChatViewProps {
    sessionId: string;
    onBack: () => void; // Callback to go back to the list
}

function AdminChatView({ sessionId, onBack }: AdminChatViewProps) {
    const [chatData, setChatData] = useState<ChatSessionWithHistory | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [adminMessage, setAdminMessage] = useState<string>('');
    const [isSending, setIsSending] = useState<boolean>(false);

    // Function to fetch chat history
    const fetchChatHistory = useCallback(async () => {
        // Don't set loading to true on refetch after sending
        // setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/admin/chat/history/${sessionId}`);
            if (!response.ok) {
                 if (response.status === 404) {
                    throw new Error(`Chat session not found.`);
                 }
                throw new Error(`Failed to fetch chat history: ${response.statusText}`);
            }
            const data: ChatSessionWithHistory = await response.json();
            setChatData(data);
        } catch (err: any) {
            console.error("Error fetching chat history:", err);
            setError(err.message || 'An unknown error occurred');
        } finally {
            setIsLoading(false); // Set loading false only after initial load or error
        }
    }, [sessionId]); // Dependency on sessionId

    // Initial fetch
    useEffect(() => {
        setIsLoading(true); // Set loading true for initial load
        fetchChatHistory();
    }, [fetchChatHistory]); // Use the memoized fetch function

    // Function to send admin message
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault(); // Prevent default form submission
        if (!adminMessage.trim() || isSending) return;

        setIsSending(true);
        setError(null); // Clear previous errors

        try {
            const response = await fetch(`/api/admin/chat/send/${sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: adminMessage.trim() }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to send message: ${response.status} ${errorText}`);
            }

            // Clear input and refetch history to show the new message
            setAdminMessage('');
            await fetchChatHistory(); // Refetch after successful send

        } catch (err: any) {
            console.error("Error sending admin message:", err);
            setError(`Error sending message: ${err.message}`);
        } finally {
            setIsSending(false);
        }
    };

    // Helper to format date/time
    const formatTimestamp = (timestamp: string) => {
        try {
            return new Date(timestamp).toLocaleString();
        } catch {
            return 'Invalid Date';
        }
    };

    // Determine message alignment and style based on sender
    const getMessageStyle = (sender: 'user' | 'ai' | 'admin') => {
        switch (sender) {
            case 'user':
                return 'bg-blue-100 dark:bg-blue-900 self-end text-right';
            case 'admin':
                return 'bg-green-100 dark:bg-green-900 self-start text-left';
            case 'ai':
            default:
                return 'bg-gray-100 dark:bg-gray-700 self-start text-left';
        }
    };
     // Determine label based on sender
    const getSenderLabel = (sender: 'user' | 'ai' | 'admin') => {
        switch (sender) {
            case 'user': return 'User';
            case 'admin': return 'Admin';
            case 'ai': return 'AI Assistant';
            default: return 'Unknown';
        }
    };


    if (isLoading) {
        return <div className="p-4 text-center text-gray-500">Loading chat history...</div>;
    }

    if (error && !chatData) { // Show error only if chatData hasn't loaded at all
        return (
             <div className="p-4">
                 <button onClick={onBack} className="mb-4 px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">&larr; Back to Sessions</button>
                 <div className="p-4 text-center text-red-500">Error loading history: {error}</div>
             </div>
        );
    }

    if (!chatData) {
         return (
             <div className="p-4">
                 <button onClick={onBack} className="mb-4 px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">&larr; Back to Sessions</button>
                 <div className="p-4 text-center text-gray-500">Chat session data not available.</div>
             </div>
         );
    }


    return (
        <div className="p-4 flex flex-col h-[calc(100vh-4rem)]"> {/* Adjust height as needed */}
            <div className="mb-4 flex justify-between items-center">
                 <button onClick={onBack} className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600">&larr; Back to Sessions</button>
                 <h2 className="text-xl font-semibold">Chat with {chatData.user.name ?? chatData.user.email}</h2>
                 <span></span> {/* Spacer */}
            </div>

            {/* Message Display Area */}
            <div className="flex-grow overflow-y-auto mb-4 space-y-3 pr-2 border border-gray-200 dark:border-gray-700 rounded-md p-3 bg-white dark:bg-gray-900">
                {chatData.messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[75%] p-3 rounded-lg shadow-sm ${getMessageStyle(msg.sender)}`}>
                             <p className="text-xs font-semibold mb-1 opacity-80">{getSenderLabel(msg.sender)}</p>
                             <p className="text-sm whitespace-pre-wrap">{msg.message}</p> {/* Use pre-wrap for newlines */}
                             <p className="text-xs opacity-60 mt-1">{formatTimestamp(msg.timestamp)}</p>
                        </div>
                    </div>
                ))}
                 {/* Display sending error inline if needed */}
                 {error && isSending && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
            </div>

            {/* Message Input Area */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
                <input
                    type="text"
                    value={adminMessage}
                    onChange={(e) => setAdminMessage(e.target.value)}
                    placeholder="Type your message as admin..."
                    disabled={isSending}
                    className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={isSending || !adminMessage.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSending ? 'Sending...' : 'Send'}
                </button>
            </form>
        </div>
    );
}


// --- AdminChatPage (Default Export) ---

export default function AdminChatPage() {
    const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

    const handleSelectSession = (sessionId: string) => {
        setSelectedSessionId(sessionId);
    };

    const handleBackToList = () => {
        setSelectedSessionId(null);
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6 border-b pb-2">Admin Chat Management</h1>
            {selectedSessionId ? (
                <AdminChatView sessionId={selectedSessionId} onBack={handleBackToList} />
            ) : (
                <ChatSessionList onSelectSession={handleSelectSession} />
            )}
        </div>
    );
}
