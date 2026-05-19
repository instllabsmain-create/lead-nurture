import type { Client, KnowledgeBase, Lead, Message } from "@/types";
import { getClientConfig } from "@/lib/config";

interface BuildPromptArgs {
  client: Client;
  lead: Lead;
  messages: Message[];
  knowledgeBase: KnowledgeBase[];
}

function getLanguage(client: Client): string {
  const config = getClientConfig(client.config);
  const language = config.ai?.language ?? "auto";

  if (language === "auto") {
    return "Match the language the lead is using - English, Hindi, or Hinglish";
  }

  return language;
}

function formatKnowledgeBase(knowledgeBase: KnowledgeBase[]): string {
  return knowledgeBase
    .map((entry) => {
      const title = entry.title?.trim();
      return title ? `${title}: ${entry.content}` : entry.content;
    })
    .join("\n\n");
}

function formatAnsweredQuestions(answers: Record<string, string>): string {
  const lines = Object.entries(answers)
    .filter(([, answer]) => answer.trim().length > 0)
    .map(([question, answer]) => `  ${question}: ${answer}`);

  if (lines.length === 0) {
    return "  (none yet)";
  }

  return lines.join("\n");
}

function formatQuestions(questions: string[]): string {
  return questions.map((question, index) => `${index + 1}. ${question}`).join("\n");
}

export function buildPrompt({
  client,
  lead,
  messages,
  knowledgeBase,
}: BuildPromptArgs): string {
  void messages;

  const config = getClientConfig(client.config);
  const language = getLanguage(client);
  const promptSections: string[] = [
    `You are a sales assistant for ${client.name}, an Indian business.`,
    "",
    "ABOUT THIS BUSINESS:",
    config.business_description || "No business description provided.",
  ];

  if (knowledgeBase.length > 0) {
    promptSections.push(
      "",
      "BUSINESS KNOWLEDGE (use this to answer questions accurately):",
      formatKnowledgeBase(knowledgeBase),
    );
  }

  promptSections.push(
    "",
    "YOUR JOB:",
    `- Reply warmly and naturally in ${language}`,
    "- You are qualifying this lead by asking questions to understand their needs",
    "- Questions to ask (ask only ONE per reply, and only if not already answered):",
    `  ${formatQuestions(config.qualification_questions ?? [])}`.replace(/\n/g, "\n  "),
    "- Already answered by this lead (DO NOT ask these again):",
    formatAnsweredQuestions(lead.answers),
    "- If the lead seems ready to buy, is asking about pricing/next steps, or their score is high:",
    "  suggest they speak with the team or that someone will follow up with them directly",
    "- If you don't know something: say you'll check and get back to them",
    "- Never make up prices, dates, or facts not in the knowledge base",
    "",
    "TONE RULES:",
    "- Warm and helpful, not salesy or pushy",
    "- Sound like a real person who works there, not a corporate template",
    "- Max 2-3 short sentences per reply",
    "- Match the language and formality of the lead",
    "",
    `LANGUAGE: ${language}`,
    "",
    "Now reply to the lead's latest message.",
  );

  return promptSections.join("\n");
}
