import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateReply } from "@/lib/ai";
import { sendViaChannel } from "@/lib/channels";
import type { Channel, Client, KnowledgeBase, Lead, Message } from "@/types";

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

async function loadLead(
  supabase: SupabaseClient,
  leadId: string,
  clientId: string,
): Promise<Lead | null> {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load lead: ${error.message}`);
  }

  return (data as Lead | null) ?? null;
}

async function loadChannel(
  supabase: SupabaseClient,
  lead: Lead,
): Promise<Channel | null> {
  if (!lead.channel_id) {
    return null;
  }

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("id", lead.channel_id)
    .eq("client_id", lead.client_id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load channel: ${error.message}`);
  }

  return (data as Channel | null) ?? null;
}

async function loadClient(
  supabase: SupabaseClient,
  clientId: string,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client: ${error.message}`);
  }

  return (data as Client | null) ?? null;
}

async function loadKnowledgeBase(
  supabase: SupabaseClient,
  clientId: string,
): Promise<KnowledgeBase[]> {
  const { data, error } = await supabase
    .from("knowledge_base")
    .select("id, client_id, title, content, created_at")
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to load knowledge base: ${error.message}`);
  }

  return (data ?? []) as KnowledgeBase[];
}

async function loadMessages(
  supabase: SupabaseClient,
  leadId: string,
  clientId: string,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: true })
    .limit(25);

  if (error) {
    throw new Error(`Failed to load messages: ${error.message}`);
  }

  return (data ?? []) as Message[];
}

async function saveAiReply(
  supabase: SupabaseClient,
  lead: Lead,
  channel: Channel,
  reply: string,
): Promise<string> {
  const sentAt = new Date().toISOString();
  const { error } = await supabase.from("messages").insert({
    client_id: lead.client_id,
    lead_id: lead.id,
    direction: "outbound",
    channel: channel.type,
    content: {
      type: "text",
      text: reply,
    },
    ai_generated: true,
    sent_at: sentAt,
  });

  if (error) {
    throw new Error(`Failed to save AI reply: ${error.message}`);
  }

  return sentAt;
}

async function updateLeadLastActive(
  supabase: SupabaseClient,
  lead: Lead,
  timestamp: string,
): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({ last_active: timestamp })
    .eq("id", lead.id)
    .eq("client_id", lead.client_id);

  if (error) {
    throw new Error(`Failed to update lead activity: ${error.message}`);
  }
}

export async function resumeAiForLeadIfPending({
  supabase,
  clientId,
  leadId,
}: {
  supabase: SupabaseClient;
  clientId: string;
  leadId: string;
}): Promise<{ triggered: boolean; reason?: string }> {
  try {
    const lead = await loadLead(supabase, leadId, clientId);

    if (!lead) {
      return { triggered: false, reason: "lead_not_found" };
    }

    if (lead.ai_paused) {
      return { triggered: false, reason: "still_paused" };
    }

    const [channel, client, knowledgeBase, messages] = await Promise.all([
      loadChannel(supabase, lead),
      loadClient(supabase, clientId),
      loadKnowledgeBase(supabase, clientId),
      loadMessages(supabase, lead.id, clientId),
    ]);

    if (!channel || !client) {
      return { triggered: false, reason: "missing_channel_or_client" };
    }

    const latestMessage = messages[messages.length - 1];

    if (!latestMessage || latestMessage.direction !== "inbound") {
      return { triggered: false, reason: "no_pending_inbound" };
    }

    const reply = (await generateReply({
      lead,
      messages,
      client,
      knowledgeBase,
    })).trim();

    if (!reply) {
      return { triggered: false, reason: "empty_reply" };
    }

    const sentAt = await saveAiReply(supabase, lead, channel, reply);

    await sendViaChannel(channel.type, {
      recipientId: lead.platform_id,
      message: reply,
      accessToken: channel.access_token,
      phoneNumberId: channel.account_id ?? undefined,
      clientId,
    });

    await updateLeadLastActive(supabase, lead, sentAt);

    return { triggered: true };
  } catch (error) {
    console.error(`AI resume failed: ${getSafeErrorMessage(error)}`);
    return { triggered: false, reason: "resume_failed" };
  }
}
