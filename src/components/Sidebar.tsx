import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus,
  Search,
  Pin,
  MessageSquare,
  MoreVertical,
  Trash2,
  Pencil,
  Download,
  Share2,
  Settings,
  Bot,
  Sun,
  Moon,
  ChevronLeft,
  FileCode,
  FileText,
  Printer,
  Database,
  Upload
} from 'lucide-react';
import { ChatConversation, AppSettings } from '../types';
import {
  exportChatAsTXT,
  exportChatAsMarkdown,
  exportChatAsPDFPrint,
  exportAllDataBackup
} from '../utils/storage';

interface SidebarProps {
  conversations: ChatConversation[];
  activeChatId: string | null;
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onRenameChat: (id: string, newTitle: string) => void;
  onDeleteChat: (id: string) => void;
  onTogglePinChat: (id: string) => void;
  onClearAll: () => void;
  onOpenSettings: () => void;
  onToggleTheme: () => void;
  onImportBackup: (importedConversations: ChatConversation[]) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeChatId,
  settings,
  isOpen,
  onClose,
  onSelectChat,
  onNewChat,
  onRenameChat,
  onDeleteChat,
  onTogglePinChat,
  onClearAll,
  onOpenSettings,
  onToggleTheme,
  onImportBackup,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const isLight = settings.theme === 'light';

