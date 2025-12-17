
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, User, Loader2, Minimize2 } from 'lucide-react';
import { ChatMessage } from '../types';
import { sendChatMessage } from '../services/geminiService';

interface ChatWidgetProps {
  userRole?: string;
}

// Custom Avatar Component for ResQ
const ResQAvatar: React.FC<{ className?: string, animated?: boolean }> = ({ className, animated = false }) => (
  <div className={`${className} flex items-center justify-center`}>
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="robotGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
        <filter id="eyeGlow">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      <g className={animated ? "animate-bounce-avatar" : ""}>
        {/* Wacky Antenna */}
        <path d="M50 20 Q55 5 70 8" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" fill="none" className={animated ? "animate-wiggle" : ""} />
        <circle cx="70" cy="8" r="6" fill="#facc15" className={animated ? "animate-ping-slow" : ""} />
        <circle cx="70" cy="8" r="6" fill="#facc15" stroke="#eab308" strokeWidth="2" />

        {/* Big Head Shape - Maximized Size */}
        <rect x="8" y="20" width="84" height="75" rx="22" fill="url(#robotGradient)" stroke="#cbd5e1" strokeWidth="3" />
        
        {/* Face Screen - Taking up significant space */}
        <rect x="16" y="32" width="68" height="50" rx="14" fill="#0f172a" />

        {/* Crazy Eyes (Heterochromia Size) */}
        <g filter="url(#eyeGlow)">
            {/* Left Eye - Huge & Wide */}
            <circle cx="38" cy="52" r="12" fill="#0ea5e9" className={animated ? "animate-blink-random" : ""} />
            <circle cx="42" cy="48" r="4" fill="white" opacity="0.9" />
            
            {/* Right Eye - Small & Zoomed */}
            <circle cx="68" cy="52" r="7" fill="#0ea5e9" className={animated ? "animate-blink-random-delay" : ""} />
            <circle cx="70" cy="50" r="2" fill="white" opacity="0.9" />
        </g>
        
        {/* Blushing Cheeks */}
        <circle cx="25" cy="70" r="5" fill="#f472b6" opacity="0.6" />
        <circle cx="75" cy="70" r="5" fill="#f472b6" opacity="0.6" />

        {/* Funny Wobbly Mouth */}
         <path d="M40 70 Q50 80 60 70" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
    </svg>
    <style dangerouslySetInnerHTML={{__html: `
      @keyframes bounce-avatar {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        33% { transform: translateY(-3px) rotate(-3deg); }
        66% { transform: translateY(-1px) rotate(3deg); }
      }
      .animate-bounce-avatar {
        animation: bounce-avatar 3s ease-in-out infinite;
      }
      @keyframes wiggle {
        0% { d: path("M50 20 Q55 5 70 8"); }
        50% { d: path("M50 20 Q45 5 30 8"); }
        100% { d: path("M50 20 Q55 5 70 8"); }
      }
      .animate-wiggle {
        animation: wiggle 1.5s ease-in-out infinite;
      }
      @keyframes blink-random {
        0%, 96%, 100% { transform: scaleY(1); }
        98% { transform: scaleY(0.1); }
      }
      .animate-blink-random {
        animation: blink-random 2.5s infinite;
        transform-origin: center;
      }
       @keyframes blink-random-delay {
        0%, 96%, 100% { transform: scaleY(1); }
        98% { transform: scaleY(0.1); }
      }
      .animate-blink-random-delay {
        animation: blink-random-delay 3.5s infinite 0.2s;
        transform-origin: center;
      }
      @keyframes ping-slow {
        75%, 100% { transform: scale(1.4); opacity: 0; }
      }
      .animate-ping-slow {
        animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        transform-origin: 70px 8px;
      }
      @keyframes float-bubble {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-6px); }
      }
      .animate-float-bubble {
        animation: float-bubble 4s ease-in-out infinite;
      }
    `}} />
  </div>
);

const ChatWidget: React.FC<ChatWidgetProps> = ({ userRole = 'Hobbyist' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello! 👋 I'm ResQ.\n\nI can help you identify components, suggest creative project ideas, or guide you through repairs. Ask me anything!",
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      // Filter previous messages to send as history
      // Note: We don't include the message we just added (userMessage) in history 
      // because Gemini's sendMessage accepts the new message separately.
      const history = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      const responseText = await sendChatMessage(history, userMessage.text, userRole);

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "My circuits are a bit overloaded. Please try again in a moment! ⚡",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Chat Window */}
      {isOpen && (
        <div className="pointer-events-auto mb-4 w-[350px] sm:w-[400px] h-[500px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-10 duration-200">
          {/* Header */}
          <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-700/50 rounded-full border border-slate-600 overflow-hidden relative p-1">
                 <ResQAvatar className="w-full h-full" animated={true} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">ResQ AI</h3>
                <p className="text-xs text-blue-400 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  ONLINE
                </p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/50">
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* Avatar Bubble */}
                <div className={`
                  w-9 h-9 rounded-full flex items-center justify-center shrink-0 border overflow-hidden
                  ${msg.role === 'user' ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'}
                `}>
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-white" />
                  ) : (
                    <div className="w-full h-full p-0.5">
                       <ResQAvatar className="w-full h-full" />
                    </div>
                  )}
                </div>
                
                <div className={`
                  max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm
                  ${msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                  }
                `}>
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                  <span className="text-[10px] opacity-50 mt-1 block">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden">
                   <div className="w-full h-full p-0.5">
                      <ResQAvatar className="w-full h-full" animated={true} />
                   </div>
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 border border-slate-700 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  <span className="text-xs text-slate-400">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-700">
            <div className="relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask ResQ..."
                className="w-full bg-slate-800 text-white text-sm rounded-xl pl-4 pr-12 py-3 border border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-500"
              />
              <button 
                type="submit" 
                disabled={!inputText.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Floating Action Area */}
      <div className="flex items-center gap-4 pointer-events-auto">
        
        {/* Helper Text Bubble - Completely Outside the Button */}
        {!isOpen && (
          <div className="hidden sm:block animate-float-bubble origin-right">
             <div className="bg-white text-slate-900 px-5 py-2.5 rounded-2xl rounded-br-none shadow-xl border-2 border-blue-50 relative">
                <p className="text-xs font-bold whitespace-nowrap flex items-center gap-1">
                  Happy to Assist! <span className="text-blue-500">✨</span>
                </p>
                {/* Speech Bubble Tail */}
                <div className="absolute -right-1.5 bottom-0 w-4 h-4 bg-white transform rotate-45 border-r-2 border-b-2 border-blue-50"></div>
             </div>
          </div>
        )}

        {/* Toggle Button - Contains ONLY Avatar or Close Icon */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-16 h-16 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center overflow-hidden border-4
            ${isOpen 
              ? 'bg-slate-800 text-white border-slate-700 hover:bg-slate-700' 
              : 'bg-white text-slate-900 border-white hover:scale-105 hover:border-blue-50'
            }
          `}
        >
          {isOpen ? (
            <X className="w-8 h-8 text-slate-400" />
          ) : (
            <div className="w-full h-full p-1.5 flex items-center justify-center">
               <ResQAvatar className="w-full h-full" animated={true} />
            </div>
          )}
        </button>
      </div>
    </div>
  );
};

export default ChatWidget;
