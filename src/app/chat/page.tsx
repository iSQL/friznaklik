'use client';

import { useChatStore } from '@/store/chatStore';
import ChatWindow from '@/components/chat/ChatWindow';
import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { formatErrorMessage } from '@/lib/errorUtils';
import { MessageSquare, AlertTriangle, LogIn, Loader2 } from 'lucide-react'; 

interface ChatMessage {
  text: string;
  sender: 'user' | 'ai' | 'admin';
  timestamp: Date;
  id: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function ChatPage() {
  const { userId, isLoaded, isSignedIn } = useAuth();
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const { setMessages, addMessage, clearChat } = useChatStore.getState();

    if (isLoaded && isSignedIn && userId && typeof window !== 'undefined') {
      const fetchChatHistory = async () => {
        setIsLoadingHistory(true);
        setHistoryError(null);
        try {
          const response = await fetch(`${SITE_URL}/api/chat/history`);
          if (!response.ok) {
              const errorText = await response.text();
              throw {
                message: `Neuspešno preuzimanje istorije ćaskanja: ${response.status}`,
                details: errorText,
                status: response.status
              };
          }
          const data: ChatMessage[] = await response.json();
          const parsedMessages = data.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessages(parsedMessages);
        } catch (err: unknown) {
          const formattedError = formatErrorMessage(err, "preuzimanja istorije ćaskanja");
          setHistoryError(formattedError);
          addMessage({
            text: `Greška: ${formattedError}`,
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
        setHistoryError("Molimo Vas prijavite se da biste videli istoriju ćaskanja.");
        clearChat();
        addMessage({
          text: 'Molimo Vas prijavite se da biste koristili ćaskanje i videli istoriju.',
          sender: 'ai',
          timestamp: new Date(),
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        });
    } else if (!isLoaded) {
        setIsLoadingHistory(true);
    }
  }, [isLoaded, isSignedIn, userId]);

  return (
    <div className="container mx-auto p-4 sm:p-6 h-full flex flex-col">
      <div className="flex items-center mb-6 pb-4 border-b border-base-300">
        <MessageSquare className="h-8 w-8 mr-3 text-primary" />
        <h1 className="text-3xl font-bold text-neutral-content">
          Rezervacija preko poruka
        </h1>
      </div>

      {isLoadingHistory && !historyError ? (
        <div className="flex flex-col items-center justify-center flex-grow text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-lg text-base-content/70">Učitavanje istorije ćaskanja...</p>
        </div>
      ) : historyError && !isSignedIn ? (
         <div role="alert" className="alert alert-info shadow-lg max-w-2xl mx-auto">
            <LogIn className="h-6 w-6"/>
            <div>
                <h3 className="font-bold">Prijavite se</h3>
                <div className="text-xs">{historyError}</div>
            </div>
          </div>
      ) : historyError ? (
          <div role="alert" className="alert alert-error shadow-lg max-w-2xl mx-auto">
            <AlertTriangle className="h-6 w-6"/>
            <div>
                <h3 className="font-bold">Greška!</h3>
                <div className="text-xs">{historyError}</div>
            </div>
          </div>
      ) : (
        <ChatWindow />
      )}
    </div>
  );
}
