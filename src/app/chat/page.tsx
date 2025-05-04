// src/app/chat/page.tsx
'use client'; // This directive marks this as a Client Component

// Removed unused import: import { useBookingStore } from '@/store/bookingStore'; // Import the Zustand booking store
import { useChatStore } from '@/store/chatStore'; // Import the Zustand chat store
import ChatWindow from '@/components/chat/ChatWindow'; // Import the main chat window component
import { useEffect } from 'react'; // Import useEffect

// This Client Component page serves as the main container for the AI chat interface.
export default function ChatPage() {
  // Access actions from the Zustand store
  // Removed unused access: const { resetBooking } = useChatStore(); // Example: Maybe reset booking state when entering chat

  // Optional: Reset chat state when the component mounts/unmounts
  // useEffect(() => {
  //   // Maybe clear chat history when entering the page
  //   // useChatStore.getState().clearChat();
  //   // return () => {
  //   //   // Maybe clear chat history when leaving the page
  //   //   // useChatStore.getState().clearChat();
  //   // };
  // }, []);


  return (
    <div className="container mx-auto p-6 h-full flex flex-col"> {/* Use flex-col for layout */}
      <h1 className="text-3xl font-bold mb-6 text-gray-800">AI Chat Assistant</h1>

      {/* Render the main ChatWindow component */}
      {/* This component will contain the message list and input */}
      <ChatWindow /> {/* This component will be created next */}

    </div>
  );
}
