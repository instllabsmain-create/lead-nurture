import "server-only";

import { Client as QStash } from "@upstash/qstash";

import { createServiceRoleClient } from "@/lib/supabase/server";

interface ScheduleFollowUpArgs {
  leadId: string;
  clientId: string;
  message: string;
  delaySeconds: number;
}

export interface ScheduleFollowUpResult {
  ok: boolean;
  followUpId: string | null;
  qstashMessageId: string | null;
  error: string | null;
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function getRequiredStringEnv(
  name: "NEXT_PUBLIC_APP_URL" | "QSTASH_TOKEN",
): string | null {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

function getQStashClient(): QStash | null {
  const token = getRequiredStringEnv("QSTASH_TOKEN");

  if (!token) {
    return null;
  }

  return new QStash({ token });
}

function getScheduledAt(delaySeconds: number): string {
  return new Date(Date.now() + delaySeconds * 1000).toISOString();
}

function getValidationError(args: ScheduleFollowUpArgs): string | null {
  if (!args.leadId.trim()) {
    return "Missing leadId";
  }

  if (!args.clientId.trim()) {
    return "Missing clientId";
  }

  if (!args.message.trim()) {
    return "Missing message";
  }

  if (!Number.isFinite(args.delaySeconds) || args.delaySeconds < 0) {
    return "Invalid delaySeconds";
  }

  return null;
}

export async function scheduleFollowUp(
  args: ScheduleFollowUpArgs,
): Promise<ScheduleFollowUpResult> {
  const validationError = getValidationError(args);

  if (validationError) {
    return {
      ok: false,
      followUpId: null,
      qstashMessageId: null,
      error: validationError,
    };
  }

  const appUrl = getRequiredStringEnv("NEXT_PUBLIC_APP_URL");

  if (!appUrl) {
    return {
      ok: false,
      followUpId: null,
      qstashMessageId: null,
      error: "Missing required environment variable: NEXT_PUBLIC_APP_URL",
    };
  }

  const qstash = getQStashClient();

  if (!qstash) {
    return {
      ok: false,
      followUpId: null,
      qstashMessageId: null,
      error: "Missing required environment variable: QSTASH_TOKEN",
    };
  }

  try {
    const supabase = createServiceRoleClient();
    const scheduledAt = getScheduledAt(args.delaySeconds);

    const { data: followUp, error: insertError } = await supabase
      .from("follow_ups")
      .insert({
        client_id: args.clientId,
        lead_id: args.leadId,
        message: args.message,
        scheduled_at: scheduledAt,
      })
      .select("id")
      .single();

    if (insertError || !followUp) {
      return {
        ok: false,
        followUpId: null,
        qstashMessageId: null,
        error: insertError?.message ?? "Failed to create follow-up row",
      };
    }

    const publishResult = await qstash.publishJSON({
      url: `${appUrl}/api/followup`,
      delay: args.delaySeconds,
      deduplicationId: followUp.id,
      body: {
        leadId: args.leadId,
        clientId: args.clientId,
        message: args.message,
        followUpId: followUp.id,
      },
    });

    return {
      ok: true,
      followUpId: followUp.id,
      qstashMessageId: publishResult.messageId,
      error: null,
    };
  } catch (error) {
    const message = getSafeErrorMessage(error);

    console.error(`Failed to schedule follow-up: ${message}`);

    return {
      ok: false,
      followUpId: null,
      qstashMessageId: null,
      error: message,
    };
  }
}
