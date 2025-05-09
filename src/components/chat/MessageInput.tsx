// src/components/chat/MessageInput.tsx
'use client'; // This directive marks this as a Client Component

import { useChatStore } from '@/store/chatStore'; // Import the Zustand chat store
import { FormEvent, KeyboardEvent } from 'react'; // Import specific event types

// This Client Component handles the user's chat input and the send button.
export default function MessageInput() {
  // Access state and actions from the Zustand store
  const { inputMessage, setInputMessage, isSending, sendMessage } = useChatStore();

  // Handle input field changes
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputMessage(event.target.value); // Update the inputMessage state in the store
  };

  // Core logic for sending the message
  const submitMessage = () => {
    // Prevent sending if already sending or message is empty/whitespace only
    if (isSending || !inputMessage.trim()) {
      console.log('MessageInput: submitMessage - Message empty or already sending. Aborting.');
      return;
    }

    console.log('MessageInput: submitMessage called.'); 
    console.log('MessageInput: inputMessage value:', inputMessage); 

    // Call the sendMessage action from the store
    sendMessage(inputMessage);
  };

  // Handle form submission (e.g., clicking the Send button)
  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission (page reload)
    submitMessage(); // Call the core message sending logic
  };

  // Handle pressing Enter key in the input field
  const handleKeyPress = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { // Send on Enter, but not Shift+Enter
      event.preventDefault(); // Prevent new line in input/textarea
      submitMessage(); // Call the core message sending logic
    }
  };


  return (
    // Form for the message input and send button
    <form onSubmit={handleFormSubmit} className="flex items-center space-x-4">
      {/* Message Input Field */}
      <input
        type="text"
        placeholder={isSending ? 'Sending...' : 'Type your message...'} // Placeholder text changes when sending
        value={inputMessage} // Controlled component: input value is tied to state
        onChange={handleInputChange} // Update state on change
        onKeyPress={handleKeyPress} // Handle Enter key press
        className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400" // Added dark mode styles
        disabled={isSending} // Disable input while sending
      />

      {/* Send Button */}
      <button
        type="submit"
        className={`bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-md transition-colors ${
          isSending || !inputMessage.trim() ? 'opacity-50 cursor-not-allowed' : '' // Disable if sending or input is empty
        }`}
        disabled={isSending || !inputMessage.trim()} // Disable button
      >
        {isSending ? (
            <span className="loading loading-spinner loading-xs"></span> // DaisyUI spinner
        ) : (
            'Send'
        )}
      </button>
    </form>
  );
}
