// src/app/chat/page.tsx
'use client'; // This directive marks this as a Client Component

import { useChatStore } from '@/store/chatStore'; // Import the Zustand chat store
import ChatWindow from '@/components/chat/ChatWindow'; // Import the main chat window component
import { useEffect, useState } from 'react'; // Import useEffect and useState
import { useAuth } from '@clerk/nextjs'; // Import useAuth hook for client-side auth
import { formatErrorMessage } from '@/lib/errorUtils'; // Import the error utility

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
          const response = await fetch(`${SITE_URL}/api/chat/history`); 
          if (!response.ok) {
              const errorText = await response.text();
              // Throw a more structured error for formatErrorMessage
              throw { 
                message: `Failed to fetch chat history: ${response.status}`, 
                details: errorText,
                status: response.status
              };
          }
          const data: ChatMessage[] = await response.json(); 

          // Parse timestamp strings into Date objects
          const parsedMessages = data.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp), // Parse the timestamp string
          }));

          setMessages(parsedMessages); // Set the fetched history in the store

        } catch (err: unknown) { // Catch unknown
          // Use the centralized error formatter
          const formattedError = formatErrorMessage(err, "fetching chat history");
          setHistoryError(formattedError);
          
          // Add an error message to the chat if history fetch fails
          addMessage({
            text: formattedError, // Use the formatted error for the chat message too
            sender: 'ai',
            timestamp: new Date(), 
            id: Date.now().toString() + Math.random().toString(36).substring(2, 9), 
          });
        } finally {
          setIsLoadingHistory(false);
        }
      };

      fetchChatHistory();
    } else if (isLoaded && !isSignedIn) {
        setIsLoadingHistory(false);
        setHistoryError("Please log in to view chat history."); // Set a user-friendly message
        // Optionally add a message to the chat indicating user needs to log in
        // addMessage({
        //   text: 'Please log in to view chat history.',
        //   sender: 'ai',
        //   timestamp: new Date(),
        //   id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        // });
    } else if (!isLoaded) {
        // Still waiting for auth to load
        setIsLoadingHistory(true);
    }


  }, [isLoaded, isSignedIn, userId]); // Re-run when auth state changes


  return (
    <div className="container mx-auto p-6 h-full flex flex-col"> {/* Use flex-col for layout */}
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">AI Chat Assistant</h1>

      {/* Display loading or error state for history */}
      {isLoadingHistory && !historyError ? ( // Show loading only if no error yet
          <p className="text-center text-gray-600 dark:text-gray-400">Loading chat history...</p>
      ) : historyError ? (
          <div role="alert" className="alert alert-error shadow-lg max-w-2xl mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
                <h3 className="font-bold">Error!</h3>
                <div className="text-xs">{historyError}</div>
            </div>
          </div>
      ) : (
        // Render the main ChatWindow component once history is loaded or if not signed in (ChatWindow might handle this)
        <ChatWindow />
        // This component uses the messages from the store
      )}

    </div>
  );
}
