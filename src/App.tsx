import React, { useState, useEffect, useRef } from 'react';
import {
  ChatConversation,
  ChatMessage,
  AppSettings,
  Attachment
} from './types';
import {
  loadConversations,
  saveConversations,
  loadActiveChatId,
  saveActiveChatId,
  loadSettings,
  saveSettings,
  createInitialConversation
} from './utils/storage';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { ShortcutsModal } from './components/ShortcutsModal';

export default function App() {
  const [conversations, setConversations] = useState<ChatConversation[]>(() => loadConversations());
  const [activeChatId, setActiveChatId] = useState<string | null>(() => loadActiveChatId() || conversations[0]?.id || null);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState<boolean>(false);
  
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [streamingGrounding, setStreamingGrounding] = useState<any[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state changes to localStorage
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    if (activeChatId) {
      saveActiveChatId(activeChatId);
    }
  }, [activeChatId]);

  useEffect(() => {
    saveSettings(settings);
    // Apply light/dark class to HTML document
    if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [settings]);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + O : New Chat
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleNewChat();
      }
      // Ctrl + / : Toggle Shortcuts Modal
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      }
      // Esc : Close Modals / Sidebar
      if (e.key === 'Escape') {
        setIsSidebarOpen(false);
        setIsSettingsOpen(false);
        setIsShortcutsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Active Conversation Helper
  const activeChat = conversations.find((c) => c.id === activeChatId) || conversations[0] || null;

  // New Chat
  const handleNewChat = () => {
    const now = new Date().toISOString();
    const newChat: ChatConversation = {
      id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: 'New Chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };

    setConversations((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  // Rename Chat
  const handleRenameChat = (id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle, updatedAt: new Date().toISOString() } : c))
    );
  };

  // Delete Chat
  const handleDeleteChat = (id: string) => {
    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== id);
      if (remaining.length === 0) {
        const fresh = createInitialConversation();
        setActiveChatId(fresh.id);
        return [fresh];
      }
      if (activeChatId === id) {
        setActiveChatId(remaining[0].id);
      }
      return remaining;
    });
  };

  // Pin Chat
  const handleTogglePinChat = (id: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isPinned: !c.isPinned } : c))
    );
  };

  // Clear All History
  const handleClearAllHistory = () => {
    if (confirm('Are you sure you want to delete ALL conversation history?')) {
      const initial = [createInitialConversation()];
      setConversations(initial);
      setActiveChatId(initial[0].id);
      setIsSettingsOpen(false);
    }
  };

  // Clear Messages in Active Chat
  const handleClearCurrentChat = () => {
    if (!activeChatId) return;
    if (confirm('Clear all messages in this conversation?')) {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeChatId ? { ...c, messages: [], updatedAt: new Date().toISOString() } : c))
      );
    }
  };

  // Send Message with Streaming API
  const handleSendMessage = async (text: string, attachments: Attachment[] = []) => {
    if (!activeChatId || isGenerating) return;

    let targetChat = conversations.find((c) => c.id === activeChatId);
    if (!targetChat) return;

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      text,
      attachments,
      timestamp: new Date().toISOString(),
    };

    // Auto update title if first message
    const isFirstUserMessage = !targetChat.messages.some((m) => m.role === 'user');
    const updatedTitle = isFirstUserMessage
      ? text.slice(0, 32) + (text.length > 32 ? '...' : '')
      : targetChat.title;

    const updatedMessages = [...targetChat.messages, userMessage];

    // Optimistically update conversation
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              title: updatedTitle,
              messages: updatedMessages,
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );

    // Call SSE Streaming route
    triggerStreamGeneration(updatedMessages);
  };

  const triggerStreamGeneration = async (historyMessages: ChatMessage[]) => {
    if (isGenerating) return;
    setIsGenerating(true);
    setStreamingText('');
    setStreamingGrounding([]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: historyMessages,
          model: settings.model,
          systemPrompt: settings.systemPrompt,
          enableGrounding: true,
        }),
      });

      if (!response.ok) {
        // Fallback to /api/chat non-streaming if stream is unavailable or error
        const altResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: historyMessages,
            model: settings.model,
            systemPrompt: settings.systemPrompt,
            enableGrounding: true,
          }),
        });

        if (!altResponse.ok) {
          const errorData = await altResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP Error ${altResponse.status}`);
        }

        const data = await altResponse.json();
        const finalModelMsg: ChatMessage = {
          id: `msg_${Date.now()}_model`,
          role: 'model',
          text: data.text || 'I apologize, but I could not generate a response.',
          timestamp: new Date().toISOString(),
          groundingSources: data.groundingSources && data.groundingSources.length > 0 ? data.groundingSources : undefined,
        };

        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeChatId
              ? {
                  ...c,
                  messages: [...c.messages, finalModelMsg],
                  updatedAt: new Date().toISOString(),
                }
              : c
          )
        );

        if (settings.enableVoiceOutput && 'speechSynthesis' in window && data.text) {
          window.speechSynthesis.cancel();

const cleanText = (data.text || "")
  .replace(/```[\s\S]*?```/g, "")
  .replace(/`/g, "")
  .replace(/[#*_>~-]/g, "")
  .replace(/\\/g, "")
  .replace(/\bbackspace\b/gi, "")
  .replace(/\bback space\b/gi, "")
  .replace(/\bbackslash\b/gi, "")
  .replace(/\bback slash\b/gi, "")
  .replace(/\n+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const utterance = new SpeechSynthesisUtterance(cleanText);
utterance.lang = "en-IN";
utterance.rate = 0.75;
utterance.pitch = 1;
utterance.volume = 1;

const voices = window.speechSynthesis.getVoices();
utterance.voice =
  voices.find(v => v.lang === "en-US" && v.name.includes("Google")) ??
  voices.find(v => v.lang === "en-US") ??
  null;

window.speechSynthesis.speak(utterance);
        }

        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      let accumulatedText = '';
      let groundingSources: any[] = [];
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) continue;
            if (trimmed === 'data: [DONE]') break;

            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6).trim();
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  accumulatedText += parsed.text;
                  setStreamingText(accumulatedText);
                }
                if (parsed.groundingSources) {
                  groundingSources = parsed.groundingSources;
                  setStreamingGrounding(groundingSources);
                }
              } catch (e) {
                // ignore
              }
            }
          }
        }

        if (buffer.trim().startsWith('data: ')) {
          const dataStr = buffer.trim().slice(6).trim();
          if (dataStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulatedText += parsed.text;
                setStreamingText(accumulatedText);
              }
              if (parsed.groundingSources) {
                groundingSources = parsed.groundingSources;
                setStreamingGrounding(groundingSources);
              }
            } catch (e) {
              // ignore
            }
          }
        }
      }

      // Complete stream
      const finalModelMessage: ChatMessage = {
        id: `msg_${Date.now()}_model`,
        role: 'model',
        text: accumulatedText || 'I apologize, but I could not generate a response.',
        timestamp: new Date().toISOString(),
        groundingSources: groundingSources.length > 0 ? groundingSources : undefined,
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChatId
            ? {
                ...c,
                messages: [...c.messages, finalModelMessage],
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );

      // Auto Read Aloud if enabled
      // Auto Read Aloud if enabled
if (settings.enableVoiceOutput && "speechSynthesis" in window) {
  window.speechSynthesis.cancel();

  const cleanText = accumulatedText
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`/g, "")
    .replace(/[#*_>~-]/g, "")
    .replace(/\\/g, "")
    .replace(/\bback ?space\b/gi, "")
    .replace(/\bback ?slash\b/gi, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

 const utterance = new SpeechSynthesisUtterance(cleanText);

utterance.lang = "en-IN";
utterance.rate = 0.75;
utterance.pitch = 1.0;
utterance.volume = 1.0;

const voices = window.speechSynthesis.getVoices();

utterance.voice =
  voices.find(
    (voice) =>
      voice.lang === "en-US" &&
      voice.name.toLowerCase().includes("google")
  ) ||
  voices.find((voice) => voice.lang === "en-US") ||
  null;

window.speechSynthesis.speak(utterance);
}
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Generation aborted by user.');
      } else {
        console.error('Streaming error:', err);
        const errorMsg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          role: 'model',
          text: `Error generating response: ${err.message || 'Network error'}`,
          timestamp: new Date().toISOString(),
          isError: true,
        };
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeChatId
              ? { ...c, messages: [...c.messages, errorMsg], updatedAt: new Date().toISOString() }
              : c
          )
        );
      }
    } finally {
      setIsGenerating(false);
      setStreamingText('');
      setStreamingGrounding([]);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleRegenerateResponse = () => {
    if (!activeChat || activeChat.messages.length === 0) return;

    // Filter out trailing model response
    let updatedHistory = [...activeChat.messages];
    if (updatedHistory[updatedHistory.length - 1].role === 'model') {
      updatedHistory.pop();
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, messages: updatedHistory } : c))
    );

    triggerStreamGeneration(updatedHistory);
  };

  const handleEditMessage = (messageId: string, newText: string) => {
    if (!activeChat) return;

    const msgIndex = activeChat.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const truncatedMessages = activeChat.messages.slice(0, msgIndex);
    const editedUserMsg: ChatMessage = {
      ...activeChat.messages[msgIndex],
      text: newText,
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...truncatedMessages, editedUserMsg];

    setConversations((prev) =>
      prev.map((c) => (c.id === activeChatId ? { ...c, messages: newHistory } : c))
    );

    triggerStreamGeneration(newHistory);
  };

  const handleDeleteMessage = (messageId: string) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? { ...c, messages: c.messages.filter((m) => m.id !== messageId) }
          : c
      )
    );
  };

  const handleToggleLikeMessage = (messageId: string, liked: boolean) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, liked: m.liked === liked ? null : liked } : m
              ),
            }
          : c
      )
    );
  };

  const handleImportBackup = (importedConversations: ChatConversation[]) => {
    setConversations(importedConversations);
    if (importedConversations.length > 0) {
      setActiveChatId(importedConversations[0].id);
    }
    alert(`Successfully imported ${importedConversations.length} conversation(s)!`);
  };

  return (
   <div className={`flex h-dvh w-screen overflow-hidden font-['Inter',sans-serif] ${settings.theme === 'light' ? 'bg-slate-50 text-slate-900' : 'bg-[#080c14] text-slate-100'}`}>
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeChatId={activeChatId}
        settings={settings}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onSelectChat={(id) => setActiveChatId(id)}
        onNewChat={handleNewChat}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onTogglePinChat={handleTogglePinChat}
        onClearAll={handleClearAllHistory}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleTheme={() =>
          setSettings((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))
        }
        onImportBackup={handleImportBackup}
      />

      {/* Main Chat Content */}
      <ChatArea
        conversation={activeChat}
        settings={settings}
        isGenerating={isGenerating}
        streamingText={streamingText}
        streamingGrounding={streamingGrounding}
        onSendMessage={handleSendMessage}
        onStopGeneration={handleStopGeneration}
        onRegenerateResponse={handleRegenerateResponse}
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        onToggleLikeMessage={handleToggleLikeMessage}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onToggleVoiceOutput={() =>
          setSettings((prev) => ({ ...prev, enableVoiceOutput: !prev.enableVoiceOutput }))
        }
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleTheme={() =>
          setSettings((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))
        }
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSaveSettings={(newSettings) => setSettings(newSettings)}
        onClearAllHistory={handleClearAllHistory}
      />

      {/* Keyboard Shortcuts Modal */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
        isLight={settings.theme === 'light'}
      />
    </div>
  );
}
