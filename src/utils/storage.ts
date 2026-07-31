import { ChatConversation, AppSettings, DEFAULT_SETTINGS, ChatMessage } from '../types';

const STORAGE_KEYS = {
  CONVERSATIONS: 'infinite_ai_conversations_v1',
  ACTIVE_CHAT_ID: 'infinite_ai_active_chat_id_v1',
  SETTINGS: 'infinite_ai_settings_v1',
};

// Default empty new conversation
export const createInitialConversation = (): ChatConversation => {
  const now = new Date().toISOString();
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: 'New Chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};

export const loadConversations = (): ChatConversation[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONVERSATIONS);
    if (!raw) {
      const initial = [createInitialConversation()];
      saveConversations(initial);
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = [createInitialConversation()];
      saveConversations(initial);
      return initial;
    }

    // Filter out any previously saved default welcome messages
    const cleaned = parsed.map((conv: ChatConversation) => {
      const filteredMessages = (conv.messages || []).filter(
        (msg) => !msg.text.includes('Welcome to Infinity AI') && !msg.text.includes('Welcome to Infinite AI Chatbot')
      );
      return {
        ...conv,
        messages: filteredMessages,
      };
    });

    return cleaned;
  } catch (err) {
    console.error('Error loading conversations from localStorage:', err);
    return [createInitialConversation()];
  }
};

export const saveConversations = (conversations: ChatConversation[]): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.CONVERSATIONS, JSON.stringify(conversations));
  } catch (err) {
    console.error('Error saving conversations to localStorage:', err);
  }
};

export const loadActiveChatId = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_CHAT_ID);
  } catch (err) {
    return null;
  }
};

export const saveActiveChatId = (id: string): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_CHAT_ID, id);
  } catch (err) {
    console.error('Error saving active chat id:', err);
  }
};

export const loadSettings = (): AppSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (err) {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = (settings: AppSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Error saving settings:', err);
  }
};

// Export Helpers
export const exportChatAsTXT = (conversation: ChatConversation): void => {
  let content = `=== ${conversation.title} ===\n`;
  content += `Created: ${new Date(conversation.createdAt).toLocaleString()}\n`;
  content += `Model: ${conversation.modelUsed || 'Infinity AI'}\n\n`;

  conversation.messages.forEach((msg) => {
    const sender = msg.role === 'user' ? 'USER' : 'INFINITY AI';
    const time = new Date(msg.timestamp).toLocaleTimeString();
    content += `[${time}] ${sender}:\n${msg.text}\n\n`;
    if (msg.attachments && msg.attachments.length > 0) {
      content += `Attachments: ${msg.attachments.map(a => a.name).join(', ')}\n\n`;
    }
  });

  downloadFile(`${conversation.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`, content, 'text/plain');
};

export const exportChatAsMarkdown = (conversation: ChatConversation): void => {
  let content = `# ${conversation.title}\n\n`;
  content += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

  conversation.messages.forEach((msg) => {
    const sender = msg.role === 'user' ? '👤 **User**' : '🤖 **Infinity AI**';
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    content += `### ${sender} _(${time})_\n\n${msg.text}\n\n`;
    if (msg.attachments && msg.attachments.length > 0) {
      content += `*Attached Files:* ${msg.attachments.map(a => `\`${a.name}\``).join(', ')}\n\n`;
    }
    content += `---\n\n`;
  });

  downloadFile(`${conversation.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`, content, 'text/markdown');
};

export const exportChatAsPDFPrint = (conversation: ChatConversation): void => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${conversation.title}</title>
        <style>
          body { font-family: sans-serif; padding: 40px; color: #1e293b; max-width: 800px; margin: 0 auto; }
          h1 { color: #0284c7; font-size: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
          .meta { color: #64748b; font-size: 14px; margin-bottom: 30px; }
          .message { margin-bottom: 24px; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
          .user { background-color: #f8fafc; border-left: 4px solid #0284c7; }
          .model { background-color: #f0f9ff; border-left: 4px solid #8b5cf6; }
          .author { font-weight: bold; font-size: 14px; margin-bottom: 8px; display: flex; justify-content: space-between; }
          .time { font-weight: normal; color: #94a3b8; font-size: 12px; }
          .content { font-size: 15px; line-height: 1.6; whitespace: pre-wrap; }
          pre { background: #1e293b; color: #f8fafc; padding: 12px; border-radius: 8px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>${conversation.title}</h1>
        <div class="meta">Exported from Infinity AI on ${new Date().toLocaleString()}</div>
        ${conversation.messages.map(m => `
          <div class="message ${m.role}">
            <div class="author">
              <span>${m.role === 'user' ? 'User' : 'Infinity AI'}</span>
              <span class="time">${new Date(m.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="content">${escapeHtml(m.text)}</div>
          </div>
        `).join('')}
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 250);
};

export const exportAllDataBackup = (conversations: ChatConversation[], settings: AppSettings): void => {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    conversations,
    settings,
  };
  downloadFile(`infinity_ai_backup_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2), 'application/json');
};

const escapeHtml = (unsafe: string): string => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

const downloadFile = (filename: string, content: string, contentType: string): void => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
