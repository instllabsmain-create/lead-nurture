import { Receiver } from "@upstash/qstash";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { sendViaChannel } from "@/lib/channels";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Channel, FollowUp, Lead, Message } from "@/types";

const followUpRequestSchema = z.object({
  leadId: z.uuid(),
  clientId: z.uuid(),
  message: z.string().trim().min(1),
});

type ServiceRoleClient = SupabaseClient;

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function getReceiver(): Receiver {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  if (!currentSigningKey || !nextSigningKey) {
    throw new Error(
      "Missing required QStash signing key environment variables",
    );
  }

  return new Receiver({
    currentSigningKey,
    nextSigningKey,
  });
}

async function verifyQStashSignature(
  request: Request,
  rawBody: string,
): Promise<boolean> {
  const signature = request.headers.get("upstash-signature");

  if (!signature) {
    return false;
  }

  const receiver = getReceiver();

  try {
    await receiver.verify({
      signature,
      body: rawBody,
      url: request.url,
      upstashRegion: request.headers.get("upstash-region") ?? undefined,
    });

    return true;
  } catch {
    return false;
  }
}

async function loadLead(
  supabase: ServiceRoleClient,
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
  supabase: ServiceRoleClient,
  channelId: string | null,
  clientId: string,
): Promise<Channel | null> {
  if (!channelId) {
    return null;
  }

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("id", channelId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load channel: ${error.message}`);
  }

  return (data as Channel | null) ?? null;
}

async function loadLastInboundTimestamp(
  supabase: ServiceRoleClient,
  leadId: string,
  clientId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("messages")
    .select("sent_at")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .eq("direction", "inbound")
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load last inbound message: ${error.message}`);
  }

  return typeof data?.sent_at === "string" ? data.sent_at : null;
}

async function loadPendingFollowUp(
  supabase: ServiceRoleClient,
  leadId: string,
  clientId: string,
  message: string,
): Promise<FollowUp | null> {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .eq("message", message)
    .eq("sent", false)
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load follow-up row: ${error.message}`);
  }

  return (data as FollowUp | null) ?? null;
}

async function hasMatchingOutboundMessage(
  supabase: ServiceRoleClient,
  leadId: string,
  clientId: string,
  message: string,
  referenceTimeIso: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("messages")
    .select("content, sent_at")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .eq("direction", "outbound")
    .eq("ai_generated", true)
    .order("sent_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Failed to inspect prior follow-ups: ${error.message}`);
  }

  const referenceTime = new Date(referenceTimeIso).getTime();

  return ((data ?? []) as Pick<Message, "content" | "sent_at">[]).some((item) => {
    const sentAt = new Date(item.sent_at).getTime();

    return (
      Number.isFinite(sentAt) &&
      sentAt >= referenceTime &&
      item.content.type === "text" &&
      item.content.text === message
    );
  });
}

async function saveOutboundMessage(
  supabase: ServiceRoleClient,
  leadId: string,
  clientId: string,
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
    ai_generated: true,
    sent_at: sentAt,
  });

  if (error) {
    throw new Error(`Failed to save follow-up message: ${error.message}`);
  }
}

async function markFollowUpSent(
  supabase: ServiceRoleClient,
  followUp: FollowUp | null,
  clientId: string,
  sentAt: string,
): Promise<void> {
  if (!followUp) {
    return;
  }

  const { error } = await supabase
    .from("follow_ups")
    .update({
      sent: true,
      sent_at: sentAt,
    })
    .eq("id", followUp.id)
    .eq("client_id", clientId)
    .eq("sent", false);

  if (error) {
    throw new Error(`Failed to mark follow-up as sent: ${error.message}`);
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const isValid = await verifyQStashSignature(request, rawBody);

    if (!isValid) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(rawBody) as unknown;
    } catch {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsedBody = followUpRequestSchema.safeParse(parsedJson);

    if (!parsedBody.success) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { leadId, clientId, message } = parsedBody.data;
    const supabase = createServiceRoleClient();
    const [lead, pendingFollowUp] = await Promise.all([
      loadLead(supabase, leadId, clientId),
      loadPendingFollowUp(supabase, leadId, clientId, message),
    ]);

    if (!lead) {
      return Response.json({ ok: true });
    }

    const channel = await loadChannel(supabase, lead.channel_id, clientId);

    if (!channel) {
      return Response.json({ ok: true });
    }

    const scheduledReferenceIso =
      pendingFollowUp?.created_at ?? new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    const duplicateAlreadySent = await hasMatchingOutboundMessage(
      supabase,
      leadId,
      clientId,
      message,
      pendingFollowUp?.scheduled_at ?? scheduledReferenceIso,
    );

    if (duplicateAlreadySent) {
      try {
        await markFollowUpSent(
          supabase,
          pendingFollowUp,
          clientId,
          new Date().toISOString(),
        );
      } catch (error) {
        console.error(getSafeErrorMessage(error));
      }

      return Response.json({ ok: true, skipped: true });
    }

    const lastInboundTimestamp = await loadLastInboundTimestamp(
      supabase,
      leadId,
      clientId,
    );

    if (
      lastInboundTimestamp &&
      new Date(lastInboundTimestamp).getTime() > new Date(scheduledReferenceIso).getTime()
    ) {
      return Response.json({ ok: true, skipped: true });
    }

    await sendViaChannel(channel.type, {
      recipientId: lead.platform_id,
      message,
      accessToken: channel.access_token,
      phoneNumberId: channel.account_id ?? undefined,
      clientId,
    });

    const sentAt = new Date().toISOString();

    try {
      await saveOutboundMessage(
        supabase,
        leadId,
        clientId,
        channel.type,
        message,
        sentAt,
      );
    } catch (error) {
      console.error(getSafeErrorMessage(error));
    }

    try {
      await markFollowUpSent(supabase, pendingFollowUp, clientId, sentAt);
    } catch (error) {
      console.error(getSafeErrorMessage(error));
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error(`Follow-up route failed: ${getSafeErrorMessage(error)}`);
    return Response.json({ error: "Failed to process follow-up" }, { status: 500 });
  }
}