  // Filter conversations
  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.messages.some((m) => m.text.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const pinned = filtered.filter((c) => c.isPinned);
  const unpinned = filtered.filter((c) => !c.isPinned);

  const handleStartRename = (c: ChatConversation) => {
    setEditingId(c.id);
    setEditTitle(c.title);
    setActiveMenuId(null);
  };

  const handleSaveRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameChat(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleShare = async (c: ChatConversation) => {
    setActiveMenuId(null);
    if (navigator.share) {
      try {
        await navigator.share({
          title: c.title,
          text: `Check out this conversation: "${c.title}" on Infinity AI!`,
          url: window.location.href,
        });
      } catch (err) {
        console.warn('Share error:', err);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          onImportBackup(parsed);
        } else if (parsed.conversations && Array.isArray(parsed.conversations)) {
          onImportBackup(parsed.conversations);
        } else {
          alert('Invalid backup JSON file format.');
        }
      } catch (err) {
        alert('Failed to parse backup JSON file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-full max-w-[22rem] sm:w-80 flex-col transition-all duration-300 ease-in-out lg:w-80 lg:max-w-none lg:static lg:translate-x-0 ${
          isLight
            ? 'bg-slate-50 border-r border-slate-200 text-slate-900'
            : 'glass-panel border-r border-white/10 text-slate-100'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 shadow-md text-white font-bold ring-1 ring-white/20">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className={`font-['Poppins'] font-bold text-sm tracking-tight truncate ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                Infinity AI
              </h1>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`rounded-lg p-1.5 lg:hidden shrink-0 ml-1 transition-colors ${
              isLight ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4 pb-2">
          <button
  onClick={() => {
    onNewChat();
    if (window.innerWidth < 1024) onClose();
  }}
  className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 px-4 py-3 lg:py-2.5 font-medium text-sm lg:text-xs text-white shadow-lg shadow-cyan-600/20 transition-all hover:shadow-cyan-600/35 hover:scale-[1.01] active:scale-[0.98]"
>
  <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />
  <span>New Chat</span>
</button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2">
          <div className="relative flex items-center">
           <Search className={`absolute left-3 h-4 w-4 lg:h-3.5 lg:w-3.5 ${isLight ? 'text-slate-400' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full rounded-xl py-2.5 pl-10 pr-3 text-sm lg:text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/50 ${
                isLight
                  ? 'bg-white text-slate-900 placeholder-slate-400 ring-1 ring-slate-200'
                  : 'bg-slate-900/60 text-slate-200 placeholder-slate-500 ring-1 ring-white/10'
              }`}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {/* Pinned Chats */}
          {pinned.length > 0 && (
            <div>
              <div className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                <Pin className="h-3 w-3 text-cyan-500" />
                Pinned
              </div>
              <div className="mt-1 space-y-1">
                {pinned.map((chat) => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    activeChatId={activeChatId}
                    editingId={editingId}
                    editTitle={editTitle}
                    activeMenuId={activeMenuId}
                    isLight={isLight}
                    onSelectChat={(id) => {
                      onSelectChat(id);
                      if (window.innerWidth < 1024) onClose();
                    }}
                    onToggleMenu={(id) => setActiveMenuId(activeMenuId === id ? null : id)}
                    onStartRename={handleStartRename}
                    onSaveRename={handleSaveRename}
                    setEditTitle={setEditTitle}
                    onTogglePin={onTogglePinChat}
                    onDelete={onDeleteChat}
                    onShare={handleShare}
                    onExportTXT={exportChatAsTXT}
                    onExportMD={exportChatAsMarkdown}
                    onExportPDF={exportChatAsPDFPrint}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent Chats */}
          <div>
            <div className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              <MessageSquare className="h-3 w-3" />
              Recent
            </div>
            <div className="mt-1 space-y-1">
              {unpinned.length === 0 && pinned.length === 0 ? (
                <div className={`p-4 text-center text-xs ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>
                  No conversations found
                </div>
              ) : (
                unpinned.map((chat) => (
                  <ChatItem
                    key={chat.id}
                    chat={chat}
                    activeChatId={activeChatId}
                    editingId={editingId}
                    editTitle={editTitle}
                    activeMenuId={activeMenuId}
                    isLight={isLight}
                    onSelectChat={(id) => {
                      onSelectChat(id);
                      if (window.innerWidth < 1024) onClose();
                    }}
                    onToggleMenu={(id) => setActiveMenuId(activeMenuId === id ? null : id)}
                    onStartRename={handleStartRename}
                    onSaveRename={handleSaveRename}
                    setEditTitle={setEditTitle}
                    onTogglePin={onTogglePinChat}
                    onDelete={onDeleteChat}
                    onShare={handleShare}
                    onExportTXT={exportChatAsTXT}
                    onExportMD={exportChatAsMarkdown}
                    onExportPDF={exportChatAsPDFPrint}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer Bar */}
        <div className={`border-t p-3 space-y-2 ${isLight ? 'border-slate-200 bg-slate-100/90 text-slate-700' : 'border-white/10 bg-slate-900/40 text-slate-300'}`}>
          <div className="flex items-center justify-between text-xs px-1">
            <span className="flex items-center gap-1 text-[11px] font-medium">
              <Database className="h-3.5 w-3.5 text-cyan-600" />
              Saved Chats
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${isLight ? 'bg-cyan-50 text-cyan-800 border-cyan-200' : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20'}`}>
              {conversations.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <button
              onClick={() => exportAllDataBackup(conversations, settings)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors border ${
                isLight ? 'bg-white text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border-white/5'
              }`}
              title="Backup All Chats to JSON"
            >
              <Download className="h-3.5 w-3.5 text-cyan-600" />
              Backup
            </button>

            <label className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2 text-xs font-medium transition-colors cursor-pointer border ${
              isLight ? 'bg-white text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 border-slate-200' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border-white/5'
            }`}>
              <Upload className="h-3.5 w-3.5 text-purple-600" />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleFileImport}
                className="hidden"
              />
            </label>
          </div>

          <div className={`flex items-center justify-between pt-2 border-t ${isLight ? 'border-slate-200' : 'border-white/5'}`}>
            <button
              onClick={onToggleTheme}
              className={`flex items-center gap-2 rounded-lg p-2 text-xs font-medium transition-colors ${
                isLight ? 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
              title="Toggle Theme"
            >
              {settings.theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-500" /> Light
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-cyan-600" /> Dark
                </>
              )}
            </button>

            <button
              onClick={onOpenSettings}
              className={`flex items-center gap-1.5 rounded-lg p-2 text-xs font-medium transition-colors ${
                isLight ? 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900' : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
              title="Open Settings"
            >
              <Settings className="h-4 w-4 text-slate-500" /> Settings
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

// Item Component for each conversation
interface ChatItemProps {
  chat: ChatConversation;
  activeChatId: string | null;
  editingId: string | null;
  editTitle: string;
  activeMenuId: string | null;
  isLight: boolean;
  onSelectChat: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onStartRename: (chat: ChatConversation) => void;
  onSaveRename: (id: string) => void;
  setEditTitle: (val: string) => void;
  onTogglePin: (id: string) => void;
  onDelete: (id: string) => void;
  onShare: (chat: ChatConversation) => void;
  onExportTXT: (chat: ChatConversation) => void;
  onExportMD: (chat: ChatConversation) => void;
  onExportPDF: (chat: ChatConversation) => void;
}

const ChatItem: React.FC<ChatItemProps> = ({
  chat,
  activeChatId,
  editingId,
  editTitle,
  activeMenuId,
  isLight,
  onSelectChat,
  onToggleMenu,
  onStartRename,
  onSaveRename,
  setEditTitle,
  onTogglePin,
  onDelete,
  onShare,
  onExportTXT,
  onExportMD,
  onExportPDF,
}) => {
  const isActive = chat.id === activeChatId;
  const isEditing = editingId === chat.id;
  const isMenuOpen = activeMenuId === chat.id;

  return (
    <div className="relative group">
      <div
        onClick={() => !isEditing && onSelectChat(chat.id)}
        className={`flex items-center justify-between gap-2 rounded-xl px-3 py-3 lg:py-2 text-sm lg:text-xs font-medium cursor-pointer transition-all ${
          isActive
            ? isLight
              ? 'bg-cyan-100/90 text-cyan-950 border border-cyan-300 shadow-sm font-semibold'
              : 'bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/10 text-cyan-200 border border-cyan-500/30 shadow-sm'
            : isLight
            ? 'text-slate-700 hover:bg-slate-200/70 hover:text-slate-900'
            : 'text-slate-300 hover:bg-white/5 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <MessageSquare className={`h-3.5 w-3.5 shrink-0 ${isActive ? (isLight ? 'text-cyan-700' : 'text-cyan-400') : 'text-slate-400'}`} />

          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => onSaveRename(chat.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSaveRename(chat.id)}
              autoFocus
              className={`w-full rounded px-2 py-0.5 text-xs focus:outline-none border ${isLight ? 'bg-white text-slate-900 border-cyan-500' : 'bg-slate-900 text-slate-100 border-cyan-500'}`}
            />
          ) : (
            <span className="truncate">{chat.title}</span>
          )}
        </div>

        {!isEditing && (
         <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu(chat.id);
              }}
              className={`rounded p-2 lg:p-1 transition-colors touch-manipulation ${isLight ? 'hover:bg-slate-300/80 text-slate-500 hover:text-slate-900' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
            >
              <MoreVertical className="h-5 w-5 lg:h-3.5 lg:w-3.5" />
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
           className={`absolute right-0 top-10 z-50 w-56 max-w-[90vw] rounded-xl p-2 shadow-2xl border text-sm lg:w-44 lg:text-xs ${
              isLight ? 'bg-white border-slate-200 text-slate-800 shadow-xl' : 'glass-panel border-white/15 text-slate-200'
            }`}
          >
            <button
              onClick={() => onTogglePin(chat.id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 lg:gap-2 lg:px-2.5 lg:py-1.5 transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900' : 'hover:bg-white/10 hover:text-cyan-300'}`}
            >
              <Pin className="h-3.5 w-3.5 text-cyan-600" />
              {chat.isPinned ? 'Unpin Chat' : 'Pin Chat'}
            </button>

            <button
              onClick={() => onStartRename(chat)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 lg:gap-2 lg:px-2.5 lg:py-1.5 transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900' : 'hover:bg-white/10 hover:text-white'}`}
            >
              <Pencil className="h-3.5 w-3.5 text-slate-500" />
              Rename
            </button>

            <button
              onClick={() => onShare(chat)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 lg:gap-2 lg:px-2.5 lg:py-1.5 transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900' : 'hover:bg-white/10 hover:text-white'}`}
            >
              <Share2 className="h-3.5 w-3.5 text-blue-600" />
              Share
            </button>

            <div className={`my-1 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`} />

            <button
              onClick={() => {
                onExportMD(chat);
                onToggleMenu(chat.id);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 lg:gap-2 lg:px-2.5 lg:py-1.5 transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900' : 'hover:bg-white/10 hover:text-purple-300'}`}
            >
              <FileCode className="h-3.5 w-3.5 text-purple-600" />
              Export Markdown
            </button>

            <button
              onClick={() => {
                onExportTXT(chat);
                onToggleMenu(chat.id);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 lg:gap-2 lg:px-2.5 lg:py-1.5 transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900' : 'hover:bg-white/10 hover:text-emerald-300'}`}
            >
              <FileText className="h-3.5 w-3.5 text-emerald-600" />
              Export Text
            </button>

            <button
              onClick={() => {
                onExportPDF(chat);
                onToggleMenu(chat.id);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 lg:gap-2 lg:px-2.5 lg:py-1.5 transition-colors ${isLight ? 'hover:bg-slate-100 text-slate-700 hover:text-slate-900' : 'hover:bg-white/10 hover:text-amber-300'}`}
            >
              <Printer className="h-3.5 w-3.5 text-amber-600" />
              Print / Export PDF
            </button>

            <div className={`my-1 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`} />

            <button
              onClick={() => onDelete(chat.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 lg:gap-2 lg:px-2.5 lg:py-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Chat
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
