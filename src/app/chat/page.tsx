// src/app/chat/page.tsx
'use client'; // This directive marks this as a Client Component

import { useChatStore } from '@/store/chatStore'; // Import the Zustand chat store
import ChatWindow from '@/components/chat/ChatWindow'; // Import the main chat window component
import { useEffect, useState } from 'react'; // Import useEffect and useState
import { useAuth } from '@clerk/nextjs'; // Import useAuth hook for client-side auth

// Define the type for a single message (should match the type in chatStore.ts)
interface ChatMessage {
  text: string;
  sender: 'user' | 'ai' | 'admin';
  timestamp: Date; // Note: Dates fetched from API might be strings, need parsing
  id: string;
}

// Define the base URL for your API.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';


// This Client Component page serves as the main container for the AI chat interface.
// It now also fetches initial chat history for the logged-in user.
export default function ChatPage() {
  // Access state and actions from the Zustand store
  // Removed direct access at top level to fix getServerSnapshot error
  // The components that *use* the state (ChatWindow, MessageList, MessageInput)
  // will access the store directly.

  // Use useAuth hook to get the logged-in user's authentication status
  const { userId, isLoaded, isSignedIn } = useAuth();

  // State to track loading of chat history
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Fetch chat history when the component mounts and user is signed in
  useEffect(() => {
    // Access store actions *inside* the effect where they are used
    const { setMessages, addMessage } = useChatStore.getState(); // Access state directly in effect

    // Only fetch if auth state is loaded, user is signed in, and on the client side
    if (isLoaded && isSignedIn && userId && typeof window !== 'undefined') { // Added typeof window check
      const fetchChatHistory = async () => {
        setIsLoadingHistory(true);
        setHistoryError(null);
        try {
          // Fetch chat history from a new backend API route
          const response = await fetch(`${SITE_URL}/api/chat/history`); // No need to pass userId here, backend gets it from auth
          if (!response.ok) {
             const errorText = await response.text();
             throw new Error(`Failed to fetch chat history: ${response.status} ${errorText}`);
          }
          const data: ChatMessage[] = await response.json(); // Assuming the API returns an array of messages

          // Parse timestamp strings into Date objects
          const parsedMessages = data.map(msg => ({
              ...msg,
              timestamp: new Date(msg.timestamp), // Parse the timestamp string
          }));

          setMessages(parsedMessages); // Set the fetched history in the store

        } catch (err: any) {
          console.error('Error fetching chat history:', err);
          setHistoryError(err.message || 'Failed to load chat history.');
          // Add an error message to the chat if history fetch fails
          addMessage({
              text: 'Failed to load chat history.',
              sender: 'ai',
              timestamp: new Date(), // Add current timestamp
              id: Date.now().toString() + Math.random().toString(36).substring(2, 9), // Generate a simple ID
          });
        } finally {
          setIsLoadingHistory(false);
        }
      };

      fetchChatHistory();
    } else if (isLoaded && !isSignedIn) {
        // If auth state is loaded but user is not signed in, stop loading and maybe show a message
        setIsLoadingHistory(false);
        // Optionally add a message to the chat indicating user needs to log in
        // Access store action *inside* the conditional block
        // addMessage({
        //     text: 'Please log in to view chat history.',
        //     sender: 'ai',
        //     timestamp: new Date(),
        //     id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        // });
    }

  }, [isLoaded, isSignedIn, userId]); // Re-run when auth state changes (removed setMessages, addMessage from deps)


  return (
    <div className="container mx-auto p-6 h-full flex flex-col"> {/* Use flex-col for layout */}
      <h1 className="text-3xl font-bold mb-6 text-gray-800">AI Chat Assistant</h1>

      {/* Display loading or error state for history */}
      {isLoadingHistory ? (
          <p className="text-center text-gray-600">Loading chat history...</p>
      ) : historyError ? (
          <p className="text-center text-red-600">Error loading history: {historyError}</p>
      ) : (
          // Render the main ChatWindow component once history is loaded
          <ChatWindow />
          // This component uses the messages from the store
      )}

    </div>
  );
}

