import { z } from "zod";

import { sendViaChannel } from "@/lib/channels";
import { getActiveClientContext } from "@/lib/active-client";
import type { Channel, Lead } from "@/types";

const sendMessageSchema = z.object({
  leadId: z.uuid(),
  message: z.string().trim().min(1),
});

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

async function loadLead(
  supabase: Awaited<ReturnType<typeof getActiveClientContext>>["supabase"],
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
  supabase: Awaited<ReturnType<typeof getActiveClientContext>>["supabase"],
  lead: Lead,
  clientId: string,
): Promise<Channel | null> {
  if (!lead.channel_id) {
    return null;
  }

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("id", lead.channel_id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load channel: ${error.message}`);
  }

  return (data as Channel | null) ?? null;
}

async function saveOutboundMessage(
  supabase: Awaited<ReturnType<typeof getActiveClientContext>>["supabase"],
  clientId: string,
  leadId: string,
  channelType: Channel["type"],
  message: string,
  sentAt: string,
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    client_id: clientId,
    lead_id: leadId,
    direction: "outbound",
    channel: channelType,
    content: {
      type: "text",
      text: message,
    },
    ai_generated: false,
    sent_at: sentAt,
  });

  if (error) {
    throw new Error(`Failed to save outbound message: ${error.message}`);
  }
}

async function updateLeadLastActive(
  supabase: Awaited<ReturnType<typeof getActiveClientContext>>["supabase"],
  leadId: string,
  clientId: string,
  timestamp: string,
): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update({
      last_active: timestamp,
    })
    .eq("id", leadId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to update lead activity: ${error.message}`);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, client } = await getActiveClientContext();

    const body = sendMessageSchema.safeParse((await request.json()) as unknown);

    if (!body.success) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const lead = await loadLead(supabase, body.data.leadId, client.id);

    if (!lead) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const channel = await loadChannel(supabase, lead, client.id);

    if (!channel) {
      return Response.json({ error: "Channel not found" }, { status: 404 });
    }

    const sentAt = new Date().toISOString();

    await sendViaChannel(channel.type, {
      recipientId: lead.platform_id,
      message: body.data.message,
      accessToken: channel.access_token,
      phoneNumberId: channel.account_id ?? undefined,
      clientId: client.id,
    });

    await saveOutboundMessage(
      supabase,
      client.id,
      lead.id,
      channel.type,
      body.data.message,
      sentAt,
    );

    await updateLeadLastActive(supabase, lead.id, client.id, sentAt);

    return Response.json({ ok: true });
  } catch (error) {
    console.error(`Human reply failed: ${getSafeErrorMessage(error)}`);
    return Response.json({ error: "Failed to send message" }, { status: 500 });
  }
}
