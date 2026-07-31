import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sliders,
  Sparkles,
  Database,
  Trash2,
  Globe,
  Type,
  Volume2,
  RotateCcw
} from 'lucide-react';
import { AppSettings, DEFAULT_SETTINGS } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (newSettings: AppSettings) => void;
  onClearAllHistory: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  onClearAllHistory,
}) => {
  if (!isOpen) return null;

  const isLight = settings.theme === 'light';

  const handleChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSaveSettings({ ...settings, [key]: value });
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all settings to default configuration?')) {
      onSaveSettings(DEFAULT_SETTINGS);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className={`relative w-full max-w-2xl overflow-hidden rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'glass-panel border-white/15 text-slate-100'
          }`}
        >
          {/* Header */}
          <div className={`flex items-center justify-between border-b px-6 py-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-slate-900/60'}`}>
            <div className="flex items-center gap-2.5">
              <Sliders className="h-5 w-5 text-cyan-600" />
              <h2 className={`font-['Poppins'] font-bold text-lg ${isLight ? 'text-slate-900' : 'text-slate-100'}`}>
                Infinity AI Settings
              </h2>
            </div>
            <button
              onClick={onClose}
              className={`rounded-lg p-1 transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-200 hover:text-slate-900' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Settings Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* System Persona Prompt */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-cyan-600 uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> System Persona Instruction
              </label>
              <textarea
                value={settings.systemPrompt}
                onChange={(e) => handleChange('systemPrompt', e.target.value)}
                rows={3}
                className={`w-full rounded-xl p-3 text-xs border focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  isLight ? 'bg-slate-50 text-slate-900 border-slate-200' : 'bg-slate-900/80 text-slate-200 border-white/10'
                }`}
                placeholder="Set custom persona or behavior for AI..."
              />
            </div>

            {/* Appearance & Interface */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              {/* Font Size */}
              <div className="space-y-2">
                <label className={`text-xs font-semibold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <Type className="h-4 w-4 text-cyan-600" /> Font Size
                </label>
                <select
                  value={settings.fontSize}
                  onChange={(e) => handleChange('fontSize', e.target.value as any)}
                  className={`w-full rounded-xl p-2.5 text-xs border focus:outline-none ${
                    isLight ? 'bg-slate-50 text-slate-900 border-slate-200' : 'bg-slate-900/80 text-slate-200 border-white/10'
                  }`}
                >
                  <option value="small">Compact (Small)</option>
                  <option value="medium">Standard (Medium)</option>
                  <option value="large">Comfortable (Large)</option>
                </select>
              </div>

              {/* Language */}
              <div className="space-y-2">
                <label className={`text-xs font-semibold flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  <Globe className="h-4 w-4 text-cyan-600" /> Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => handleChange('language', e.target.value as any)}
                  className={`w-full rounded-xl p-2.5 text-xs border focus:outline-none ${
                    isLight ? 'bg-slate-50 text-slate-900 border-slate-200' : 'bg-slate-900/80 text-slate-200 border-white/10'
                  }`}
                >
                  <option value="en">English</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="fr">French (Français)</option>
                  <option value="de">German (Deutsch)</option>
                  <option value="hi">Hindi (हिंदी)</option>
                  <option value="zh">Chinese (中文)</option>
                  <option value="ja">Japanese (日本語)</option>
                </select>
              </div>
            </div>

            {/* Speech & Interaction Toggles */}
            <div className={`space-y-3 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <label className="text-xs font-semibold text-cyan-600 uppercase tracking-wider flex items-center gap-2">
                <Volume2 className="h-4 w-4" /> Speech & Interaction
              </label>

              <div className={`flex items-center justify-between rounded-xl p-3 border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-white/5'}`}>
                <div>
                  <div className={`font-semibold text-xs ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Auto Voice Read Aloud</div>
                  <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Automatically speak AI responses when received</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableVoiceOutput}
                  onChange={(e) => handleChange('enableVoiceOutput', e.target.checked)}
                  className="h-4 w-4 rounded accent-cyan-600 cursor-pointer"
                />
              </div>

              <div className={`flex items-center justify-between rounded-xl p-3 border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-white/5'}`}>
                <div>
                  <div className={`font-semibold text-xs ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>Send on Enter</div>
                  <div className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>Press Enter to send message, Shift+Enter for new line</div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.sendOnEnter}
                  onChange={(e) => handleChange('sendOnEnter', e.target.checked)}
                  className="h-4 w-4 rounded accent-cyan-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Data Management & Clear */}
            <div className={`space-y-3 pt-2 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <label className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-2">
                <Database className="h-4 w-4" /> Data & Reset
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onClearAllHistory}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border transition-colors ${
                    isLight ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                  }`}
                >
                  <Trash2 className="h-4 w-4" /> Clear All Conversation History
                </button>

                <button
                  onClick={handleResetDefaults}
                  className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border transition-colors ${
                    isLight ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  <RotateCcw className="h-4 w-4" /> Reset Settings to Default
                </button>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className={`flex items-center justify-between border-t px-6 py-4 ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-slate-900/80'}`}>
            <span className={`text-[11px] font-mono ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>Infinity AI</span>
            <button
              onClick={onClose}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
