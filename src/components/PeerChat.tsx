import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, ShieldCheck } from 'lucide-react';
import { ChatMessage } from '../types';

interface PeerChatProps {
  messages: ChatMessage[];
  isPeerConnected: boolean;
  onSendMessage: (text: string) => void;
}

export const PeerChat: React.FC<PeerChatProps> = ({
  messages,
  isPeerConnected,
  onSendMessage,
}) => {
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && isPeerConnected) {
      onSendMessage(text);
      setText('');
    }
  };

  return (
    <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 shadow-xl flex flex-col h-[320px]">
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-neutral-200">Direct P2P Channel Chat</h3>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>E2E Encrypted</span>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-neutral-500 text-xs">
            Send instant messages, notes, or instructions directly to the connected device.
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.sender === 'system') {
              return (
                <div key={msg.id} className="text-center my-1.5">
                  <span className="text-[11px] text-neutral-500 bg-neutral-950/70 border border-neutral-800/80 px-2.5 py-0.5 rounded-full font-mono">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isMe = msg.sender === 'me';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[82%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                    isMe
                      ? 'bg-cyan-600 text-neutral-950 font-medium rounded-br-none'
                      : 'bg-neutral-800 border border-neutral-700/70 text-neutral-200 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-neutral-500 mt-0.5 px-1 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="pt-2 border-t border-neutral-800 flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isPeerConnected ? 'Type a direct message...' : 'Connect to a peer to chat'}
          disabled={!isPeerConnected}
          className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-cyan-500 transition disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!isPeerConnected || !text.trim()}
          className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          title="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
