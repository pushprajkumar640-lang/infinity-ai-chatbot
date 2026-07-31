import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";

// Load .env environment variables
dotenv.config();

// Load .env.example for fallback environment variables (e.g., OPENROUTER_API_KEY) if not already set
dotenv.config({ path: path.join(process.cwd(), ".env.example") });

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Enable CORS for incoming requests
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Body parser limits
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Helper to sanitize and trim API keys
function sanitizeKey(key?: string): string {
  if (!key) return "";
  let k = key.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.substring(1, k.length - 1).trim();
  }
  return k;
}

// Active requests tracker to prevent duplicate concurrent submissions
const activeRequests = new Set<string>();

function getRequestSignature(req: express.Request): string {
  const messages = req.body?.messages;
  if (!messages || !Array.isArray(messages) || messages.length === 0) return "";
  const lastMsg = messages[messages.length - 1];
  const lastText = typeof lastMsg?.text === "string" ? lastMsg.text : "";
  return `${messages.length}:${lastText.slice(0, 120)}`;
}

// --------------------------------------------------
// IN-MEMORY RESPONSE CACHE FOR MAXIMUM SPEED
// --------------------------------------------------
interface CacheEntry {
  text: string;
  groundingSources?: any[];
  provider: string;
  timestamp: number;
}

const responseCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
const MAX_CACHE_SIZE = 250;

function getCacheKey(messages: any[], systemPrompt?: string): string {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  const lastMsg = messages[messages.length - 1];
  const lastText = typeof lastMsg?.text === "string" ? lastMsg.text.trim() : "";
  if (!lastText) return "";
  const attCount = Array.isArray(lastMsg?.attachments) ? lastMsg.attachments.length : 0;
  if (attCount > 0) return ""; // Skip caching queries with attachments
  return `${messages.length}:${systemPrompt || ""}:${lastText.toLowerCase()}`;
}

function setCache(key: string, entry: Omit<CacheEntry, "timestamp">) {
  if (!key || !entry.text || entry.text.startsWith("⚠️")) return;
  if (responseCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { ...entry, timestamp: Date.now() });
}

function getCache(key: string): CacheEntry | null {
  if (!key) return null;
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  return cached;
}

// Check for quota, rate limit, or server errors
function isRateLimitOrQuotaError(err: any): boolean {
  if (!err) return false;
  const errStr = typeof err === "string" ? err : `${err.message || ""} ${err.status || ""} ${JSON.stringify(err)}`;
  return (
    errStr.includes("RESOURCE_EXHAUSTED") ||
    errStr.includes("quota") ||
    errStr.includes("Quota exceeded") ||
    errStr.includes("PER_MINUTE") ||
    errStr.includes("PER_DAY") ||
    errStr.includes("429") ||
    errStr.includes("Rate limit") ||
    errStr.includes("Too Many Requests") ||
    errStr.includes("503") ||
    errStr.includes("500") ||
    errStr.includes("Overloaded")
  );
}

// Active OpenRouter free models list (fastest first)
const ACTIVE_OPENROUTER_FREE_MODELS = [
  "openai/gpt-oss-20b:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "inclusionai/ling-3.0-flash:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
  "cohere/north-mini-code:free",
];

const VISION_OPENROUTER_FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
];

function hasImageAttachments(messages: any[]): boolean {
  if (!Array.isArray(messages)) return false;
  return messages.some(
    (m) =>
      Array.isArray(m.attachments) &&
      m.attachments.some((att: any) => att && att.mimeType && typeof att.mimeType === "string" && att.mimeType.startsWith("image/"))
  );
}

