import { z } from "zod";

import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildWebsiteOptionsResponse,
  withWebsiteCors,
} from "@/lib/website-widget";
import type { Lead, Message } from "@/types";

const widgetMessagesQuerySchema = z.object({
  clientId: z.string().trim().min(1),
  sessionId: z.string().trim().min(1),
});

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const payload = widgetMessagesQuerySchema.safeParse({
      clientId: url.searchParams.get("clientId"),
      sessionId: url.searchParams.get("sessionId"),
    });

    if (!payload.success) {
      return withWebsiteCors(Response.json(
        { ok: false, error: "Invalid widget query" },
        { status: 400 },
      ));
    }

    const supabase = createServiceRoleClient();
    const { data: leadData, error: leadError } = await supabase
      .from("leads")
      .select("id")
      .eq("client_id", payload.data.clientId)
      .eq("platform_id", payload.data.sessionId)
      .maybeSingle();

    if (leadError) {
      throw new Error(`Failed to load widget lead: ${leadError.message}`);
    }

    const lead = (leadData as Pick<Lead, "id"> | null) ?? null;

    if (!lead) {
      return withWebsiteCors(Response.json({ ok: true, messages: [] }));
    }

    const { data: messageData, error: messageError } = await supabase
      .from("messages")
      .select("id, direction, content, sent_at")
      .eq("client_id", payload.data.clientId)
      .eq("lead_id", lead.id)
      .eq("channel", "website")
      .order("sent_at", { ascending: true })
      .limit(100);

    if (messageError) {
      throw new Error(`Failed to load widget messages: ${messageError.message}`);
    }

    const messages = ((messageData ?? []) as Pick<Message, "id" | "direction" | "content" | "sent_at">[])
      .map((message) => ({
        id: message.id,
        direction: message.direction,
        text: message.content.text ?? "",
        sentAt: message.sent_at,
      }))
      .filter((message) => message.text.trim().length > 0);

    return withWebsiteCors(Response.json({ ok: true, messages }));
  } catch (error) {
    console.error(`Failed to load widget messages: ${getSafeErrorMessage(error)}`);

    return withWebsiteCors(Response.json(
      { ok: false, error: "Failed to load widget messages" },
      { status: 500 },
    ));
  }
}

export function OPTIONS() {
  return buildWebsiteOptionsResponse();
}
