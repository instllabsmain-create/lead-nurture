import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cache } from "react";

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

export class ActiveClientAccessError extends Error {
  constructor(message = "This Clerk account is not provisioned for a client workspace.") {
    super(message);
    this.name = "ActiveClientAccessError";
  }
}

interface ClerkIdentity {
  email: string;
  name: string;
  userId: string;
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

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getAuthorizedClerkEmails(): string[] {
  const configured = process.env.AUTHORIZED_CLERK_EMAILS
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    ?? [];

  return Array.from(
    new Set(
      [
        getDefaultClientEmail(),
        process.env.DEMO_CLIENT_EMAIL?.trim(),
        ...configured,
      ]
        .filter((value): value is string => Boolean(value))
        .map(normaliseEmail),
    ),
  );
}

function isLocalDevelopmentProvisioningEnabled(): boolean {
  return process.env.NODE_ENV !== "production"
    && process.env.DISABLE_DEV_CLIENT_PROVISIONING !== "true";
}

function isSharedDemoWorkspaceAccessEnabled(): boolean {
  return process.env.ALLOW_SHARED_DEMO_WORKSPACE_ACCESS === "true";
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

function getPrimaryEmail(
  user: Awaited<ReturnType<typeof currentUser>>,
): string | null {
  if (!user) {
    return null;
  }

  return (
    user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)?.emailAddress
    ?? user.emailAddresses[0]?.emailAddress
    ?? null
  );
}

function getDisplayName(
  user: Awaited<ReturnType<typeof currentUser>>,
  email: string,
): string {
  if (!user) {
    return email;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();

  return fullName || user.username || email;
}

async function getClerkIdentity(): Promise<ClerkIdentity> {
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  const user = await currentUser();
  const email = getPrimaryEmail(user);

  if (!email) {
    throw new Error("Clerk user is missing an email address");
  }

  return {
    email,
    name: getDisplayName(user, email),
    userId,
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

async function loadClientByClerkUserId(
  supabase: SupabaseClient,
  clerkUserId: string,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Clerk-linked client: ${error.message}`);
  }

  return (data as Client | null) ?? null;
}

async function loadClientByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .ilike("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load client by email: ${error.message}`);
  }

  return (data as Client | null) ?? null;
}

async function attachClerkUserId(
  supabase: SupabaseClient,
  client: Client,
  clerkUserId: string,
): Promise<Client> {
  if (client.clerk_user_id === clerkUserId) {
    return client;
  }

  const { data, error } = await supabase
    .from("clients")
    .update({
      clerk_user_id: clerkUserId,
    })
    .eq("id", client.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to attach Clerk user to client");
  }

  return data as Client;
}

async function createDefaultClient(
  supabase: SupabaseClient,
  clientId: string,
  identity: ClerkIdentity,
): Promise<Client> {
  const name = identity.name.trim() || getDefaultClientName();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      id: clientId,
      clerk_user_id: identity.userId,
      name,
      email: identity.email.trim() || getDefaultClientEmail(),
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

function canProvisionConfiguredClient(identity: ClerkIdentity, client: Client): boolean {
  const email = normaliseEmail(identity.email);

  return (
    normaliseEmail(client.email) === email
    || getAuthorizedClerkEmails().includes(email)
  );
}

async function resolveActiveClientContext(): Promise<ActiveClientContext> {
  const identity = await getClerkIdentity();
  const supabase = createServiceRoleClient();
  const configuredClientId = getConfiguredClientId();
  const normalizedIdentityEmail = normaliseEmail(identity.email);

  const clerkLinkedClient = await loadClientByClerkUserId(supabase, identity.userId);

  if (clerkLinkedClient) {
    return {
      supabase,
      client: clerkLinkedClient,
    };
  }

  const emailMatchedClient = await loadClientByEmail(supabase, identity.email);

  if (emailMatchedClient) {
    return {
      supabase,
      client: await attachClerkUserId(supabase, emailMatchedClient, identity.userId),
    };
  }

  const configuredClient = await loadClientById(supabase, configuredClientId);

  if (configuredClient && canProvisionConfiguredClient(identity, configuredClient)) {
    return {
      supabase,
      client: await attachClerkUserId(supabase, configuredClient, identity.userId),
    };
  }

  if (configuredClient && getAuthorizedClerkEmails().includes(normaliseEmail(identity.email))) {
    return {
      supabase,
      client: await attachClerkUserId(supabase, configuredClient, identity.userId),
    };
  }

  if (configuredClient && isSharedDemoWorkspaceAccessEnabled()) {
    return {
      supabase,
      client: configuredClient,
    };
  }

  if (configuredClient && isLocalDevelopmentProvisioningEnabled()) {
    return {
      supabase,
      client: await attachClerkUserId(supabase, configuredClient, identity.userId),
    };
  }

  if (!getAuthorizedClerkEmails().includes(normalizedIdentityEmail)) {
    throw new ActiveClientAccessError();
  }

  return {
    supabase,
    client: await createDefaultClient(supabase, configuredClientId, identity),
  };
}

export const getActiveClientContext = cache(resolveActiveClientContext);