// --------------------------------------------------
// DETERMINISTIC MATH SOLVER LOGIC
// --------------------------------------------------
function solveMathExpression(prompt: string): string | null {
  if (!prompt || typeof prompt !== "string") return null;
  const raw = prompt.trim();
  
  // Clean prefix like "what is", "calculate", "evaluate", "compute", "solve"
  let clean = raw.replace(/^(?:what\s+is\s+|calculate\s+|evaluate\s+|compute\s+|solve\s+|pls\s+solve\s+|please\s+solve\s+)/i, "").trim();
  clean = clean.replace(/\?$/, "").trim();

  // Percentage check: e.g. "15% of 250" or "what is 15% of 250"
  const pctMatch = clean.match(/^([\d\.]+)\s*%\s*of\s*([\d\.]+)$/i);
  if (pctMatch) {
    const pct = parseFloat(pctMatch[1]);
    const val = parseFloat(pctMatch[2]);
    if (!isNaN(pct) && !isNaN(val)) {
      const res = (pct / 100) * val;
      const formatted = Number(res.toFixed(10));
      return `${pct}% of ${val} = **${formatted}**`;
    }
  }

  // Symbol replacement: × -> *, ÷ -> /
  clean = clean.replace(/×/g, "*").replace(/÷/g, "/");

  // Allow: digits, whitespace, operators +, -, *, /, %, ^, parentheses, commas, dots, and math functions
  const safeMathPattern = /^[0-9\.\s\+\-\*\/\%\^\(\)\,\ba-z]+$/i;
  if (!safeMathPattern.test(clean)) return null;

  // Must contain at least digits and at least one math operator or math function
  if (!/\d/.test(clean)) return null;
  if (!/[\+\-\*\/\%\^\(\)]|sqrt|abs|sin|cos|tan|log/i.test(clean) && !pctMatch) return null;

  try {
    let jsExpr = clean.replace(/\^/g, "**");
    jsExpr = jsExpr
      .replace(/\bsqrt\(([^)]+)\)/gi, 'Math.sqrt($1)')
      .replace(/\babs\(([^)]+)\)/gi, 'Math.abs($1)')
      .replace(/\bsin\(([^)]+)\)/gi, 'Math.sin($1)')
      .replace(/\bcos\(([^)]+)\)/gi, 'Math.cos($1)')
      .replace(/\btan\(([^)]+)\)/gi, 'Math.tan($1)')
      .replace(/\blog\(([^)]+)\)/gi, 'Math.log10($1)')
      .replace(/\bln\(([^)]+)\)/gi, 'Math.log($1)')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\be\b/gi, 'Math.E');

    // Verify identifiers
    const identifiers = jsExpr.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/g);
    if (identifiers) {
      const allowed = new Set(['Math', 'sqrt', 'abs', 'sin', 'cos', 'tan', 'log', 'log10', 'PI', 'E']);
      for (const id of identifiers) {
        if (!allowed.has(id)) return null;
      }
    }

    const val = Function(`"use strict"; return (${jsExpr});`)();
    if (typeof val === "number" && !isNaN(val) && isFinite(val)) {
      const formattedVal = Number(Number(val.toFixed(10)).toString());
      return `${clean} = **${formattedVal}**`;
    }
  } catch {
    return null;
  }
  return null;
}

// Message formatters
function formatMessagesForGemini(messages: any[]) {
  if (!Array.isArray(messages)) return [];

  return messages.map((msg: any) => {
    const parts: any[] = [];

    if (msg.attachments && Array.isArray(msg.attachments)) {
      msg.attachments.forEach((att: any) => {
        if (att.data && att.mimeType) {
          if (att.mimeType.startsWith("image/") || att.mimeType === "application/pdf") {
            const base64Data = att.data.includes(",")
              ? att.data.split(",")[1]
              : att.data;
            parts.push({
              inlineData: {
                mimeType: att.mimeType,
                data: base64Data,
              },
            });
          } else {
            parts.push({
              text: `[Attached File: ${att.name}]\n${att.data}`,
            });
          }
        }
      });
    }

    if (msg.text && typeof msg.text === "string" && msg.text.trim().length > 0) {
      parts.push({ text: msg.text.trim() });
    } else if (parts.length === 0) {
      parts.push({ text: " " });
    }

    return {
      role: msg.role === "user" ? "user" : "model",
      parts,
    };
  });
}

function formatMessagesForOpenRouter(messages: any[], systemPrompt?: string) {
  const result: any[] = [];
  if (systemPrompt && systemPrompt.trim()) {
    result.push({ role: "system", content: systemPrompt.trim() });
  }

  for (const msg of messages) {
    const role = msg.role === "user" ? "user" : "assistant";
    let textContent = msg.text || "";

    const imageParts: any[] = [];
    if (msg.attachments && Array.isArray(msg.attachments)) {
      msg.attachments.forEach((att: any) => {
        if (att.data && att.mimeType) {
          if (att.mimeType.startsWith("image/")) {
            const dataUrl = att.data.startsWith("data:")
              ? att.data
              : `data:${att.mimeType};base64,${att.data}`;
            imageParts.push({
              type: "image_url",
              image_url: { url: dataUrl },
            });
          } else {
            textContent += `\n[Attached File: ${att.name}]\n${att.data}`;
          }
        }
      });
    }

    if (imageParts.length > 0) {
      const contentParts: any[] = [];
      if (textContent.trim()) {
        contentParts.push({ type: "text", text: textContent.trim() });
      }
      contentParts.push(...imageParts);
      result.push({ role, content: contentParts });
    } else {
      result.push({ role, content: textContent.trim() || " " });
    }
  }

  return result;
}

