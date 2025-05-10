'use client';

import { format } from 'date-fns';
import { User, Bot, UserCog } from 'lucide-react';

interface ChatMessageData {
  text: string;
  sender: 'user' | 'ai' | 'admin';
  timestamp: Date;
  id: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === 'user';

  const getSenderDetails = () => {
    switch (message.sender) {
      case 'user':
        return {
          alignClass: 'items-end',
          bubbleClass: 'bg-primary text-primary-content rounded-br-none',
          name: 'Vi',
          icon: <User className="flex items-center justify-center" />,
        };
      case 'ai':
        return {
          alignClass: 'items-start',
          bubbleClass: 'bg-base-300 text-base-content rounded-bl-none',
          name: 'Asistent',
          icon: <Bot className="flex items-center justify-center" />,
        };
      case 'admin':
        return {
          alignClass: 'items-start',
          bubbleClass: 'bg-secondary text-secondary-content rounded-bl-none',
          name: 'Frizer',
          icon: <UserCog className="flex items-center justify-center-6 w-5" />,
        };
      default:
        return {
          alignClass: 'items-start',
          bubbleClass: 'bg-base-300 text-base-content rounded-bl-none',
          name: 'Nepoznato',
          icon: <User className="h-4 w-4" />,
        };
    }
  };

  const { alignClass, bubbleClass, name, icon } = getSenderDetails();
  
  let formattedTimestamp: string;
  try {
    if (message.timestamp instanceof Date && !isNaN(message.timestamp.getTime())) {
      formattedTimestamp = format(message.timestamp, 'HH:mm');
    } else if (typeof message.timestamp === 'string') {
      const parsedDate = new Date(message.timestamp);
      if (!isNaN(parsedDate.getTime())) {
        formattedTimestamp = format(parsedDate, 'HH:mm');
      } else {
        formattedTimestamp = "N/A"; 
      }
    } else {
      formattedTimestamp = "N/A"; 
    }
  } catch (error) {
    console.error("Greška pri formatiranju vremena:", error);
    formattedTimestamp = "Greška";
  }


  return (
    <div className={`flex flex-col w-full ${alignClass} mb-3`}>
      <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`avatar placeholder ${isUser ? 'ml-2' : 'mr-2'}`}>
            <div className={`bg-neutral text-neutral-content rounded-full w-6 h-6 text-xs flex items-center justify-center`}>
                {icon}
            </div>
        </div>
        <span className="text-xs font-medium text-base-content/70">{name}</span>
      </div>
      <div
        className={`chat-bubble ${bubbleClass} max-w-[80%] sm:max-w-[70%] md:max-w-[60%] p-3 rounded-lg shadow-md break-words whitespace-pre-wrap`}
      >
        <p className="text-sm">{message.text}</p>
        <div className={`text-xs mt-1.5 opacity-70 ${isUser ? 'text-right' : 'text-left'}`}>
          {formattedTimestamp}
        </div>
      </div>
    </div>
  );
}
