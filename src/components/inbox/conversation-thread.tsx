"use client";

import { useEffect, useRef } from "react";

import { MessageInput } from "@/components/inbox/message-input";
import type { LeadStatus, MessageContent, MessageDirection, Platform } from "@/types";

export interface ConversationThreadLead {
  id: string;
  name: string;
  handle: string | null;
  score: number;
  status: LeadStatus;
  assignedAgentId: string | null;
  lastActive: string;
  channel: Platform | null;
}

export interface ConversationThreadMessage {
  id: string;
  direction: MessageDirection;
  content: MessageContent;
  aiGenerated: boolean;
  sentAt: string;
}

interface ConversationThreadProps {
  lead: ConversationThreadLead;
  messages: ConversationThreadMessage[];
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function getScoreBadgeClassName(score: number): string {
  if (score > 80) {
    return "bg-saffron text-white";
  }

  if (score >= 50) {
    return "bg-ember text-ember-text";
  }

  return "bg-parchment text-dust";
}

function getStatusBadgeClassName(status: LeadStatus): string {
  if (status === "qualified") {
    return "bg-saffron text-white";
  }

  if (status === "engaging" || status === "assigned") {
    return "bg-ember text-ember-text";
  }

  return "bg-parchment text-dust";
}

function getChannelLabel(channel: Platform): string {
  switch (channel) {
    case "instagram":
      return "Instagram";
    case "whatsapp":
      return "WhatsApp";
    case "facebook":
      return "Facebook";
    case "website":
      return "Website";
  }
}

function getMessageText(content: MessageContent): string {
  const text = content.text?.trim();

  if (text) {
    return text;
  }

  switch (content.type) {
    case "image":
      return "Image shared.";
    case "audio":
      return "Audio shared.";
    default:
      return "Message received.";
  }
}

function formatMessageTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatLastActive(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function ConversationThread({
  lead,
  messages,
}: ConversationThreadProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const latestMessage = messages[messages.length - 1];
  const defaultAiHandling =
    !latestMessage
    || latestMessage.direction === "inbound"
    || latestMessage.aiGenerated;

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [messages]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-parchment">
      <header className="border-b border-border bg-white px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-ember font-mono text-[10px] font-medium text-ember-text">
            {getInitials(lead.name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-body text-base font-medium text-pitch">
                {lead.name}
              </h1>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${getScoreBadgeClassName(lead.score)}`}
              >
                {lead.score}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${getStatusBadgeClassName(lead.status)}`}
              >
                {lead.status}
              </span>
              {lead.channel ? (
                <span className="rounded-full border border-border bg-parchment px-2 py-0.5 font-mono text-[9px] text-dust">
                  {getChannelLabel(lead.channel)}
                </span>
              ) : null}
            </div>

            <div className="mt-1 font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
              Last active {formatLastActive(lead.lastActive)}
            </div>
          </div>
        </div>
      </header>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.map((message) => {
            const isOutbound = message.direction === "outbound";

            return (
              <div
                key={message.id}
                className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[85%] sm:max-w-[75%]">
                  <div
                    className={[
                      "rounded-2xl px-4 py-3 shadow-sm",
                      isOutbound
                        ? "bg-saffron text-white"
                        : "border border-border bg-white text-pitch",
                    ].join(" ")}
                  >
                    {message.aiGenerated ? (
                      <span
                        className={[
                          "mb-2 inline-flex rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[1.5px]",
                          isOutbound
                            ? "bg-white/15 text-white"
                            : "bg-ember text-ember-text",
                        ].join(" ")}
                      >
                        AI
                      </span>
                    ) : null}

                    <p className="whitespace-pre-wrap font-body text-sm leading-6">
                      {getMessageText(message.content)}
                    </p>
                  </div>

                  <div
                    className={`mt-1 font-mono text-[9px] uppercase tracking-[1.5px] text-dust ${isOutbound ? "text-right" : "text-left"}`}
                  >
                    {formatMessageTime(message.sentAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-border bg-white p-4 lg:p-5">
        <div className="mx-auto w-full max-w-3xl">
          <MessageInput
            key={`${lead.id}:${latestMessage?.id ?? "empty"}:${defaultAiHandling ? "ai" : "human"}`}
            leadId={lead.id}
            defaultAiHandling={defaultAiHandling}
          />
        </div>
      </div>
    </section>
  );
}

export default ConversationThread;
