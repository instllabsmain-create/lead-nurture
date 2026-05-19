import { waitUntil } from "@vercel/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { generateReply } from "@/lib/ai";
import { assignLead } from "@/lib/assign";
import { sendViaChannel } from "@/lib/channels";
import { getClientConfig } from "@/lib/config";
import { notifyAgent, notifyClient } from "@/lib/notify";
import { scheduleFollowUp } from "@/lib/queue";
import { scoreLead } from "@/lib/score";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Channel, Client, KnowledgeBase, Lead, LeadStatus, Message, NormalisedMessage } from "@/types";

const normalisedMessageSchema = z.object({
  client_id: z.uuid().optional(),
  channel: z.enum(["instagram", "whatsapp", "facebook", "website"]),
  direction: z.literal("inbound"),
  from: z.object({
    id: z.string().trim().min(1),
    name: z.string().optional(),
    handle: z.string().optional(),
  }),
  to: z.object({
    id: z.string().trim().min(1),
  }),
  content: z.object({
    type: z.enum(["text", "image", "audio"]),
    text: z.string().optional(),
    url: z.string().optional(),
  }),
  timestamp: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid timestamp",
  }),
  raw: z.record(z.string(), z.unknown()),
});

type ServiceRoleClient = SupabaseClient;

interface ProcessMessageArgs {
  lead: Lead;
  channel: Channel;
  normalised: NormalisedMessage;
  supabase: ServiceRoleClient;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function getLeadDisplayName(lead: Lead, normalised: NormalisedMessage): string {
  return (
    lead.name?.trim()
    || lead.handle?.trim()
    || normalised.from.name?.trim()
    || normalised.from.handle?.trim()
    || "there"
  );
}

function buildFallbackMessages(normalised: NormalisedMessage, leadId: string, clientId: string): Message[] {
  return [
    {
      id: "inbound-fallback",
      client_id: clientId,
      lead_id: leadId,
      direction: "inbound",
      channel: normalised.channel,
      content: normalised.content,
      ai_generated: false,
      sent_at: normalised.timestamp,
    },
  ];
}

function getNextLeadStatus(
  lead: Lead,
  score: number,
  assignmentThreshold: number,
): LeadStatus {
  if (lead.status === "assigned" || lead.status === "closed") {
    return lead.status;
  }

  if (score >= assignmentThreshold) {
    return "qualified";
  }

  if (score >= 30) {
    return "engaging";
  }

  return lead.status;
}

function getFollowUpMessage(lead: Lead, normalised: NormalisedMessage): string {
  const firstName = getLeadDisplayName(lead, normalised).split(" ")[0] || "there";
  return `Hi ${firstName}, just checking in - still interested?`;
}

function parseNormalisedMessage(value: unknown): NormalisedMessage | null {
  const parsed = normalisedMessageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

async function loadRecentMessages(
  supabase: ServiceRoleClient,
  clientId: string,
  leadId: string,
  normalised: NormalisedMessage,
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("client_id", clientId)
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error(`Failed to load recent messages: ${error.message}`);
    return buildFallbackMessages(normalised, leadId, clientId);
  }

  const messages = ((data ?? []) as Message[]).reverse();
  return messages.length > 0
    ? messages
    : buildFallbackMessages(normalised, leadId, clientId);
}

async function loadClient(
  supabase: ServiceRoleClient,
  clientId: string,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error) {
    console.error(`Failed to load client: ${error.message}`);
    return null;
  }

  return data as Client;
}

async function loadKnowledgeBase(
  supabase: ServiceRoleClient,
  clientId: string,
): Promise<KnowledgeBase[]> {
  const { data, error } = await supabase
    .from("knowledge_base")
    .select("id, client_id, title, content, created_at")
    .eq("client_id", clientId);

  if (error) {
    console.error(`Failed to load knowledge base: ${error.message}`);
    return [];
  }

  return (data ?? []) as KnowledgeBase[];
}

