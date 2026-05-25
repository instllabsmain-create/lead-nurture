import { waitUntil } from "@vercel/functions";
import { z } from "zod";

import { normaliseWebsite } from "@/lib/normalise";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  buildWebsiteOptionsResponse,
  ensureWebsiteChannel,
  withWebsiteCors,
} from "@/lib/website-widget";

const websiteWebhookSchema = z.object({
  session_id: z.string().trim().min(1),
  client_id: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  message: z.string().trim().min(1),
});

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

async function clientExists(clientId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Client lookup failed: ${error.message}`);
  }

  return Boolean(data);
}

function forwardToMessageRoute(request: Request, payload: unknown): Promise<void> {
  const messageUrl = new URL("/api/message", request.url);

  return fetch(messageUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then((response) => {
    if (!response.ok) {
      console.error(`Forwarding website webhook failed: ${response.status}`);
    }
  });
}

export async function POST(request: Request) {
  try {
    const json = (await request.json()) as unknown;
    const payload = websiteWebhookSchema.safeParse(json);

    if (!payload.success) {
      return Response.json(
        {
          ok: false,
          error: "Invalid website webhook payload",
        },
        { status: 400 },
      );
    }

    const exists = await clientExists(payload.data.client_id);

    if (!exists) {
      return withWebsiteCors(Response.json(
        {
          ok: false,
          error: "Unknown client_id",
        },
        { status: 404 },
      ));
    }

    const supabase = createServiceRoleClient();
    await ensureWebsiteChannel(supabase, payload.data.client_id);

    const normalised = normaliseWebsite(payload.data, payload.data.client_id);

    waitUntil(
      forwardToMessageRoute(request, normalised).catch((error: unknown) => {
        console.error(
          `Failed to forward website webhook: ${getSafeErrorMessage(error)}`,
        );
      }),
    );

    return withWebsiteCors(Response.json({ ok: true }));
  } catch (error) {
    console.error(
      `Failed to process website webhook: ${getSafeErrorMessage(error)}`,
    );

    return withWebsiteCors(Response.json(
      {
        ok: false,
        error: "Invalid request body",
      },
      { status: 400 },
    ));
  }
}

export function OPTIONS() {
  return buildWebsiteOptionsResponse();
}
