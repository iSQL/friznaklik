// src/components/chat/ChatWindow.tsx
'use client'; // This directive marks this as a Client Component

import { useChatStore } from '@/store/chatStore'; // Import the Zustand chat store
import MessageList from './MessageList'; // Import the MessageList component
import MessageInput from './MessageInput'; // Import the MessageInput component
import { useEffect, useRef } from 'react'; // Import React hooks

// This Client Component is the main container for the chat interface.
// It uses the chat store and renders the message list and input area.
export default function ChatWindow() {
  // Access messages and sending status from the Zustand store
  const { messages, isSending } = useChatStore();

  // Ref for scrolling to the bottom of the chat window
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Effect to scroll to the bottom when new messages are added or sending status changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending]); // Depend on messages and isSending


  return (
    <div className="flex flex-col h-full bg-gray-100 rounded-lg shadow-md overflow-hidden">
      {/* Message List Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Render the MessageList component */}
        {/* Pass the messages from the store */}
        <MessageList messages={messages} />
        {/* Element to scroll into view to keep the latest message visible */}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Area */}
      <div className="p-4 bg-white border-t border-gray-200">
         {/* Render the MessageInput component */}
         {/* MessageInput accesses isSending and sendMessage directly from the store */}
         <MessageInput /> {/* Removed isSending prop */}
      </div>
    </div>
  );
}

// Troubleshooting: If you see "Error: Element type is invalid" related to ChatWindow,
// or "Parsing ecmascript source code failed" for this file, it might be due to
// a subtle syntax issue or file corruption.
// Try deleting this file and manually recreating it, copy-pasting the code exactly from this canvas.
