import type { SupabaseClient } from "@supabase/supabase-js";

import type { Channel } from "@/types";

const WEBSITE_ACCOUNT_NAME = "Website Chat Widget";

const WEBSITE_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

export function withWebsiteCors(
  response: Response,
): Response {
  const headers = new Headers(response.headers);

  Object.entries(WEBSITE_CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function buildWebsiteOptionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: WEBSITE_CORS_HEADERS,
  });
}

export async function ensureWebsiteChannel(
  supabase: SupabaseClient,
  clientId: string,
): Promise<Channel> {
  const { data: existing, error: lookupError } = await supabase
    .from("channels")
    .select("*")
    .eq("client_id", clientId)
    .eq("type", "website")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to load website channel: ${lookupError.message}`);
  }

  if (existing) {
    const websiteChannel = existing as Channel;

    if (websiteChannel.account_id === clientId && websiteChannel.status === "active") {
      return websiteChannel;
    }

    const { data: updated, error: updateError } = await supabase
      .from("channels")
      .update({
        account_id: clientId,
        account_name: WEBSITE_ACCOUNT_NAME,
        status: "active",
      })
      .eq("id", websiteChannel.id)
      .eq("client_id", clientId)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new Error(updateError?.message ?? "Failed to update website channel");
    }

    return updated as Channel;
  }

  const { data: created, error: createError } = await supabase
    .from("channels")
    .insert({
      client_id: clientId,
      type: "website",
      account_id: clientId,
      account_name: WEBSITE_ACCOUNT_NAME,
      access_token: null,
      status: "active",
      connected_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new Error(createError?.message ?? "Failed to create website channel");
  }

  return created as Channel;
}
