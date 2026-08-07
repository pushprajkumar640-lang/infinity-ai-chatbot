import React, { useState } from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Copy,
  Check,
  Volume2,
  VolumeX,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Pencil,
  Trash2,
  ExternalLink,
  Bot,
  User,
  Sparkles,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { ChatMessage, AppSettings } from '../types';

export function cleanMessageText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\*?\s*\(Automatically switched to OpenRouter backup provider\)\s*\*?\n*/gi, '')
    .replace(/\*?\s*\(Switched to OpenRouter backup provider\)\s*\*?\n*/gi, '')
    .replace(/\*?\s*\(Using OpenRouter backup provider\)\s*\*?\n*/gi, '')
    .replace(/\*?\s*\(Fallback provider\)\s*\*?\n*/gi, '')
    .trim();
}

export function preprocessLaTeX(content: string): string {
  if (!content) return '';

  let text = cleanMessageText(content);

  // 1. Replace block math delimiters \[ ... \] with $$ ... $$
  text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => `\n$$\n${math.trim()}\n$$\n`);

  // 2. Replace inline math delimiters \( ... \) with $ ... $
  text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => `$${math.trim()}$`);

  // 3. Wrap bare LaTeX environment blocks if not already enclosed in $$
  text = text.replace(
    /(?<!\$\$)\s*\\begin\{(equation|align|matrix|bmatrix|pmatrix|cases|gather|alignat)\}([\s\S]*?)\\end\{\1\}\s*(?!\$\$)/g,
    (_, env, body) => `\n$$\n\\begin{${env}}${body}\\end{${env}}\n$$\n`
  );

  return text;
}

