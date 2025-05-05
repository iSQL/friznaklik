// src/components/chat/ChatWindow.tsx
'use client'; // Required for hooks

import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore'; // Import the Zustand chat store

// Define the type for a single message (should match the type in chatStore.ts)
// Ensure this matches exactly what your store provides
interface ChatMessage {
  text: string;
  sender: 'user' | 'ai' | 'admin';
  timestamp: Date; // Assuming timestamps are Date objects in the store
  id: string;
}

export default function ChatWindow() {
    // Get state and actions from the Zustand store
    const messages = useChatStore((state) => state.messages);
    const inputMessage = useChatStore((state) => state.inputMessage);
    const setInputMessage = useChatStore((state) => state.setInputMessage);
    const sendMessage = useChatStore((state) => state.sendMessage);
    const isSending = useChatStore((state) => state.isSending);

    // Ref for an empty div at the end of the messages list
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    // Ref for the scrollable message container itself (optional, but can be useful)
    const messageContainerRef = useRef<HTMLDivElement | null>(null);

    // Function to scroll the message container to the bottom
    const scrollToBottom = () => {
        // Use smooth scrolling for a better user experience
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Effect to scroll down whenever the 'messages' array changes
    useEffect(() => {
        scrollToBottom();
    }, [messages]); // Dependency array ensures this runs when messages update

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setInputMessage(event.target.value);
    };

    // Handle form submission to send a message
    const handleSendMessage = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault(); // Prevent page reload
        if (inputMessage.trim()) {
            sendMessage(inputMessage.trim());
            // Input clearing is handled within the sendMessage action in chatStore.ts
        }
    };

    // Helper to format timestamp for display
    const formatTimestamp = (timestamp: Date) => {
        // Check if timestamp is a valid Date object
        if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
           // Try parsing if it might be a string initially (though store should handle this)
           try {
               const parsedDate = new Date(timestamp);
               if (isNaN(parsedDate.getTime())) return 'Invalid Time';
               return parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
           } catch {
               return 'Invalid Time';
           }
        }
        // Format valid Date object
        return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

     // Determine message alignment and style based on sender
    const getMessageStyle = (sender: 'user' | 'ai' | 'admin') => {
        switch (sender) {
            case 'user':
                // User messages align right, blue background
                return 'bg-blue-500 text-white self-end';
            case 'admin':
                // Admin messages align left, green background
                return 'bg-green-100 dark:bg-green-900 text-gray-900 dark:text-white self-start';
            case 'ai':
            default:
                 // AI messages align left, gray background
                return 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white self-start';
        }
    };

    return (
        // Outer container for the chat window
        // Uses flex-col, defines height/max-height, and basic styling
        <div className="flex flex-col h-[600px] max-h-[80vh] w-full bg-white dark:bg-gray-800 shadow-xl rounded-lg border border-gray-200 dark:border-gray-700">

            {/* Header (Optional but recommended) */}
            <div className="p-3 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
                <h2 className="text-lg font-semibold text-center text-gray-800 dark:text-white">Chat Assistant</h2>
            </div>

            {/* Message Display Area - Scrollable */}
            <div
                ref={messageContainerRef} // Assign ref to the scrollable container
                className="flex-grow p-4 overflow-y-auto space-y-4" // Key classes: flex-grow, overflow-y-auto
            >
                {messages.map((msg) => (
                     // Use flex container for alignment based on sender
                     <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Message bubble with styling based on sender */}
                        <div className={`max-w-[80%] p-3 rounded-lg shadow-md ${getMessageStyle(msg.sender)}`}>
                             {/* Message text - pre-wrap preserves whitespace/newlines */}
                             <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                             {/* Timestamp */}
                             <p className="text-xs opacity-70 mt-1 text-right">{formatTimestamp(msg.timestamp)}</p>
                        </div>
                    </div>
                ))}
                {/* Empty div at the end. When this div scrolls into view, it means we are at the bottom. */}
                <div ref={messagesEndRef} />
            </div>

             {/* Loading Indicator (Optional) */}
             {isSending && (
                <div className="px-4 pb-2 text-sm text-gray-500 dark:text-gray-400 italic text-center">
                    AI is thinking...
                </div>
             )}


            {/* Message Input Area */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={handleInputChange}
                        placeholder="Ask about services or booking..."
                        disabled={isSending}
                        className="flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50"
                        aria-label="Chat message input"
                    />
                    <button
                        type="submit"
                        disabled={isSending || !inputMessage.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-150"
                        aria-label="Send chat message"
                    >
                        {isSending ? '...' : 'Send'}
                    </button>
                </form>
            </div>
        </div>
    );
}
