// src/components/chat/MessageInput.tsx
'use client'; // This directive marks this as a Client Component

import { useChatStore } from '@/store/chatStore'; // Import the Zustand chat store
import { FormEvent } from 'react'; // Import FormEvent type

// This Client Component handles the user's chat input and the send button.
export default function MessageInput() {
  // Access state and actions from the Zustand store
  const { inputMessage, setInputMessage, isSending, sendMessage } = useChatStore();

  // Handle input field changes
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputMessage(event.target.value); // Update the inputMessage state in the store
  };

  // Handle form submission (sending the message)
  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent default form submission

    console.log('MessageInput: handleSend called.'); // Debug log
    console.log('MessageInput: inputMessage value:', inputMessage); // Debug log - Check the value before sending

    // Call the sendMessage action from the store
    sendMessage(inputMessage);
  };

  // Handle pressing Enter key in the input field
  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) { // Send on Enter, but not Shift+Enter
      event.preventDefault(); // Prevent new line
      handleSend(event as any); // Call the send handler (cast needed for FormEvent type)
    }
  };


  return (
    // Form for the message input and send button
    <form onSubmit={handleSend} className="flex items-center space-x-4">
      {/* Message Input Field */}
      <input
        type="text"
        placeholder={isSending ? 'Sending...' : 'Type your message...'} // Placeholder text changes when sending
        value={inputMessage} // Controlled component: input value is tied to state
        onChange={handleInputChange} // Update state on change
        onKeyPress={handleKeyPress} // Handle Enter key press
        className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        Send
      </button>
    </form>
  );
}
