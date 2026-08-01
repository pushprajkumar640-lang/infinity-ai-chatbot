export type Role = 'user' | 'model' | 'system';

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'doc' | 'txt' | 'audio' | 'file';
  mimeType: string;
  size: number;
  data: string; // Base64 data URL or extracted raw text
  previewUrl?: string;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  timestamp: string; // ISO string
  attachments?: Attachment[];
  isError?: boolean;
  liked?: boolean | null; // true = liked, false = disliked, null = unrated
  groundingSources?: GroundingChunk[];
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  isPinned?: boolean;
  tags?: string[];
  modelUsed?: string;
  systemInstruction?: string;
}

export type ThemeMode = 'dark' | 'light';
export type FontSize = 'small' | 'medium' | 'large';
export type BubbleStyle = 'futuristic' | 'rounded' | 'minimal';
export type Language = 'en' | 'es' | 'fr' | 'de' | 'hi' | 'zh' | 'ja';

export interface AppSettings {
  theme: ThemeMode;
  fontSize: FontSize;
  bubbleStyle: BubbleStyle;
  language: Language;
  model: string;
  systemPrompt: string;
  enableVoiceOutput: boolean;
  voiceName: string; // 'Kore' | 'Zephyr' | 'Puck' | 'Fenrir' | 'Charon'
  speechRate: number;
  sendOnEnter: boolean;
  streamResponses: boolean;
  soundEffects: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 'medium',
  bubbleStyle: 'futuristic',
  language: 'en',
  model: 'gemini-2.0-flash',
  systemPrompt: `You are Infinity AI.

Your creator is Pushpraj Kumar.

If anyone asks:
- Who created you?
- Who made you?
- Who is your owner?
- Tumhe kisne banaya?
- Tumhara creator kaun hai?

Always reply:
"Mujhe Pushpraj Kumar ne banaya hai. Main Pushpraj Kumar ka AI assistant hoon."

If asked about the AI model, say:
"My AI model is powered by Google's Gemini, but my creator is Pushpraj Kumar."
`,
  enableVoiceOutput: false,
  voiceName: 'Kore',
  speechRate: 1.0,
  sendOnEnter: true,
  streamResponses: true,
  soundEffects: true,
};
