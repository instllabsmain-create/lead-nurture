import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DEFAULT_CONFIG } from "@/lib/config";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Client, ClientConfig } from "@/types";

const FALLBACK_CLIENT_ID = "11111111-1111-1111-1111-111111111111";
const FALLBACK_CLIENT_NAME = "INSTL.LABS";
const FALLBACK_CLIENT_EMAIL = "hello@instl.labs";

export interface ActiveClientContext {
  supabase: SupabaseClient;
  client: Client;
}

function getConfiguredClientId(): string {
  return (
    process.env.APP_CLIENT_ID?.trim()
    || process.env.DEMO_CLIENT_ID?.trim()
    || FALLBACK_CLIENT_ID
  );
}

function getDefaultClientName(): string {
  return process.env.APP_CLIENT_NAME?.trim() || FALLBACK_CLIENT_NAME;
}

function getDefaultClientEmail(): string {
  return process.env.APP_CLIENT_EMAIL?.trim() || FALLBACK_CLIENT_EMAIL;
}

function buildDefaultClientConfig(name: string): ClientConfig {
  return {
    business_name: name,
    business_description: "",
    business_type: [],
    ideal_customer: "",
    customer_sources: [],
    qualification_questions: [...DEFAULT_CONFIG.qualification_questions],
    scoring: { ...DEFAULT_CONFIG.scoring },
    routing: { ...DEFAULT_CONFIG.routing },
    ai: { ...DEFAULT_CONFIG.ai },
    disabled_features: [...DEFAULT_CONFIG.disabled_features],
    team: { mode: "just_me" },
  };
}

async function loadClientById(
  supabase: SupabaseClient,
  clientId: string,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load configured client: ${error.message}`);
  }

  return (data as Client | null) ?? null;
}

async function loadFirstClient(
  supabase: SupabaseClient,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load active client: ${error.message}`);
  }

  return (data as Client | null) ?? null;
}

async function createDefaultClient(
  supabase: SupabaseClient,
  clientId: string,
): Promise<Client> {
  const name = getDefaultClientName();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      id: clientId,
      name,
      email: getDefaultClientEmail(),
      plan: "starter",
      onboarding_completed: true,
      config: buildDefaultClientConfig(name),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create default client");
  }

  return data as Client;
}

export async function getActiveClientContext(): Promise<ActiveClientContext> {
  const supabase = createServiceRoleClient();
  const configuredClientId = getConfiguredClientId();

  const configuredClient = await loadClientById(supabase, configuredClientId);

  if (configuredClient) {
    return {
      supabase,
      client: configuredClient,
    };
  }

  const firstClient = await loadFirstClient(supabase);

  if (firstClient) {
    return {
      supabase,
      client: firstClient,
    };
  }

  return {
    supabase,
    client: await createDefaultClient(supabase, configuredClientId),
  };
}
