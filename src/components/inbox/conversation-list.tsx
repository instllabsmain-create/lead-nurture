"use client";

import Link from "next/link";
import { useState } from "react";

import type { LeadStatus, Platform } from "@/types";

type ConversationFilter = "all" | "unread" | "assigned" | "qualified";

export interface ConversationListItem {
  id: string;
  name: string | null;
  handle: string | null;
  score: number;
  status: LeadStatus;
  assignedAgentId: string | null;
  lastActive: string;
  preview: string;
  channel: Platform | null;
  unread: boolean;
}

interface ConversationListProps {
  conversations: ConversationListItem[];
  activeLeadId?: string;
}

const filterLabels: Record<ConversationFilter, string> = {
  all: "All",
  unread: "Unread",
  assigned: "Assigned",
  qualified: "Qualified",
};

function getInitials(name: string | null, handle: string | null): string {
  const source = name?.trim() || handle?.trim() || "Lead";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatTimeAgo(value: string): string {
  const timestamp = new Date(value).getTime();
  const deltaMs = timestamp - Date.now();

  if (!Number.isFinite(timestamp)) {
    return "";
  }

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minutes = Math.round(deltaMs / (1000 * 60));

  if (Math.abs(minutes) < 60) {
    return formatter.format(minutes, "minute");
  }

  const hours = Math.round(minutes / 60);

  if (Math.abs(hours) < 24) {
    return formatter.format(hours, "hour");
  }

  const days = Math.round(hours / 24);

  if (Math.abs(days) < 7) {
    return formatter.format(days, "day");
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
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

export function ConversationList({
  conversations,
  activeLeadId,
}: ConversationListProps) {
  const [activeFilter, setActiveFilter] = useState<ConversationFilter>("all");

  const filteredConversations = conversations.filter((conversation) => {
    switch (activeFilter) {
      case "unread":
        return conversation.unread;
      case "assigned":
        return conversation.assignedAgentId !== null || conversation.status === "assigned";
      case "qualified":
        return conversation.status === "qualified";
      default:
        return true;
    }
  });

  return (
    <aside className="flex h-full min-h-0 flex-col border-b border-border bg-white lg:border-b-0 lg:border-r">
      <div className="border-b border-border px-4 py-4">
        <div className="font-mono text-[9px] uppercase tracking-[2.5px] text-dust">
          Conversations
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(filterLabels) as ConversationFilter[]).map((filter) => {
            const isActive = activeFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={
                  isActive
                    ? "rounded-full border border-saffron bg-ember px-3 py-1.5 font-body text-xs text-ember-text transition-all duration-150"
                    : "rounded-full border border-border bg-white px-3 py-1.5 font-body text-xs text-dust transition-all duration-150 hover:border-saffron hover:text-saffron"
                }
              >
                {filterLabels[filter]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="px-4 py-6 font-body text-sm text-dust">
            No conversations match this filter.
          </div>
        ) : (
          filteredConversations.map((conversation) => {
            const isActive = conversation.id === activeLeadId;

            return (
              <Link
                key={conversation.id}
                href={`/inbox/${conversation.id}`}
                className={[
                  "block border-b border-border border-l-2 px-4 py-3 transition-colors duration-150 hover:bg-parchment",
                  isActive
                    ? "border-l-saffron bg-parchment"
                    : "border-l-transparent bg-white",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ember font-mono text-[10px] font-medium text-ember-text">
                    {getInitials(conversation.name, conversation.handle)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-body text-sm font-medium text-pitch">
                            {conversation.name?.trim()
                              || conversation.handle?.trim()
                              || "Unknown lead"}
                          </p>
                          {conversation.unread ? (
                            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-saffron" />
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {conversation.channel ? (
                            <span className="rounded-full border border-border bg-parchment px-2 py-0.5 font-mono text-[9px] text-dust">
                              {getChannelLabel(conversation.channel)}
                            </span>
                          ) : null}
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${getScoreBadgeClassName(conversation.score)}`}
                          >
                            {conversation.score}
                          </span>
                        </div>
                      </div>

                      <span className="flex-shrink-0 font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                        {formatTimeAgo(conversation.lastActive)}
                      </span>
                    </div>

                    <p className="mt-2 truncate font-body text-xs text-dust">
                      {conversation.preview}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </aside>
  );
}

export default ConversationList;
