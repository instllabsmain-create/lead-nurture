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

function getOpenRouterApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY");
  }

  return apiKey;
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

export async function generateReply({
  lead,
  messages,
  client,
  knowledgeBase,
}: GenerateReplyArgs): Promise<string> {
  const systemPrompt = buildPrompt({ client, lead, messages, knowledgeBase });
  const config = getClientConfig(client.config);

  const history: OpenRouterRequestMessage[] = messages
    .slice(-10)
    .map((message) => ({
      role: message.direction === "inbound" ? "user" : "assistant",
      content: message.content.text ?? "",
    }));

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getOpenRouterApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.ai?.model ?? "google/gemini-2.5-flash-lite",
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