interface MessageBubbleProps {
  message: ChatMessage;
  settings: AppSettings;
  isStreaming?: boolean;
  onRegenerate?: () => void;
  onEdit?: (newText: string) => void;
  onDelete?: () => void;
  onToggleLike?: (liked: boolean) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  settings,
  isStreaming,
  onRegenerate,
  onEdit,
  onDelete,
  onToggleLike,
}) => {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const isUser = message.role === 'user';
  const isLight = settings.theme === 'light';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeech = async () => {
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    try {
      setIsPlayingAudio(true);

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
       const cleanText = message.text
  .replace(/```[\s\S]*?```/g, "")
  .replace(/`/g, "")
  .replace(/[#>*_\-]/g, "")
  .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
  .replace(/https?:\/\/\S+/g, "")
  .replace(/\\/g, "")
  .replace(/\bback ?space\b/gi, "")
  .replace(/\bback ?slash\b/gi, "")
  .replace(/\n+/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const utterance = new SpeechSynthesisUtterance(cleanText);

utterance.lang = "en-US";
utterance.rate = 1;
utterance.pitch = 1;
utterance.volume = 1;
        utterance.rate = settings.speechRate || 1.0;
        
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPlayingAudio(false);
      }
    } catch (err) {
      console.error('Speech error:', err);
      setIsPlayingAudio(false);
    }
  };

  const handleSaveEdit = () => {
    if (editText.trim() && onEdit) {
      onEdit(editText.trim());
      setIsEditing(false);
    }
  };

  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`group relative flex w-full gap-2 sm:gap-3 md:gap-4 py-3 text-sm sm:text-base ${
        isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 select-none items-center justify-center rounded-xl font-medium shadow-md transition-transform ${
          isUser
            ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-cyan-500/20'
            : 'bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-500 text-white shadow-indigo-500/20 ring-1 ring-white/10'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 sm:h-5 sm:w-5" />
        ) : (
          <Bot className="h-4 w-4 sm:h-5 sm:w-5" />
        )}
      </div>

      {/* Message Content & Metadata */}
      <div className={`flex w-full max-w-full sm:max-w-[90%] md:max-w-[80%] flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Author & Timestamp */}
        <div className={`flex items-center gap-2 text-xs font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          <span>{isUser ? 'You' : 'Infinity AI'}</span>
          <span>•</span>
          <span className={isLight ? 'text-slate-500' : 'text-slate-500'}>{formattedTime}</span>
          {!isUser && isStreaming && (
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${isLight ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' : 'bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/20'}`}>
              <Sparkles className="h-2.5 w-2.5 animate-spin" />
              Generating...
            </span>
          )}
        </div>

        {/* File Attachments Preview */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-1">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium ${isLight ? 'bg-slate-100 text-slate-800 border border-slate-200' : 'bg-slate-800/80 text-slate-200 ring-1 ring-white/10'}`}
              >
                {att.mimeType.startsWith('image/') ? (
                  <ImageIcon className="h-4 w-4 text-cyan-500" />
                ) : (
                  <FileText className="h-4 w-4 text-purple-500" />
                )}
                <span className="max-w-[140px] truncate">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Message Bubble Box */}
       <div
  className={`relative w-full max-w-full overflow-x-auto rounded-2xl px-3 sm:px-4 py-3 break-words transition-all ${
            isUser
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md rounded-tr-none'
              : isLight
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/90 rounded-tl-none'
              : 'bg-slate-900/80 text-slate-100 shadow-md border border-white/10 rounded-tl-none'
          }`}
        >
          {isEditing ? (
            <div className="flex flex-col gap-2 min-w-[280px]">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className={`w-full rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isLight ? 'bg-slate-50 text-slate-900 border border-slate-300' : 'bg-slate-950 text-slate-100 border border-white/10'}`}
                rows={3}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="rounded-md bg-cyan-600 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-500"
                >
                  Save & Resend
                </button>
              </div>
            </div>
          ) : (
            <div className="markdown-content w-full max-w-full overflow-x-auto overflow-y-hidden px-3 py-3">
              {message.isError ? (
                <div className="text-red-500 font-medium flex items-center gap-2">
                  <span>⚠️ {message.text}</span>
                </div>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeString = String(children).replace(/\n$/, '');

                      if (match) {
                        return (
                          <CodeBlock language={match[1]} code={codeString} isLight={isLight} />
                        );
                      }

                      return (
                        <code className={`rounded px-1.5 py-0.5 font-mono text-xs ${isLight ? 'bg-cyan-50 text-cyan-800 border border-cyan-200/60' : 'bg-slate-800 text-cyan-300'}`} {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {preprocessLaTeX(message.text)}
                </ReactMarkdown>
              )}
            </div>
          )}

          {/* Web Search Grounding Citations */}
          {message.groundingSources && message.groundingSources.length > 0 && (
            <div className={`mt-3 border-t pt-2 text-xs ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <div className="font-semibold text-cyan-500 flex items-center gap-1 mb-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Sources
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.groundingSources.map((source, idx) => (
                  source.web?.uri ? (
                    <a
                      key={idx}
                      href={source.web.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors border ${isLight ? 'bg-slate-100 text-slate-700 hover:text-cyan-600 hover:bg-slate-200 border-slate-200' : 'bg-slate-800/80 text-slate-300 hover:text-cyan-300 hover:bg-slate-700/80 border-white/5'}`}
                    >
                      <span className="truncate max-w-[120px] sm:max-w-[150px]">{source.web.title || source.web.uri}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : null
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        {!isEditing && (
          <div className={`flex flex-wrap items-center gap-2 transition-opacity ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            <button
              onClick={handleCopy}
              title="Copy Message"
              className={`rounded-md p-1.5 transition-colors ${isLight ? 'hover:bg-slate-200/80 hover:text-slate-900' : 'hover:bg-slate-800/60 hover:text-slate-200'}`}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={handleSpeech}
              title={isPlayingAudio ? 'Stop Speech' : 'Read Aloud'}
              className={`rounded-md p-1.5 transition-colors ${isLight ? 'hover:bg-slate-200/80 hover:text-slate-900' : 'hover:bg-slate-800/60 hover:text-slate-200'}`}
            >
              {isPlayingAudio ? (
                <VolumeX className="h-3.5 w-3.5 text-cyan-500 animate-pulse" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>

            {isUser && onEdit && (
              <button
                onClick={() => setIsEditing(true)}
                title="Edit Message"
                className={`rounded-md p-1.5 transition-colors ${isLight ? 'hover:bg-slate-200/80 hover:text-slate-900' : 'hover:bg-slate-800/60 hover:text-slate-200'}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}

            {!isUser && onRegenerate && (
              <button
                onClick={onRegenerate}
                title="Regenerate Response"
                className={`rounded-md p-1.5 transition-colors ${isLight ? 'hover:bg-slate-200/80 hover:text-slate-900' : 'hover:bg-slate-800/60 hover:text-slate-200'}`}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}

            {!isUser && onToggleLike && (
              <>
                <button
                  onClick={() => onToggleLike(true)}
                  title="Good Response"
                  className={`rounded-md p-1.5 transition-colors ${
                    message.liked === true ? 'text-emerald-500 font-bold' : isLight ? 'hover:bg-slate-200/80 hover:text-slate-900' : 'hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onToggleLike(false)}
                  title="Bad Response"
                  className={`rounded-md p-1.5 transition-colors ${
                    message.liked === false ? 'text-red-500 font-bold' : isLight ? 'hover:bg-slate-200/80 hover:text-slate-900' : 'hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {onDelete && (
              <button
                onClick={onDelete}
                title="Delete Message"
                className={`rounded-md p-1.5 transition-colors hover:text-red-500 ${isLight ? 'hover:bg-slate-200/80' : 'hover:bg-slate-800/60'}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Subcomponent for Code Block with header & copy button
const CodeBlock: React.FC<{ language: string; code: string; isLight?: boolean }> = ({ language, code, isLight }) => {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`group relative my-3 overflow-hidden rounded-xl border text-slate-200 shadow-lg ${isLight ? 'border-slate-200 bg-[#1e293b]' : 'border-white/10 bg-[#0d1117]'}`}>
      {/* Code Header Bar */}
      <div className={`flex items-center justify-between px-4 py-2 text-xs font-medium select-none ${isLight ? 'bg-slate-800 border-b border-slate-700 text-slate-300' : 'bg-slate-900/90 border-b border-white/10 text-slate-400'}`}>
        <span className="font-mono text-cyan-400 uppercase tracking-wider">{language || 'code'}</span>
        <button
          onClick={copyCode}
          className="flex items-center gap-1 rounded-md bg-white/10 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/20 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="overflow-x-auto p-3 sm:p-4 font-mono text-xs md:text-sm leading-relaxed text-slate-100">
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
