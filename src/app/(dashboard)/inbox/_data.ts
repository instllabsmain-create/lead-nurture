import "server-only";

import { redirect } from "next/navigation";

import { getActiveClientContext } from "@/lib/active-client";
import type { Lead, Message, MessageContent, Platform } from "@/types";

function getMessagePreview(content: MessageContent | null): string {
  if (!content) {
    return "No messages yet.";
  }

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

function getConversationName(lead: Pick<Lead, "name" | "handle">): string {
  return lead.name?.trim() || lead.handle?.trim() || "Unknown lead";
}

interface ConversationLeadRow {
  id: string;
  client_id: string;
  channel_id: string | null;
  name: string | null;
  handle: string | null;
  score: number;
  status: Lead["status"];
  assigned_agent_id: string | null;
  last_active: string;
  ai_paused: boolean;
}

interface ConversationMessageRow {
  id: string;
  lead_id: string;
  direction: Message["direction"];
  channel: Platform;
  content: MessageContent;
  ai_generated: boolean;
  sent_at: string;
}

interface ChannelRow {
  id: string;
  type: Platform;
}

interface LoadInboxDataArgs {
  selectedLeadId?: string;
  redirectIfMissingLead?: boolean;
}

const CONVERSATION_LIST_LIMIT = 100;
const RECENT_MESSAGES_PER_LEAD = 4;
const MIN_RECENT_MESSAGES = 60;
const THREAD_MESSAGE_LIMIT = 100;
const CONVERSATION_LEAD_SELECT =
  "id, client_id, channel_id, name, handle, score, status, assigned_agent_id, last_active, ai_paused";

export async function loadInboxData({
  selectedLeadId,
  redirectIfMissingLead = true,
}: LoadInboxDataArgs = {}) {
  const { supabase, client } = await getActiveClientContext();

  const { data: leadsData } = await supabase
    .from("leads")
    .select(CONVERSATION_LEAD_SELECT)
    .eq("client_id", client.id)
    .order("last_active", { ascending: false })
    .limit(CONVERSATION_LIST_LIMIT);

  let leads = (leadsData ?? []) as ConversationLeadRow[];

  if (selectedLeadId && !leads.some((lead) => lead.id === selectedLeadId)) {
    const { data: selectedLeadData } = await supabase
      .from("leads")
      .select(CONVERSATION_LEAD_SELECT)
      .eq("client_id", client.id)
      .eq("id", selectedLeadId)
      .maybeSingle();

    if (selectedLeadData) {
      leads = [selectedLeadData as ConversationLeadRow, ...leads];
    }
  }

  const leadIds = leads.map((lead) => lead.id);
  const channelIds = leads
    .map((lead) => lead.channel_id)
    .filter((channelId): channelId is string => typeof channelId === "string");

  let recentMessages: ConversationMessageRow[] = [];
  let channels: ChannelRow[] = [];

  if (leadIds.length > 0) {
    const [messagesResult, channelsResult] = await Promise.all([
      supabase
        .from("messages")
        .select("id, lead_id, direction, channel, content, ai_generated, sent_at")
        .eq("client_id", client.id)
        .in("lead_id", leadIds)
        .order("sent_at", { ascending: false })
        .limit(Math.max(leadIds.length * RECENT_MESSAGES_PER_LEAD, MIN_RECENT_MESSAGES)),
      channelIds.length > 0
        ? supabase
            .from("channels")
            .select("id, type")
            .eq("client_id", client.id)
            .in("id", channelIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    recentMessages = (messagesResult.data ?? []) as ConversationMessageRow[];
    channels = (channelsResult.data ?? []) as ChannelRow[];
  }

  const latestMessageByLead = new Map<string, ConversationMessageRow>();

  for (const message of recentMessages) {
    if (!latestMessageByLead.has(message.lead_id)) {
      latestMessageByLead.set(message.lead_id, message);
    }
  }

  const channelTypeById = new Map(channels.map((channel) => [channel.id, channel.type]));

  const conversations = leads.map((lead) => {
    const latestMessage = latestMessageByLead.get(lead.id);
    const channel =
      latestMessage?.channel
      ?? (lead.channel_id ? channelTypeById.get(lead.channel_id) ?? null : null);

    return {
      id: lead.id,
      name: lead.name,
      handle: lead.handle,
      score: lead.score,
      status: lead.status,
      assignedAgentId: lead.assigned_agent_id,
      lastActive: lead.last_active,
      preview: getMessagePreview(latestMessage?.content ?? null),
      channel,
      unread: lead.status === "new",
    };
  });

  if (!selectedLeadId) {
    return {
      client,
      conversations,
      selectedLead: null,
      messages: [],
    };
  }

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId);

  if (!selectedLead) {
    if (redirectIfMissingLead) {
      redirect("/inbox");
    }

    return {
      client,
      conversations,
      selectedLead: null,
      messages: [],
    };
  }

  const { data: selectedMessagesData } = await supabase
    .from("messages")
    .select("id, direction, content, ai_generated, sent_at")
    .eq("client_id", client.id)
    .eq("lead_id", selectedLeadId)
    .order("sent_at", { ascending: false })
    .limit(THREAD_MESSAGE_LIMIT);

  const selectedChannel =
    selectedLead.channel_id ? channelTypeById.get(selectedLead.channel_id) ?? null : null;

  return {
    client,
    conversations,
    selectedLead: {
      id: selectedLead.id,
      name: getConversationName(selectedLead),
      handle: selectedLead.handle,
      score: selectedLead.score,
      status: selectedLead.status,
      assignedAgentId: selectedLead.assigned_agent_id,
      lastActive: selectedLead.last_active,
      channel: selectedChannel,
      aiPaused: selectedLead.ai_paused,
    },
    messages: ([...((selectedMessagesData ?? []) as Pick<
      Message,
      "id" | "direction" | "content" | "ai_generated" | "sent_at"
    >[])]).reverse().map((message) => ({
      id: message.id,
      direction: message.direction,
      content: message.content,
      aiGenerated: message.ai_generated,
      sentAt: message.sent_at,
    })),
  };
}