async function saveOutboundMessage(
  supabase: ServiceRoleClient,
  clientId: string,
  leadId: string,
  channel: Channel,
  platformChannel: NormalisedMessage["channel"],
  reply: string,
): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    client_id: clientId,
    lead_id: leadId,
    direction: "outbound",
    channel: platformChannel,
    content: { type: "text", text: reply },
    ai_generated: true,
    sent_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to save outbound message: ${error.message}`);
  }

  void channel;
}

async function sendReply(
  clientId: string,
  channel: Channel,
  normalised: NormalisedMessage,
  reply: string,
): Promise<void> {
  await sendViaChannel(normalised.channel, {
    recipientId: normalised.from.id,
    message: reply,
    accessToken: channel.access_token,
    phoneNumberId: channel.account_id ?? undefined,
    clientId,
  });
}

async function updateLeadScore(
  supabase: ServiceRoleClient,
  lead: Lead,
  clientId: string,
  score: number,
  answers: Record<string, string>,
  status: LeadStatus,
): Promise<Lead> {
  const lastActive = new Date().toISOString();
  const { data, error } = await supabase
    .from("leads")
    .update({
      score,
      answers,
      last_active: lastActive,
      status,
    })
    .eq("id", lead.id)
    .eq("client_id", clientId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update lead");
  }

  return data as Lead;
}

async function processMessage({
  lead,
  channel,
  normalised,
  supabase,
}: ProcessMessageArgs): Promise<void> {
  try {
    const [messages, client, knowledgeBase] = await Promise.all([
      loadRecentMessages(supabase, channel.client_id, lead.id, normalised),
      loadClient(supabase, channel.client_id),
      loadKnowledgeBase(supabase, channel.client_id),
    ]);

    if (!client) {
      return;
    }

    let reply: string | null = null;

    if (!lead.ai_paused) {
      try {
        const generatedReply = await generateReply({
          lead,
          messages,
          client,
          knowledgeBase,
        });

        reply = generatedReply.trim().length > 0 ? generatedReply.trim() : null;
      } catch (error) {
        console.error(`AI reply generation failed: ${getSafeErrorMessage(error)}`);
      }
    }

    if (reply) {
      try {
        await saveOutboundMessage(
          supabase,
          client.id,
          lead.id,
          channel,
          normalised.channel,
          reply,
        );
      } catch (error) {
        console.error(getSafeErrorMessage(error));
      }

      try {
        await sendReply(client.id, channel, normalised, reply);
      } catch (error) {
        console.error(`Channel send failed: ${getSafeErrorMessage(error)}`);
      }
    }

    let updatedLead = lead;

    try {
      const { score, answers } = await scoreLead({
        lead,
        messages,
        client,
      });

      const threshold = getClientConfig(client.config).routing?.assignment_threshold ?? 70;
      const status = getNextLeadStatus(lead, score, threshold);

      updatedLead = await updateLeadScore(
        supabase,
        lead,
        client.id,
        score,
        answers,
        status,
      );
    } catch (error) {
      console.error(`Lead scoring update failed: ${getSafeErrorMessage(error)}`);
    }

    const routingThreshold =
      getClientConfig(client.config).routing?.assignment_threshold ?? 70;
    const latestMessage = normalised.content.text ?? "";

    if (updatedLead.score >= routingThreshold) {
      const routingType = getClientConfig(client.config).routing?.type;

      if ((routingType === "agent_assignment" || routingType === "round_robin") && !updatedLead.assigned_agent_id) {
        try {
          const agent = await assignLead({
            lead: updatedLead,
            client,
            supabase,
          });

          if (agent) {
            await notifyAgent({
              agent,
              lead: updatedLead,
              client,
              latestMessage,
            });
          }
        } catch (error) {
          console.error(`Lead assignment failed: ${getSafeErrorMessage(error)}`);
        }
      }

      if (routingType === "human_handoff") {
        try {
          await notifyClient({
            client,
            lead: updatedLead,
            latestMessage,
          });
        } catch (error) {
          console.error(`Client notification failed: ${getSafeErrorMessage(error)}`);
        }
      }
    }

    try {
      const followUpResult = await scheduleFollowUp({
        leadId: lead.id,
        clientId: client.id,
        message: getFollowUpMessage(updatedLead, normalised),
        delaySeconds: 72 * 60 * 60,
      });

      if (!followUpResult.ok && followUpResult.error) {
        console.error(`Follow-up scheduling failed: ${followUpResult.error}`);
      }
    } catch (error) {
      console.error(`Follow-up scheduling failed: ${getSafeErrorMessage(error)}`);
    }
  } catch (error) {
    console.error(`processMessage failed: ${getSafeErrorMessage(error)}`);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const normalised = parseNormalisedMessage(payload);

    if (!normalised) {
      console.error("Invalid normalised message payload");
      return Response.json({ ok: true });
    }

    const supabase = createServiceRoleClient();
    const { data: channelData, error: channelError } = await supabase
      .from("channels")
      .select("id, client_id, type, account_id, account_name, access_token, status, connected_at")
      .eq("account_id", normalised.to.id)
      .eq("type", normalised.channel)
      .maybeSingle();

    if (channelError) {
      console.error(`Channel lookup failed: ${channelError.message}`);
      return Response.json({ ok: true });
    }

    if (!channelData) {
      console.error(`Channel not found for ${normalised.channel} account ${normalised.to.id}`);
      return Response.json({ ok: true });
    }

    const channel = channelData as Channel;
    const { data: leadData, error: leadError } = await supabase
      .from("leads")
      .upsert(
        {
          client_id: channel.client_id,
          channel_id: channel.id,
          platform_id: normalised.from.id,
          name: normalised.from.name ?? null,
          handle: normalised.from.handle ?? null,
          last_active: normalised.timestamp,
        },
        { onConflict: "client_id,platform_id" },
      )
      .select("*")
      .single();

    if (leadError || !leadData) {
      console.error(`Lead upsert failed: ${leadError?.message ?? "Unknown error"}`);
      return Response.json({ ok: true });
    }

    const lead = leadData as Lead;
    const { error: messageError } = await supabase.from("messages").insert({
      client_id: channel.client_id,
      lead_id: lead.id,
      direction: "inbound",
      channel: normalised.channel,
      content: normalised.content,
      ai_generated: false,
      sent_at: normalised.timestamp,
    });

    if (messageError) {
      console.error(`Inbound message save failed: ${messageError.message}`);
      return Response.json({ ok: true });
    }

    waitUntil(
      processMessage({
        lead,
        channel,
        normalised: {
          ...normalised,
          client_id: channel.client_id,
        },
        supabase,
      }),
    );

    return Response.json({ ok: true });
  } catch (error) {
    console.error(`Message pipeline request failed: ${getSafeErrorMessage(error)}`);
    return Response.json({ ok: true });
  }
}
