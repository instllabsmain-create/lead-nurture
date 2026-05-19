import "server-only";

import { Resend } from "resend";

import { getClientConfig } from "@/lib/config";
import { sendWhatsAppMessage } from "@/lib/channels/whatsapp";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Agent, Client, Lead } from "@/types";

interface NotifyAgentArgs {
  agent: Agent;
  lead: Lead;
  client: Client;
  latestMessage: string;
}

interface NotifyClientArgs {
  client: Client;
  lead: Lead;
  latestMessage: string;
}

interface WhatsAppChannelRow {
  account_id: string | null;
  access_token: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

function getLeadDisplayName(lead: Lead): string {
  return lead.name?.trim() || lead.handle?.trim() || "Unknown";
}

function getConversationUrl(leadId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!appUrl) {
    return `/inbox/${leadId}`;
  }

  return `${appUrl.replace(/\/$/, "")}/inbox/${leadId}`;
}

function getClientPhone(client: Client): string | null {
  if (isRecord(client.config) && typeof client.config.phone === "string") {
    const phone = client.config.phone.trim();
    return phone.length > 0 ? phone : null;
  }

  return null;
}

function formatAnswers(answers: Record<string, string>): string {
  const lines = Object.entries(answers)
    .filter(([, answer]) => answer.trim().length > 0)
    .map(([question, answer]) => `- ${question}: ${answer}`);

  return lines.join("\n");
}

async function getClientWhatsAppChannel(
  clientId: string,
): Promise<WhatsAppChannelRow | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("channels")
    .select("account_id, access_token")
    .eq("client_id", clientId)
    .eq("type", "whatsapp")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load WhatsApp channel: ${error.message}`);
  }

  return (data as WhatsAppChannelRow | null) ?? null;
}

async function getLeadChannelLabel(clientId: string, lead: Lead): Promise<string> {
  if (!lead.channel_id) {
    return "unknown";
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("channels")
    .select("type")
    .eq("id", lead.channel_id)
    .eq("client_id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load lead channel: ${error.message}`);
  }

  return typeof data?.type === "string" ? data.type : "unknown";
}

function getEmailClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY");
  }

  return new Resend(apiKey);
}

async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  const resend = getEmailClient();
  const response = await resend.emails.send({
    from: "INSTL.LABS <onboarding@resend.dev>",
    to,
    subject,
    text,
  });

  if (response.error) {
    throw new Error(
      `Resend error (${response.error.statusCode ?? "unknown"}): ${response.error.message}`,
    );
  }
}

async function tryNotifyByEmail({
  to,
  subject,
  text,
  logLabel,
}: {
  to: string | null;
  subject: string;
  text: string;
  logLabel: string;
}): Promise<boolean> {
  if (!to) {
    return false;
  }

  try {
    await sendEmail({ to, subject, text });
    return true;
  } catch (error) {
    console.error(`${logLabel} email failed: ${getSafeErrorMessage(error)}`);
    return false;
  }
}

export async function notifyAgent({
  agent,
  lead,
  client,
  latestMessage,
}: NotifyAgentArgs): Promise<void> {
  try {
    const channelLabel = await getLeadChannelLabel(client.id, lead);
    const answersText = formatAnswers(lead.answers);
    const text = [
      "New lead assigned to you",
      "",
      `Name: ${getLeadDisplayName(lead)}`,
      `Score: ${lead.score}/100`,
      `Channel: ${channelLabel}`,
      `Last message: "${latestMessage}"`,
      "",
      answersText ? `Answers collected:\n${answersText}\n` : "",
      "View conversation:",
      getConversationUrl(lead.id),
    ]
      .filter((line) => line.length > 0)
      .join("\n");

    if (agent.phone) {
      try {
        const channel = await getClientWhatsAppChannel(client.id);

        if (channel?.account_id && channel.access_token) {
          await sendWhatsAppMessage({
            to: agent.phone,
            message: text,
            phoneNumberId: channel.account_id,
            accessToken: channel.access_token,
          });
          return;
        }
      } catch (error) {
        console.error(`notifyAgent WhatsApp failed: ${getSafeErrorMessage(error)}`);
      }
    }

    await tryNotifyByEmail({
      to: agent.email,
      subject: `New lead assigned: ${getLeadDisplayName(lead)}`,
      text,
      logLabel: "notifyAgent",
    });
  } catch (error) {
    console.error(`notifyAgent failed: ${getSafeErrorMessage(error)}`);
  }
}

export async function notifyClient({
  client,
  lead,
  latestMessage,
}: NotifyClientArgs): Promise<void> {
  try {
    const config = getClientConfig(client.config);
    const notifyVia = config.routing?.notify_via ?? ["whatsapp"];
    const prefersWhatsApp = notifyVia.includes("whatsapp");
    const prefersEmail = notifyVia.includes("email");
    const channelLabel = await getLeadChannelLabel(client.id, lead);
    const text = [
      "Hot lead ready for you",
      "",
      `Name: ${getLeadDisplayName(lead)}`,
      `Score: ${lead.score}/100`,
      `Channel: ${channelLabel}`,
      "",
      `They said: "${latestMessage}"`,
      "",
      "Pick up the conversation:",
      getConversationUrl(lead.id),
    ].join("\n");

    let whatsappSent = false;

    if (prefersWhatsApp) {
      const clientPhone = getClientPhone(client);

      if (clientPhone) {
        try {
          const channel = await getClientWhatsAppChannel(client.id);

          if (channel?.account_id && channel.access_token) {
            await sendWhatsAppMessage({
              to: clientPhone,
              message: text,
              phoneNumberId: channel.account_id,
              accessToken: channel.access_token,
            });
            whatsappSent = true;
          }
        } catch (error) {
          console.error(`notifyClient WhatsApp failed: ${getSafeErrorMessage(error)}`);
        }
      }
    }

    if (!whatsappSent || prefersEmail) {
      await tryNotifyByEmail({
        to: client.email,
        subject: `Hot lead: ${getLeadDisplayName(lead)}`,
        text,
        logLabel: "notifyClient",
      });
    }
  } catch (error) {
    console.error(`notifyClient failed: ${getSafeErrorMessage(error)}`);
  }
}
