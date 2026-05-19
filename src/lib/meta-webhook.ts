import "server-only";

import { waitUntil } from "@vercel/functions";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import type { NormalisedMessage, Platform } from "@/types";

type MetaPlatform = Extract<Platform, "instagram" | "whatsapp" | "facebook">;

interface HandleMetaWebhookArgs {
  request: Request;
  platform: MetaPlatform;
  normalise: (payload: unknown) => NormalisedMessage[];
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

function getRequiredEnv(name: "META_VERIFY_TOKEN" | "META_APP_SECRET"): string | null {
  const value = process.env[name];

  if (!value || value.trim().length === 0) {
    return null;
  }

  return value;
}

function verifyMetaSignature(body: string, signature: string | null): boolean {
  const appSecret = getRequiredEnv("META_APP_SECRET");

  if (!appSecret || !signature) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", appSecret).update(body).digest("hex")}`;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

async function findChannelClientId(
  accountId: string,
  platform: MetaPlatform,
): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data: channel, error } = await supabase
    .from("channels")
    .select("client_id")
    .eq("account_id", accountId)
    .eq("type", platform)
    .maybeSingle();

  if (error) {
    throw new Error(`Channel lookup failed: ${error.message}`);
  }

  return channel?.client_id ?? null;
}

function forwardToMessageRoute(request: Request, normalised: NormalisedMessage): Promise<void> {
  const messageUrl = new URL("/api/message", request.url);

  return fetch(messageUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalised),
  }).then((response) => {
    if (!response.ok) {
      console.error(`Forwarding ${normalised.channel} webhook failed: ${response.status}`);
    }
  });
}

export function handleMetaVerification(request: NextRequest): Response {
  const verifyToken = getRequiredEnv("META_VERIFY_TOKEN");
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (
    mode === "subscribe"
    && challenge !== null
    && verifyToken !== null
    && token === verifyToken
  ) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function handleMetaWebhook({
  request,
  platform,
  normalise,
}: HandleMetaWebhookArgs): Promise<Response> {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const payload = JSON.parse(rawBody) as unknown;
    const normalisedMessages = normalise(payload);

    if (normalisedMessages.length === 0) {
      return Response.json({ ok: true });
    }

    waitUntil(
      Promise.all(
        normalisedMessages.map(async (normalised) => {
          try {
            const clientId = await findChannelClientId(normalised.to.id, platform);

            if (!clientId) {
              console.error(`Channel not found for ${platform} account ${normalised.to.id}`);
              return;
            }

            await forwardToMessageRoute(request, { ...normalised, client_id: clientId });
          } catch (error) {
            console.error(`Failed to forward ${platform} message: ${getSafeErrorMessage(error)}`);
          }
        }),
      ),
    );

    return Response.json({ ok: true });
  } catch (error) {
    console.error(
      `Failed to process ${platform} webhook: ${getSafeErrorMessage(error)}`,
    );
    return Response.json({ ok: true });
  }
}