// OpenRouter Non-Streaming Helper
async function callOpenRouterApi({
  apiKey,
  model,
  messages,
}: {
  apiKey: string;
  model: string;
  messages: any[];
}): Promise<{ text: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
    "X-Title": "Infinity AI",
  };

  if (apiKey && apiKey.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: false,
    }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    let detailMessage = rawText;
    try {
      const errJson = JSON.parse(rawText);
      detailMessage = errJson.error?.message || errJson.message || rawText;
    } catch {
      // Keep raw
    }
    const fullError = `OpenRouter HTTP ${response.status} (${response.statusText}): ${detailMessage}`;
    console.warn(`[OpenRouter API Model Try] Model: ${model} | ${fullError}`);
    throw new Error(fullError);
  }

  try {
    const data = JSON.parse(rawText);
    const text = data.choices?.[0]?.message?.content || "";
    return { text };
  } catch (parseErr: any) {
    const parseErrorMsg = `OpenRouter invalid JSON response: ${parseErr.message}`;
    console.error(`[OpenRouter API Error] Model: ${model} | ${parseErrorMsg}`);
    throw new Error(parseErrorMsg);
  }
}

// OpenRouter Streaming Helper
async function* streamOpenRouterApi({
  apiKey,
  model,
  messages,
}: {
  apiKey: string;
  model: string;
  messages: any[];
}): AsyncGenerator<string, void, unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
    "X-Title": "Infinity AI",
  };

  if (apiKey && apiKey.trim()) {
    headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const rawText = await response.text();
    let detailMessage = rawText;
    try {
      const errJson = JSON.parse(rawText);
      detailMessage = errJson.error?.message || errJson.message || rawText;
    } catch {
      // Keep raw
    }
    const fullError = `OpenRouter Stream HTTP ${response.status} (${response.statusText}): ${detailMessage}`;
    console.warn(`[OpenRouter Stream Model Try] Model: ${model} | ${fullError}`);
    throw new Error(fullError);
  }

  if (!response.body) {
    const noBodyErr = "OpenRouter Stream error: Response body is missing";
    console.error(`[OpenRouter Stream Error] ${noBodyErr}`);
    throw new Error(noBodyErr);
  }

  const reader = (response.body as any).getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":")) continue;
      if (trimmed === "data: [DONE]") return;

      if (trimmed.startsWith("data: ")) {
        const jsonStr = trimmed.slice(6).trim();
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            yield delta;
          }
        } catch {
          // Ignore partial chunk
        }
      }
    }
  }

  if (buffer.trim().startsWith("data: ")) {
    const jsonStr = buffer.trim().slice(6).trim();
    if (jsonStr !== "[DONE]") {
      try {
        const parsed = JSON.parse(jsonStr);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      } catch {
        // Ignore
      }
    }
  }
}

// --------------------------------------------------
// TWO-PROVIDER CHAT EXECUTION LOGIC (Non-Streaming)
// 1. Gemini API (Primary)
// 2. OpenRouter API (Fallback)
// --------------------------------------------------

