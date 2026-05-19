import type { Client, Lead, Message } from "@/types";
import { getClientConfig } from "@/lib/config";

interface ScoreLeadArgs {
  lead: Lead;
  messages: Message[];
  client: Client;
}

const BUYING_SIGNALS = [
  "interested",
  "want to buy",
  "how much",
  "price",
  "cost",
  "when can",
  "available",
  "book",
  "purchase",
  "order",
  "buy",
] as const;

const URGENCY_SIGNALS = [
  "urgent",
  "asap",
  "today",
  "this week",
  "immediately",
  "quickly",
  "soon",
  "need now",
  "right now",
] as const;

const NEGATIVE_SIGNALS = [
  "not interested",
  "no thanks",
  "too expensive",
  "just browsing",
  "maybe later",
  "not now",
  "cancel",
  "stop",
] as const;

function messageAnswersQuestion(text: string, question: string): boolean {
  const keywords = question
    .toLowerCase()
    .split(" ")
    .filter((word) => word.length > 3);

  return text.length > 15 && keywords.some((keyword) => text.includes(keyword));
}

export async function scoreLead({
  lead,
  messages,
  client,
}: ScoreLeadArgs): Promise<{
  score: number;
  answers: Record<string, string>;
}> {
  const config = getClientConfig(client.config);
  const weights = config.scoring ?? {};
  let score = lead.score;
  const answers = { ...lead.answers };

  const latestInbound = [...messages]
    .reverse()
    .find((message) => message.direction === "inbound");

  if (!latestInbound?.content.text) {
    return { score, answers };
  }

  const latestText = latestInbound.content.text;
  const normalizedText = latestText.toLowerCase();
  const questions = config.qualification_questions ?? [];

  for (const question of questions) {
    if (answers[question]) {
      continue;
    }

    if (messageAnswersQuestion(normalizedText, question)) {
      answers[question] = latestText;
      score += weights.question_answered ?? 0;
    }
  }

  if (BUYING_SIGNALS.some((signal) => normalizedText.includes(signal))) {
    score += weights.buying_signal ?? 0;
  }

  if (URGENCY_SIGNALS.some((signal) => normalizedText.includes(signal))) {
    score += weights.urgency_signal ?? 0;
  }

  if (NEGATIVE_SIGNALS.some((signal) => normalizedText.includes(signal))) {
    score += weights.negative_signal ?? 0;
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    answers,
  };
}
