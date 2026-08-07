import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Menu, Bot, Settings, Sun, Moon } from 'lucide-react';
import { ChatConversation, AppSettings, Attachment } from '../types';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';

interface ChatAreaProps {
  conversation: ChatConversation | null;
  settings: AppSettings;
  isGenerating: boolean;
  streamingText: string;
  streamingGrounding: any[];
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  onStopGeneration: () => void;
  onRegenerateResponse: () => void;
  onEditMessage: (messageId: string, newText: string) => void;
  onDeleteMessage: (messageId: string) => void;
  onToggleLikeMessage: (messageId: string, liked: boolean) => void;
  onToggleSidebar: () => void;
  onToggleVoiceOutput: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  conversation,
  settings,
  isGenerating,
  streamingText,
  streamingGrounding,
  onSendMessage,
  onStopGeneration,
  onRegenerateResponse,
  onEditMessage,
  onDeleteMessage,
  onToggleLikeMessage,
  onToggleSidebar,
  onToggleVoiceOutput,
  onOpenSettings,
  onToggleTheme,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
 const [autoScroll, setAutoScroll] = useState(true);
const chatContainerRef = useRef<HTMLDivElement>(null);

const handleScroll = () => {
  const container = chatContainerRef.current;
  if (!container) return;

  const isNearBottom =
    container.scrollHeight -
    container.scrollTop -
    container.clientHeight <
    100;

  setAutoScroll(isNearBottom);
};
  const isLight = settings.theme === 'light';

 const scrollToBottom = () => {
  if (!autoScroll) return;

  messagesEndRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "end",
  });
};
 useEffect(() => {
  if (autoScroll) {
    scrollToBottom();
  }
}, [conversation?.messages, streamingText, autoScroll]);
  const messages = conversation?.messages || [];
  const hasMessages = messages.length > 0;

  return (
    <div className={`relative flex flex-1 flex-col h-full w-full overflow-hidden transition-colors ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      {/* Premium Minimal Header */}
     <header
  className={`sticky top-0 z-20 flex h-16 md:h-14 shrink-0 items-center justify-between border-b px-3 sm:px-4 md:px-6 backdrop-blur-md transition-colors ${
    isLight
      ? "border-slate-200 bg-slate-50/80"
      : "border-slate-800 bg-slate-950/80"
  }`}
>
  <div className="flex items-center gap-3 min-w-0">
    <button
      onClick={onToggleSidebar}
      className={`rounded-lg p-2 md:p-1.5 transition-colors focus:outline-none ${
        isLight
          ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          : "text-slate-400 hover:bg-white/10 hover:text-white"
      }`}
      title="Toggle Sidebar"
    >
      <Menu className="h-5 w-5" />
    </button>

    <div className="flex items-center gap-2 min-w-0 select-none">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white">
        <Bot className="h-4 w-4" />
      </div>

      <span
        className={`font-['Poppins'] font-semibold text-sm md:text-base ${
          isLight ? "text-slate-900" : "text-slate-100"
        }`}
      >
        Infinity AI
      </span>
    </div>
  </div>

  <div className="flex items-center gap-2">
        </div>

        {/* Clean Minimal Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            className={`rounded-lg p-2 transition-colors ${isLight ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            title="Toggle Theme"
          >
            {settings.theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-cyan-500" />
            )}
          </button>

          <button
            onClick={onOpenSettings}
            className={`rounded-lg p-2 transition-colors ${isLight ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Chat Conversation Container */}
    <div
  ref={chatContainerRef}
  onScroll={handleScroll}
  className="flex-1 overflow-y-auto px-3 sm:px-6 md:px-12 py-3 md:py-6 space-y-3 md:space-y-6 w-full md:max-w-5xl md:mx-auto"
>
        {/* Minimal Clean ChatGPT-style Welcome Screen */}
        {!hasMessages && (
          <div className="flex h-full min-h-[55vh] flex-col items-center justify-center text-center px-4 max-w-lg mx-auto">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 shadow-xl shadow-cyan-500/20 ring-1 ring-white/20"
            >
              <Bot className="h-7 w-7 text-white" />
            </motion.div>

            <motion.h1
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              className={`font-['Poppins'] font-bold text-2xl sm:text-3xl tracking-tight mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}
            >
              Welcome to Infinity AI
            </motion.h1>

            <motion.p
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className={`text-xs sm:text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}
            >
              Your intelligent AI assistant for coding, mathematics, writing, research, problem solving, and everyday tasks.
            </motion.p>
            <motion.p
  initial={{ y: 0, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ delay: 0.3, duration: 0.5 }}
  className="text-sm text-cyan-300 mt-4"
>
  ✨ Developed by Pushpraj Kumar
</motion.p>
          </div>
        )}

        {/* Conversation Messages */}
        {messages.map((msg, idx) => {
          const isLastModelMsg =
            msg.role === 'model' &&
            idx === messages.length - 1;

          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              settings={settings}
              onRegenerate={isLastModelMsg ? onRegenerateResponse : undefined}
              onEdit={(newText) => onEditMessage(msg.id, newText)}
              onDelete={() => onDeleteMessage(msg.id)}
              onToggleLike={(liked) => onToggleLikeMessage(msg.id, liked)}
            />
          );
        })}

        {/* Live Streaming AI Response */}
        {isGenerating && streamingText && (
          <MessageBubble
            message={{
              id: 'streaming_msg',
              role: 'model',
              text: streamingText,
              timestamp: new Date().toISOString(),
              groundingSources: streamingGrounding,
            }}
            settings={settings}
            isStreaming={true}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <ChatInput
        onSendMessage={onSendMessage}
        isGenerating={isGenerating}
        onStopGeneration={onStopGeneration}
        settings={settings}
        onToggleVoiceOutput={onToggleVoiceOutput}
      />
    </div>
  );
};
