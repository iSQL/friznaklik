'use client';

import React, { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import ChatMessage from './ChatMessage';
import { Send, MessageCircle, Loader2 } from 'lucide-react'; 

export default function ChatWindow() {
  const messages = useChatStore((state) => state.messages);
  const inputMessage = useChatStore((state) => state.inputMessage);
  const setInputMessage = useChatStore((state) => state.setInputMessage);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const isSending = useChatStore((state) => state.isSending);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(event.target.value);
  };

  const handleSendMessage = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inputMessage.trim()) {
      sendMessage(inputMessage.trim());
    }
  };

  return (
    <div className="card w-full max-w-6xl mx-auto bg-base-100 shadow-xl flex flex-col h-[70vh] sm:h-[80vh] border border-base-300/50">
      <div className="card-body p-0 flex flex-col h-full">
        <div className="navbar bg-base-200 rounded-t-box min-h-0 py-3 px-4">
          <div className="flex-1 flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold text-base-content">Asistent</span>
          </div>
        </div>

        <div
          ref={messageContainerRef}
          className="flex-grow p-4 overflow-y-auto space-y-2 bg-base-200/30"
        >
          {messages.length === 0 && !isSending && (
            <div className="text-center text-base-content/70 italic py-10">
              Započnite razgovor sa našim asistentom. <br /> Možete pitati o uslugama, cenama ili pomoći oko zakazivanja.
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {isSending && messages.length > 0 && (
          <div className="px-4 pb-2 text-sm text-base-content/60 italic text-center flex items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Asistent odgovara...
          </div>
        )}

        <div className="p-4 border-t border-base-300 bg-base-100 rounded-b-box">
          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <input
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              placeholder={isSending ? "Slanje..." : "Unesite Vašu poruku..."}
              disabled={isSending}
              className="input input-bordered w-full focus:input-primary"
              aria-label="Polje za unos poruke za ćaskanje"
            />
            <button
              type="submit"
              disabled={isSending || !inputMessage.trim()}
              className="btn btn-primary btn-square"
              aria-label="Pošalji poruku"
            >
              {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
