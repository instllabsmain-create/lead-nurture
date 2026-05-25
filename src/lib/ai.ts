import type { Client, KnowledgeBase, Lead, Message } from "@/types";
import { getClientConfig } from "@/lib/config";
import { buildPrompt } from "@/lib/prompts";

interface GenerateReplyArgs {
  lead: Lead;
  messages: Message[];
  client: Client;
  knowledgeBase: KnowledgeBase[];
}

type OpenRouterRole = "system" | "user" | "assistant";

interface OpenRouterRequestMessage {
  role: OpenRouterRole;
  content: string;
}

interface OpenRouterResponseMessage {
  content?: unknown;
}

interface OpenRouterChoice {
  message?: OpenRouterResponseMessage;
}

interface OpenRouterResponseBody {
  choices?: OpenRouterChoice[];
}

type GeminiRole = "user" | "model";

interface GeminiPart {
  text?: unknown;
}

interface GeminiContent {
  parts?: GeminiPart[];
}

interface GeminiCandidate {
  content?: GeminiContent;
}

interface GeminiResponseBody {
  candidates?: GeminiCandidate[];
}

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  return apiKey;
}

function getGeminiApiKey(): string | null {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? null;
}

function isGeminiModel(model: string): boolean {
  return model.startsWith("google/") || model.startsWith("gemini");
}

function getGeminiModelName(model: string): string {
  return model.startsWith("google/") ? model.slice("google/".length) : model;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getReplyContent(data: unknown): string {
  if (!isRecord(data)) {
    throw new Error("OpenRouter error: invalid response body");
  }

  const choices = data.choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error("OpenRouter error: missing response choices");
  }

  const firstChoice = choices[0];

  if (!isRecord(firstChoice)) {
    throw new Error("OpenRouter error: invalid response choice");
  }

  const message = firstChoice.message;

  if (!isRecord(message) || typeof message.content !== "string") {
    throw new Error("OpenRouter error: missing reply content");
  }

  return message.content.trim();
}

function getGeminiReplyContent(data: unknown): string {
  if (!isRecord(data)) {
    throw new Error("Gemini error: invalid response body");
  }

  const candidates = data.candidates;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error("Gemini error: missing response candidates");
  }

  const firstCandidate = candidates[0];

  if (!isRecord(firstCandidate)) {
    throw new Error("Gemini error: invalid response candidate");
  }

  const content = firstCandidate.content;

  if (!isRecord(content) || !Array.isArray(content.parts) || content.parts.length === 0) {
    throw new Error("Gemini error: missing reply content");
  }

  const text = content.parts
    .filter(isRecord)
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini error: empty reply content");
  }

  return text;
}

async function generateGeminiReply({
  systemPrompt,
  history,
  model,
}: {
  systemPrompt: string;
  history: OpenRouterRequestMessage[];
  model: string;
}): Promise<string> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const contents = history.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  })) satisfies Array<{ role: GeminiRole; parts: Array<{ text: string }> }>;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(getGeminiModelName(model))}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    const errorSuffix = errorBody.trim() || response.statusText || "Unknown error";
    throw new Error(`Gemini error (${response.status}): ${errorSuffix}`);
  }

  const data: GeminiResponseBody = await response.json();
  return getGeminiReplyContent(data);
}

async function generateOpenRouterReply({
  systemPrompt,
  history,
  model,
}: {
  systemPrompt: string;
  history: OpenRouterRequestMessage[];
  model: string;
}): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenRouterApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      temperature: 0.7,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
      ] satisfies OpenRouterRequestMessage[],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const errorSuffix = errorBody.trim() || response.statusText || "Unknown error";
    throw new Error(`OpenRouter error (${response.status}): ${errorSuffix}`);
  }

  const data: OpenRouterResponseBody = await response.json();
  return getReplyContent(data);
}

export async function generateReply({
  lead,
  messages,
  client,
  knowledgeBase,
}: GenerateReplyArgs): Promise<string> {
  const systemPrompt = buildPrompt({ client, lead, knowledgeBase });
  const config = getClientConfig(client.config);
  const model = config.ai?.model ?? "google/gemini-2.5-flash-lite";

  const history: OpenRouterRequestMessage[] = messages
    .slice(-10)
    .map((message) => ({
      role: message.direction === "inbound" ? "user" : "assistant",
      content: message.content.text ?? "",
    }));

  if (getGeminiApiKey() && isGeminiModel(model)) {
    return generateGeminiReply({
      systemPrompt,
      history,
      model,
    });
  }

  return generateOpenRouterReply({
    systemPrompt,
    history,
    model,
  });
}
