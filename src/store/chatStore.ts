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
  // setMessages action to load initial history
  setMessages: (messages: ChatMessage[]) => void;
  // addMessage now takes the full ChatMessage object
  addMessage: (message: ChatMessage) => void;
  setInputMessage: (message: string) => void; // Update the input field text
  setIsSending: (sending: boolean) => void;   // Set the sending status
  clearChat: () => void;                     // Clear all messages (optional)

  // New async action to send message to backend API
  sendMessage: (messageText: string) => Promise<void>;
}

// Define the base URL for your API.
const SITE_URL = process.env.PUBLIC_SITE_URL || 'http://localhost:3000';


// Create the Zustand store
export const useChatStore = create<ChatState>((set, get) => ({
  // Initial state values
  messages: [],
  inputMessage: '',
  isSending: false,

  // Action implementations
  // Action to set the entire messages array (for loading history)
  setMessages: (messages) => set({ messages }),
  // Action to add a single message (now takes the full object)
  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),
  setInputMessage: (message) => set({ inputMessage: message }),
  setIsSending: (sending) => set({ isSending: sending }),
  clearChat: () => set({ messages: [] }),

  // Async action to send message to backend API
  sendMessage: async (messageText: string) => {
    // Prevent sending if already sending or message is empty
    if (get().isSending || !messageText.trim()) {
      return;
    }

    // Create the user message object with ID and timestamp before adding
    const userMessageObject: ChatMessage = {
        text: messageText,
        sender: 'user',
        timestamp: new Date(),
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9), // Simple unique ID
    };

    // Add user message to the chat
    get().addMessage(userMessageObject);
    // Clear the input field
    get().setInputMessage('');
    // Set sending status to true
    get().setIsSending(true);

    // Prepare the request body - Send the entire userMessageObject
    const requestBody = JSON.stringify(userMessageObject); // Corrected: Send the full object

    console.log('chatStore: Sending fetch request with body:', requestBody); // Debug log - Log the request body

    try {
      // Call the backend API to send the message to the AI and save it
      // This will hit your src/app/api/chat/route.ts POST handler
      const response = await fetch(`${SITE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send the full user message object, including ID and timestamp
        body: requestBody, // Use the prepared requestBody
      });

      if (!response.ok) {
         const errorText = await response.text();
         throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      // Assuming the API returns the AI's response including its ID and timestamp
      const aiResponseMessage: ChatMessage = await response.json();

      // Add AI response to the chat
      get().addMessage({
          ...aiResponseMessage,
          timestamp: new Date(aiResponseMessage.timestamp), // Ensure timestamp is a Date object
      });


    } catch (err: any) {
      console.error('Error sending message:', err);
      // Add an error message to the chat if the API call fails
      get().addMessage({
          text: `Error sending message: ${err.message || 'Unknown error'}`,
          sender: 'ai',
          timestamp: new Date(), // Add timestamp for the error message
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9), // Simple unique ID
      });
    } finally {
      // Set sending status back to false
      get().setIsSending(false);
    }
  },
}));
