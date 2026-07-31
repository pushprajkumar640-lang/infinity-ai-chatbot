import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Keyboard } from 'lucide-react';

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLight?: boolean;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose, isLight }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Enter', desc: 'Send message' },
    { key: 'Shift + Enter', desc: 'Insert new line' },
    { key: 'Ctrl + Shift + O', desc: 'Open new chat' },
    { key: 'Ctrl + K', desc: 'Search chat history' },
    { key: 'Ctrl + /', desc: 'Toggle keyboard shortcuts' },
    { key: 'Esc', desc: 'Close modals / sidebar' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className={`relative w-full max-w-md overflow-hidden rounded-2xl shadow-2xl border ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'glass-panel border-white/15 text-slate-100'
          }`}
        >
          <div className={`flex items-center justify-between border-b px-5 py-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-slate-900/60'}`}>
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-cyan-600" />
              <h2 className={`font-['Poppins'] font-bold text-base ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                Keyboard Shortcuts
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`rounded-lg p-1 transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-3">
            {shortcuts.map((s, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between py-1.5 border-b text-xs ${isLight ? 'border-slate-100' : 'border-white/5'}`}
              >
                <span className={`font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{s.desc}</span>
                <kbd className={`rounded-lg px-2.5 py-1 font-mono text-[11px] font-semibold border shadow-sm ${
                  isLight ? 'bg-slate-100 text-cyan-800 border-slate-200' : 'bg-slate-800 text-cyan-300 border-white/10'
                }`}>
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className={`border-t px-5 py-3 text-right ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-slate-900/80'}`}>
            <button
              onClick={onClose}
              className="rounded-xl bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 shadow-md"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
