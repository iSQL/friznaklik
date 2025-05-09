// src/store/chatStore.ts

import { create } from 'zustand'; // Import the create function from Zustand
import { formatErrorMessage } from '@/lib/errorUtils'; // Import the error utility

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
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  setInputMessage: (message: string) => void; 
  setIsSending: (sending: boolean) => void;   
  clearChat: () => void;                     

  sendMessage: (messageText: string) => Promise<void>;
}

// Define the base URL for your API.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';


// Create the Zustand store
export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state values
  messages: [],
  inputMessage: '',
  isSending: false,

  // Action implementations
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  setInputMessage: (message) => set({ inputMessage: message }),
  setIsSending: (sending) => set({ isSending: sending }),
  clearChat: () => set({ messages: [] }),

  // Async action to send message to backend API
  sendMessage: async (messageText: string) => {
    if (get().isSending || !messageText.trim()) {
      return;
    }

    const userMessageObject: ChatMessage = {
        text: messageText,
        sender: 'user',
        timestamp: new Date(),
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9), 
    };

    get().addMessage(userMessageObject);
    get().setInputMessage('');
    get().setIsSending(true);

    const requestBody = JSON.stringify(userMessageObject); 
    console.log('chatStore: Sending fetch request with body:', requestBody); 

    try {
      const response = await fetch(`${SITE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody, 
      });

      if (!response.ok) {
         const errorText = await response.text();
         // Throw a structured error object for formatErrorMessage
         throw { 
            message: `API request failed with status ${response.status}`, 
            details: errorText,
            status: response.status 
          };
      }

      const aiResponseMessage: ChatMessage = await response.json();
      get().addMessage({
          ...aiResponseMessage,
          timestamp: new Date(aiResponseMessage.timestamp), 
      });

    } catch (err: unknown) { // Catch unknown
      // Use the centralized error formatter
      // The detailed error will be logged to the browser console by formatErrorMessage
      const userFriendlyError = formatErrorMessage(err, "sending chat message");
      
      // Add an error message to the chat if the API call fails
      get().addMessage({
          text: userFriendlyError, // Use the formatted error message
          sender: 'ai',
          timestamp: new Date(), 
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9), 
      });
    } finally {
      get().setIsSending(false);
    }
  },
}));
