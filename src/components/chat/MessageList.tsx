// src/components/chat/MessageList.tsx
'use client'; // This directive marks this as a Client Component

// Define the type for a single message (should match the type in chatStore.ts)
interface ChatMessage {
  text: string;
  sender: 'user' | 'ai' | 'admin';
  timestamp: Date;
  id: string;
}

import Message from './ChatMessage'; // Import the ChatMessage component (to be created)

// Define the props for the MessageList component
interface MessageListProps {
  messages: ChatMessage[]; // Expects an array of chat messages
}

// This Client Component receives a list of messages and renders them.
export default function MessageList({ messages }: MessageListProps) {
  return (
    // Container for the list of messages
    <div className="space-y-4"> {/* Add spacing between messages */}
      {/* Check if there are any messages to display */}
      {messages.length === 0 ? (
        // Display a welcome or empty state message if no messages yet
        <p className="text-gray-600 text-center italic">Start the conversation!</p>
      ) : (
        // Map over the messages array and render a Message (ChatMessage) component for each
        messages.map((message) => (
          // The key prop is important for React to efficiently update lists
          <Message key={message.id} message={message} /> // Pass the individual message data
        ))
      )}
    </div>
  );
}