async function executeChat({
  messages,
  systemPrompt,
  enableGrounding,
}: {
  messages: any[];
  systemPrompt?: string;
  enableGrounding?: boolean;
}): Promise<{ text: string; groundingSources?: any[]; provider: string; switchedProvider: boolean }> {
  // Check for deterministic math calculation first
  const lastMsg = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null;
  const lastText = typeof lastMsg?.text === "string" ? lastMsg.text.trim() : "";
  const attCount = Array.isArray(lastMsg?.attachments) ? lastMsg.attachments.length : 0;
  if (lastText && attCount === 0) {
    const mathResult = solveMathExpression(lastText);
    if (mathResult) {
      const cacheKey = getCacheKey(messages, systemPrompt);
      if (cacheKey) setCache(cacheKey, { text: mathResult, provider: "Deterministic Math" });
      return { text: mathResult, provider: "Deterministic Math", switchedProvider: false };
    }
  }

  // Check cache first for immediate response
  const cacheKey = getCacheKey(messages, systemPrompt);
  const cached = getCache(cacheKey);
  if (cached) {
    return {
      text: cached.text,
      groundingSources: cached.groundingSources,
      provider: cached.provider,
      switchedProvider: false,
    };
  }

  let geminiLastError = "";
  let openRouterLastError = "";

  // 1. PRIMARY PROVIDER: GEMINI
  const geminiKey = sanitizeKey(process.env.GEMINI_API_KEY);
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      const candidateModels = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
      const formattedContents = formatMessagesForGemini(messages);

      for (const candidateModel of candidateModels) {
        const groundingOptions = enableGrounding ? [true, false] : [false];

        for (const useGrounding of groundingOptions) {
          try {
            const res = await ai.models.generateContent({
              model: candidateModel,
              contents: formattedContents,
              config: {
                systemInstruction: systemPrompt || "You are Infinity AI, a helpful, precise, and intelligent AI assistant. Provide answers in a clean, clear format using Markdown, headings, lists, tables, and formatted code blocks where applicable. For math questions, state the final answer clearly first, followed by a step-by-step explanation if helpful.",
                ...(useGrounding ? { tools: [{ googleSearch: {} }] } : {}),
              },
            });

            const text = res.text || "";
            const groundingSources = res.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
            
            if (cacheKey && text) {
              setCache(cacheKey, { text, groundingSources, provider: "Gemini" });
            }

            return { text, groundingSources, provider: "Gemini", switchedProvider: false };
          } catch (err: any) {
            geminiLastError = err?.message || String(err);
            if (isRateLimitOrQuotaError(err)) {
              console.warn(`[Gemini Primary Rate Limit] Model ${candidateModel} (grounding: ${useGrounding}): switching to OpenRouter.`);
              break;
            } else {
              console.warn(`[Gemini Primary Attempt] Model ${candidateModel} (grounding: ${useGrounding}):`, geminiLastError);
            }
          }
        }
        if (isRateLimitOrQuotaError(geminiLastError)) {
          break;
        }
      }
    } catch (err: any) {
      geminiLastError = err?.message || String(err);
      console.error("[Gemini Primary Setup Error]:", geminiLastError);
    }
  } else {
    geminiLastError = "GEMINI_API_KEY is missing or empty in environment.";
  }

  // 2. FALLBACK PROVIDER: OPENROUTER
  const openRouterKey = sanitizeKey(process.env.OPENROUTER_API_KEY);
  if (!openRouterKey) {
    openRouterLastError = "OPENROUTER_API_KEY is missing or empty in your .env configuration.";
    console.error("[OpenRouter Fallback Error]", openRouterLastError);
  } else {
    const openRouterMessages = formatMessagesForOpenRouter(messages, systemPrompt);
    const containsImages = hasImageAttachments(messages);
    const openRouterModelsToTry = containsImages
      ? [...VISION_OPENROUTER_FREE_MODELS, ...ACTIVE_OPENROUTER_FREE_MODELS.filter(m => !VISION_OPENROUTER_FREE_MODELS.includes(m))]
      : ACTIVE_OPENROUTER_FREE_MODELS;

    for (const orModel of openRouterModelsToTry) {
      try {
        const res = await callOpenRouterApi({
          apiKey: openRouterKey,
          model: orModel,
          messages: openRouterMessages,
        });

        if (res.text) {
          if (cacheKey) {
            setCache(cacheKey, { text: res.text, provider: "OpenRouter" });
          }
          return { text: res.text, provider: "OpenRouter", switchedProvider: true };
        }
      } catch (err: any) {
        openRouterLastError = err?.message || String(err);
        console.error(`[OpenRouter Fallback Model Error] ${orModel}:`, openRouterLastError);
      }
    }
  }

  // 3. BOTH PROVIDERS UNAVAILABLE OR FAILED
  console.error("[Backend Error Summary] Primary provider error:", geminiLastError, "| Fallback provider error:", openRouterLastError);
  const userErrorMsg = "⚠️ The service is currently experiencing high demand. Please try again in a few moments.";
  return { text: userErrorMsg, provider: "None", switchedProvider: false };
}

// --------------------------------------------------
// API ENDPOINTS
// --------------------------------------------------

// Health Check Endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "Infinity AI Backend",
    timestamp: new Date().toISOString(),
    providersConfigured: {
      gemini: !!sanitizeKey(process.env.GEMINI_API_KEY),
      openRouter: !!sanitizeKey(process.env.OPENROUTER_API_KEY),
    },
  });
});

app.get("/api/chat", (_req, res) => {
  res.json({ status: "active", endpoint: "/api/chat", method: "POST" });
});

app.get("/api/chat/stream", (_req, res) => {
  res.json({ status: "active", endpoint: "/api/chat/stream", method: "POST (SSE)" });
});

