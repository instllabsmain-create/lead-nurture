"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { createClient } from "@/lib/supabase/client";
import type {
  Lead,
  LeadStatus,
  Message,
  MessageContent,
  MessageDirection,
  Platform,
} from "@/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlatform(value: unknown): value is Platform {
  return (
    value === "instagram"
    || value === "whatsapp"
    || value === "facebook"
    || value === "website"
  );
}

function isMessageDirection(value: unknown): value is MessageDirection {
  return value === "inbound" || value === "outbound";
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return (
    value === "new"
    || value === "engaging"
    || value === "qualified"
    || value === "unqualified"
    || value === "assigned"
    || value === "closed"
  );
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      result[key] = entry;
    }
  }

  return result;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function parseMessageContent(value: unknown): MessageContent | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.type !== "text"
    && value.type !== "image"
    && value.type !== "audio"
  ) {
    return null;
  }

  return {
    type: value.type,
    text: typeof value.text === "string" ? value.text : undefined,
    url: typeof value.url === "string" ? value.url : undefined,
  };
}

function parseRealtimeMessage(value: unknown): Message | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string"
    || typeof value.client_id !== "string"
    || typeof value.lead_id !== "string"
    || !isMessageDirection(value.direction)
    || !isPlatform(value.channel)
    || typeof value.ai_generated !== "boolean"
    || typeof value.sent_at !== "string"
  ) {
    return null;
  }

  const content = parseMessageContent(value.content);

  if (!content) {
    return null;
  }

  return {
    id: value.id,
    client_id: value.client_id,
    lead_id: value.lead_id,
    direction: value.direction,
    channel: value.channel,
    content,
    ai_generated: value.ai_generated,
    sent_at: value.sent_at,
  };
}

function parseRealtimeLead(value: unknown): Lead | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string"
    || typeof value.client_id !== "string"
    || typeof value.platform_id !== "string"
    || typeof value.score !== "number"
    || !isLeadStatus(value.status)
    || typeof value.first_seen !== "string"
    || typeof value.last_active !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    client_id: value.client_id,
    channel_id: asNullableString(value.channel_id),
    platform_id: value.platform_id,
    name: asNullableString(value.name),
    handle: asNullableString(value.handle),
    avatar: asNullableString(value.avatar),
    phone: asNullableString(value.phone),
    email: asNullableString(value.email),
    score: value.score,
    status: value.status,
    answers: asStringRecord(value.answers),
    tags: asStringArray(value.tags),
    assigned_agent_id: asNullableString(value.assigned_agent_id),
    assigned_at: asNullableString(value.assigned_at),
    first_seen: value.first_seen,
    last_active: value.last_active,
  };
}

export function useRealtimeMessages(
  clientId: string | null | undefined,
  onNewMessage: (message: Message) => void,
): void {
  const [supabase] = useState(() => createClient());
  const handleNewMessage = useEffectEvent((payload: unknown) => {
    const message = parseRealtimeMessage(payload);

    if (!message || message.client_id !== clientId) {
      return;
    }

    onNewMessage(message);
  });

  useEffect(() => {
    if (!clientId) {
      return;
    }

    const channel = supabase
      .channel(`messages:${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          handleNewMessage(payload.new);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, supabase]);
}

export function useRealtimeLeads(
  clientId: string | null | undefined,
  onLeadUpdate: (lead: Lead) => void,
): void {
  const [supabase] = useState(() => createClient());
  const handleLeadUpdate = useEffectEvent((payload: unknown) => {
    const lead = parseRealtimeLead(payload);

    if (!lead || lead.client_id !== clientId) {
      return;
    }

    onLeadUpdate(lead);
  });

  useEffect(() => {
    if (!clientId) {
      return;
    }

    const channel = supabase
      .channel(`leads:${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leads",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          handleLeadUpdate(payload.new);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, supabase]);
}
