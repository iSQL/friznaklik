// src/components/chat/ChatMessage.tsx
'use client'; // This directive marks this as a Client Component

import { format } from 'date-fns'; // Import format from date-fns for timestamp display

// Define the type for a single message (should match the type in chatStore.ts)
interface ChatMessage {
  text: string;
  sender: 'user' | 'ai' | 'admin';
  timestamp: Date;
  id: string;
}

// Define the props for the ChatMessage component
interface ChatMessageProps {
  message: ChatMessage; // Expects a single chat message object
}

// This Client Component renders a single chat message bubble.
// It styles the message based on the sender.
export default function ChatMessage({ message }: ChatMessageProps) {
  // Determine styling based on the sender
  const isUser = message.sender === 'user';
  const isAI = message.sender === 'ai';

  // Tailwind classes for message alignment and background color
  const messageClasses = isUser
    ? 'ml-auto bg-blue-500 text-white' // User messages on the right, blue background
    : isAI
    ? 'mr-auto bg-gray-300 text-gray-800' // AI messages on the left, gray background
    : 'mr-auto bg-green-300 text-gray-800'; // Admin messages on the left, green background (example)

  // Tailwind classes for text alignment within the bubble
  const textAlignmentClasses = isUser ? 'text-right' : 'text-left';

  // Format the timestamp for display
  const formattedTimestamp = format(message.timestamp, 'HH:mm'); // Format as hour:minute

  return (
    // Container for the message bubble
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}> {/* Align bubble based on sender */}
      <div className={`flex flex-col max-w-xs md:max-w-md lg:max-w-lg p-3 rounded-lg shadow-md ${messageClasses}`}>
        {/* Message text */}
        <div className={textAlignmentClasses}>
          <p className="text-sm break-words">{message.text}</p> {/* Use break-words to prevent overflow */}
        </div>
        {/* Timestamp */}
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-600'} ${textAlignmentClasses}`}>
          {formattedTimestamp}
        </div>
      </div>
    </div>
  );
}