// Non-streaming Chat Endpoint
app.post("/api/chat", async (req, res) => {
  const reqSig = getRequestSignature(req);
  if (reqSig && activeRequests.has(reqSig)) {
    res.status(429).json({ error: "A request is already in progress. Please wait for it to complete." });
    return;
  }

  if (reqSig) activeRequests.add(reqSig);

  try {
    const { messages, systemPrompt, enableGrounding = true } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Messages array is required." });
      return;
    }

    const result = await executeChat({
      messages,
      systemPrompt,
      enableGrounding,
    });

    res.json({
      text: result.text,
      groundingSources: result.groundingSources,
      provider: result.provider,
    });
  } catch (error: any) {
    const errorDetail = error?.message || String(error);
    console.error("[POST /api/chat Unexpected Error]:", errorDetail);
    res.json({
      text: `⚠️ An unexpected error occurred: ${errorDetail}`,
    });
  } finally {
    if (reqSig) activeRequests.delete(reqSig);
  }
});

// Streaming Chat Endpoint (POST /api/chat/stream)
app.post("/api/chat/stream", async (req, res) => {
  const reqSig = getRequestSignature(req);
  if (reqSig && activeRequests.has(reqSig)) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.write(`data: ${JSON.stringify({ text: "⚠️ A request is already processing. Please wait..." })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  if (reqSig) activeRequests.add(reqSig);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  try {
    const { messages, systemPrompt, enableGrounding = true } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.write(`data: ${JSON.stringify({ text: "⚠️ Messages array is required." })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    // Check for deterministic math calculation first
    const lastMsg = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null;
    const lastText = typeof lastMsg?.text === "string" ? lastMsg.text.trim() : "";
    const attCount = Array.isArray(lastMsg?.attachments) ? lastMsg.attachments.length : 0;
    if (lastText && attCount === 0) {
      const mathResult = solveMathExpression(lastText);
      if (mathResult) {
        const cacheKey = getCacheKey(messages, systemPrompt);
        if (cacheKey) setCache(cacheKey, { text: mathResult, provider: "Deterministic Math" });
        res.write(`data: ${JSON.stringify({ text: mathResult })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }
    }

    // Check Cache for Instant Stream Response
    const cacheKey = getCacheKey(messages, systemPrompt);
    const cached = getCache(cacheKey);
    if (cached && cached.text) {
      // Rapid token streaming from cache for instant response feel
      const tokens = cached.text.match(/\S+|\s+/g) || [cached.text];
      for (const token of tokens) {
        res.write(
          `data: ${JSON.stringify({
            text: token,
            groundingSources: cached.groundingSources,
          })}\n\n`
        );
      }
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    let streamSuccess = false;
    let geminiLastError = "";
    let openRouterLastError = "";
    let accumulatedText = "";
    let accumulatedGrounding: any[] = [];

    // 1. PRIMARY: GEMINI STREAMING
    const geminiKey = sanitizeKey(process.env.GEMINI_API_KEY);
    if (geminiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey: geminiKey,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } },
        });
        const candidateModels = ["gemini-2.0-flash", "gemini-2.0-flash-lite"];
        const formattedContents = formatMessagesForGemini(messages);

        for (const candidateModel of candidateModels) {
          const groundingOptions = enableGrounding ? [true, false] : [false];

          for (const useGrounding of groundingOptions) {
            try {
              const responseStream = await ai.models.generateContentStream({
                model: candidateModel,
                contents: formattedContents,
                config: {
                  systemInstruction: systemPrompt || "You are Infinity AI, a helpful, precise, and intelligent AI assistant. Provide answers in a clean, clear format using Markdown, headings, lists, tables, and formatted code blocks where applicable. For math questions, state the final answer clearly first, followed by a step-by-step explanation if helpful.",
                  ...(useGrounding ? { tools: [{ googleSearch: {} }] } : {}),
                },
              });

              for await (const chunk of responseStream) {
                const textChunk = chunk.text || "";
                const chunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (chunks && Array.isArray(chunks)) {
                  accumulatedGrounding = chunks;
                }

                if (textChunk) {
                  accumulatedText += textChunk;
                }

                if (textChunk || accumulatedGrounding.length > 0) {
                  res.write(
                    `data: ${JSON.stringify({
                      text: textChunk,
                      groundingSources: accumulatedGrounding.length > 0 ? accumulatedGrounding : undefined,
                    })}\n\n`
                  );
                }
              }

              streamSuccess = true;
              if (cacheKey && accumulatedText) {
                setCache(cacheKey, { text: accumulatedText, groundingSources: accumulatedGrounding, provider: "Gemini" });
              }
              break;
            } catch (err: any) {
              geminiLastError = err?.message || String(err);
              if (isRateLimitOrQuotaError(err)) {
                console.warn(`[Gemini Stream Primary Rate Limit] Model ${candidateModel} (grounding: ${useGrounding}): switching to OpenRouter.`);
                break;
              } else {
                console.warn(`[Gemini Stream Primary Attempt] Model ${candidateModel} (grounding: ${useGrounding}):`, geminiLastError);
              }
            }
          }
          if (streamSuccess || isRateLimitOrQuotaError(geminiLastError)) {
            break;
          }
        }
      } catch (err: any) {
        geminiLastError = err?.message || String(err);
        console.error("[Gemini Stream Setup Error]:", geminiLastError);
      }
    } else {
      geminiLastError = "GEMINI_API_KEY is missing or empty in environment.";
    }

    // 2. FALLBACK: OPENROUTER STREAMING
    if (!streamSuccess) {
      const openRouterKey = sanitizeKey(process.env.OPENROUTER_API_KEY);

      if (!openRouterKey) {
        openRouterLastError = "OPENROUTER_API_KEY is missing or empty in your .env configuration.";
        console.error("[OpenRouter Stream Fallback Error]:", openRouterLastError);
      } else {
        const openRouterMessages = formatMessagesForOpenRouter(messages, systemPrompt);
        const containsImages = hasImageAttachments(messages);
        const openRouterModelsToTry = containsImages
          ? [...VISION_OPENROUTER_FREE_MODELS, ...ACTIVE_OPENROUTER_FREE_MODELS.filter(m => !VISION_OPENROUTER_FREE_MODELS.includes(m))]
          : ACTIVE_OPENROUTER_FREE_MODELS;

        for (const orModel of openRouterModelsToTry) {
          try {
            accumulatedText = "";
            const generator = streamOpenRouterApi({
              apiKey: openRouterKey,
              model: orModel,
              messages: openRouterMessages,
            });

            for await (const tokenChunk of generator) {
              if (tokenChunk) {
                accumulatedText += tokenChunk;
                res.write(`data: ${JSON.stringify({ text: tokenChunk })}\n\n`);
              }
            }

            streamSuccess = true;
            if (cacheKey && accumulatedText) {
              setCache(cacheKey, { text: accumulatedText, provider: "OpenRouter" });
            }
            break;
          } catch (err: any) {
            openRouterLastError = err?.message || String(err);
            console.error(`[OpenRouter Stream Fallback Model Error] ${orModel}:`, openRouterLastError);
          }
        }
      }
    }

    // 3. IF BOTH PROVIDERS FAILED
    if (!streamSuccess) {
      console.error("[Backend Stream Error Summary] Primary provider error:", geminiLastError, "| Fallback provider error:", openRouterLastError);
      const userErrorMsg = "⚠️ The service is currently experiencing high demand. Please try again in a few moments.";
      res.write(`data: ${JSON.stringify({ text: userErrorMsg })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    const errDetail = error?.message || String(error);
    console.error("[POST /api/chat/stream Unexpected Error]:", errDetail);
    res.write(`data: ${JSON.stringify({ text: `\n\n⚠️ An unexpected error occurred: ${errDetail}` })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  } finally {
    if (reqSig) activeRequests.delete(reqSig);
  }
});

// Text-to-Speech (TTS) Endpoint
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voiceName = "Kore" } = req.body;

    if (!text) {
      res.status(400).json({ error: "Text is required for TTS." });
      return;
    }

    const geminiKey = sanitizeKey(process.env.GEMINI_API_KEY);
    if (!geminiKey) {
      res.status(400).json({ error: "GEMINI_API_KEY is missing for TTS feature." });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      res.status(500).json({ error: "Failed to synthesize speech audio." });
      return;
    }

    res.json({ audio: base64Audio, mimeType: "audio/pcm;rate=24000" });
  } catch (error: any) {
    res.status(500).json({ error: "TTS generation temporarily unavailable." });
  }
});

// Catch-all route handler for unhandled /api routes
app.use("/api/*", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

// --------------------------------------------------
// VITE / STATIC SERVING
// --------------------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`⚡ Infinity AI Full-Stack Server running at http://localhost:${PORT} (or http://127.0.0.1:${PORT})`);
  });
}

startServer();
export default app;
