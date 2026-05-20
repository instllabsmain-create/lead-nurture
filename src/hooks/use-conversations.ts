"use client";

import { useState } from "react";

import type { ConversationListItem } from "@/components/inbox/conversation-list";
import type {
  ConversationThreadLead,
  ConversationThreadMessage,
} from "@/components/inbox/conversation-thread";
import { useRealtimeLeads, useRealtimeMessages } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadStatus, Message, MessageContent } from "@/types";

interface UseConversationsOptions {
  clientId: string;
  initialConversations: ConversationListItem[];
  activeLeadId?: string;
  initialLead?: ConversationThreadLead | null;
  initialMessages?: ConversationThreadMessage[];
}

interface UseConversationsResult {
  conversations: ConversationListItem[];
  selectedLead: ConversationThreadLead | null;
  messages: ConversationThreadMessage[];
}

interface LeadLookupRow {
  id: string;
  client_id: string;
  name: string | null;
  handle: string | null;
  score: number;
  status: LeadStatus;
  assigned_agent_id: string | null;
  last_active: string;
  ai_paused: boolean;
}

function getConversationName(
  name: string | null,
  handle: string | null,
): string {
  return name?.trim() || handle?.trim() || "Unknown lead";
}

function getMessagePreview(content: MessageContent): string {
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

function sortConversations(
  conversations: ConversationListItem[],
): ConversationListItem[] {
  return [...conversations].sort((left, right) => {
    const leftTime = new Date(left.lastActive).getTime();
    const rightTime = new Date(right.lastActive).getTime();

    return rightTime - leftTime;
  });
}

function upsertConversation(
  conversations: ConversationListItem[],
  nextConversation: ConversationListItem,
): ConversationListItem[] {
  const index = conversations.findIndex(
    (conversation) => conversation.id === nextConversation.id,
  );

  if (index === -1) {
    return sortConversations([...conversations, nextConversation]);
  }

  const updated = [...conversations];
  updated[index] = {
    ...updated[index],
    ...nextConversation,
  };

  return sortConversations(updated);
}

function upsertThreadMessage(
  messages: ConversationThreadMessage[],
  nextMessage: ConversationThreadMessage,
): ConversationThreadMessage[] {
  if (messages.some((message) => message.id === nextMessage.id)) {
    return messages;
  }

  return [...messages, nextMessage].sort((left, right) => {
    const leftTime = new Date(left.sentAt).getTime();
    const rightTime = new Date(right.sentAt).getTime();

    return leftTime - rightTime;
  });
}

export function useConversations({
  clientId,
  initialConversations,
  activeLeadId,
  initialLead = null,
  initialMessages = [],
}: UseConversationsOptions): UseConversationsResult {
  const [supabase] = useState(() => createClient());
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedLead, setSelectedLead] = useState<ConversationThreadLead | null>(
    initialLead,
  );
  const [messages, setMessages] = useState(initialMessages);

  async function hydrateConversationFromMessage(message: Message) {
    const { data } = await supabase
      .from("leads")
      .select(
        "id, client_id, name, handle, score, status, assigned_agent_id, last_active, ai_paused",
      )
      .eq("client_id", clientId)
      .eq("id", message.lead_id)
      .maybeSingle();

    const lead = (data as LeadLookupRow | null) ?? null;

    if (!lead) {
      return;
    }

    const nextConversation: ConversationListItem = {
      id: lead.id,
      name: lead.name,
      handle: lead.handle,
      score: lead.score,
      status: lead.status,
      assignedAgentId: lead.assigned_agent_id,
      lastActive: lead.last_active,
      preview: getMessagePreview(message.content),
      channel: message.channel,
      unread: message.direction === "inbound",
    };

    setConversations((current) => upsertConversation(current, nextConversation));

    if (activeLeadId === lead.id) {
      setSelectedLead((current) => ({
        id: lead.id,
        name: getConversationName(lead.name, lead.handle),
        handle: lead.handle,
        score: lead.score,
        status: lead.status,
        assignedAgentId: lead.assigned_agent_id,
        lastActive: lead.last_active,
        channel: current?.channel ?? message.channel,
        aiPaused: (lead as LeadLookupRow).ai_paused ?? current?.aiPaused ?? false,
      }));
    }
  }

  function handleNewMessage(message: Message) {
    const nextThreadMessage: ConversationThreadMessage = {
      id: message.id,
      direction: message.direction,
      content: message.content,
      aiGenerated: message.ai_generated,
      sentAt: message.sent_at,
    };

    let hasConversation = false;

    setConversations((current) => {
      const existing = current.find(
        (conversation) => conversation.id === message.lead_id,
      );

      if (!existing) {
        return current;
      }

      hasConversation = true;

      return upsertConversation(current, {
        ...existing,
        preview: getMessagePreview(message.content),
        channel: message.channel,
        lastActive: message.sent_at,
        unread:
          message.direction === "inbound" ? true : activeLeadId !== message.lead_id,
      });
    });

    if (!hasConversation) {
      void hydrateConversationFromMessage(message);
    }

    if (activeLeadId === message.lead_id) {
      setMessages((current) => upsertThreadMessage(current, nextThreadMessage));
      setSelectedLead((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          lastActive: message.sent_at,
          channel: current.channel ?? message.channel,
        };
      });
    }
  }

  function handleLeadUpdate(lead: Lead) {
    setConversations((current) => {
      const existing = current.find((conversation) => conversation.id === lead.id);

      if (!existing) {
        return current;
      }

      return upsertConversation(current, {
        ...existing,
        name: lead.name,
        handle: lead.handle,
        score: lead.score,
        status: lead.status,
        assignedAgentId: lead.assigned_agent_id,
        lastActive: lead.last_active,
        unread: existing.unread || lead.status === "new",
      });
    });

    if (activeLeadId === lead.id) {
      setSelectedLead((current) => ({
        id: lead.id,
        name: getConversationName(lead.name, lead.handle),
        handle: lead.handle,
        score: lead.score,
        status: lead.status,
        assignedAgentId: lead.assigned_agent_id,
        lastActive: lead.last_active,
        channel: current?.channel ?? null,
        aiPaused: lead.ai_paused,
      }));
    }
  }

  useRealtimeMessages(clientId, handleNewMessage);
  useRealtimeLeads(clientId, handleLeadUpdate);

  return {
    conversations,
    selectedLead,
    messages,
  };
}
