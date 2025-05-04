// src/store/chatStore.ts

import { create } from 'zustand'; // Import the create function from Zustand

// Define the type for a single message
interface ChatMessage {
  text: string;        // The content of the message
  sender: 'user' | 'ai' | 'admin'; // Who sent the message
  timestamp: Date;     // When the message was sent (for sorting/display)
  id: string;          // Unique ID for the message (helpful for lists)
}

// Define the shape of the state in the chat store
interface ChatState {
  messages: ChatMessage[]; // Array of chat messages
  inputMessage: string;    // The current text in the user's input field
  isSending: boolean;      // Indicates if a message is being sent to the AI

  // Actions to update the state
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void; // Add a new message (ID and timestamp generated)
  setInputMessage: (message: string) => void; // Update the input field text
  setIsSending: (sending: boolean) => void;   // Set the sending status
  clearChat: () => void;                     // Clear all messages (optional)

  // New async action to send message to backend API
  sendMessage: (messageText: string) => Promise<void>; // <-- Ensure this is in the interface
}

// Define the base URL for your API.
// Use NEXT_PUBLIC_SITE_URL which should be set in your .env file (e.g., http://localhost:3000)
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';


// Create the Zustand store
export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state values
  messages: [],
  inputMessage: '',
  isSending: false,

  // Action implementations
  addMessage: (message) => set((state) => ({
    messages: [
      ...state.messages,
      {
        ...message,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9), // Simple unique ID
        timestamp: new Date(),
      },
    ],
  })),
  setInputMessage: (message) => set({ inputMessage: message }),
  setIsSending: (sending) => set({ isSending: sending }),
  clearChat: () => set({ messages: [] }),

  // Async action to send message to backend API
  sendMessage: async (messageText: string) => { // <-- Ensure this implementation exists
    // Prevent sending if already sending or message is empty
    if (get().isSending || !messageText.trim()) {
      return;
    }

    // Add user message to the chat
    get().addMessage({ text: messageText, sender: 'user' });
    // Clear the input field
    get().setInputMessage('');
    // Set sending status to true
    get().setIsSending(true);

    try {
      // Call the backend API to send the message to the AI
      // This will hit your src/app/api/chat/route.ts POST handler (to be created)
      const response = await fetch(`${SITE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) {
         const errorText = await response.text();
         throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json(); // Assuming the API returns JSON with the AI's response

      // Add AI response to the chat
      get().addMessage({ text: data.reply || 'Sorry, I could not get a response.', sender: 'ai' }); // Assuming AI response is in data.reply


    } catch (err: any) {
      console.error('Error sending message:', err);
      // Add an error message to the chat if the API call fails
      get().addMessage({ text: `Error sending message: ${err.message || 'Unknown error'}`, sender: 'ai' });
    } finally {
      // Set sending status back to false
      get().setIsSending(false);
    }
  },
}));
