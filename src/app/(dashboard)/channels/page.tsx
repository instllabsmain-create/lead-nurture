import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { CopyButton } from "@/components/channels/copy-button";
import { buttonClassNames } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { getActiveClientContext } from "@/lib/active-client";
import { ensureWebsiteChannel } from "@/lib/website-widget";
import type { Channel, Platform } from "@/types";

type ChannelRow = Pick<
  Channel,
  | "id"
  | "type"
  | "account_id"
  | "account_name"
  | "status"
  | "connected_at"
>;

const whatsappChannelSchema = z.object({
  phoneNumberId: z.string().trim().min(1),
  accountName: z.string().trim().optional(),
  accessToken: z.string().trim().min(1),
});

const disconnectSchema = z.object({
  channelId: z.uuid(),
});

const channelStyles: Record<Platform, string> = {
  instagram: "bg-[#F0E8F5] text-[#7B2D8B]",
  whatsapp: "bg-[#E8F5EE] text-[#1A7A44]",
  facebook: "bg-[#E8F0F8] text-[#1557A0]",
  website: "bg-parchment text-dust",
};

function getInputClassName(): string {
  return "w-full rounded-md border border-border bg-parchment px-3.5 py-2.5 font-body text-sm text-pitch outline-none transition-all placeholder:text-dust focus:border-saffron focus:ring-2 focus:ring-saffron/20";
}

function parseNullableString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusClassName(status: Channel["status"] | "ready"): string {
  if (status === "active") {
    return "bg-ember text-ember-text";
  }

  if (status === "expired") {
    return "bg-saffron text-white";
  }

  return "bg-parchment text-dust";
}

function getStatusLabel(status: Channel["status"] | "ready"): string {
  if (status === "ready") {
    return "ready";
  }

  return status;
}

async function loadClientContext(): Promise<{
  supabase: Awaited<ReturnType<typeof getActiveClientContext>>["supabase"];
  clientId: string;
}> {
  const { supabase, client } = await getActiveClientContext();

  return {
    supabase,
    clientId: client.id,
  };
}

async function saveWhatsAppChannelAction(formData: FormData) {
  "use server";

  const payload = whatsappChannelSchema.safeParse({
    phoneNumberId: formData.get("phone_number_id"),
    accountName: formData.get("account_name"),
    accessToken: formData.get("access_token"),
  });

  if (!payload.success) {
    return;
  }

  const { supabase, clientId } = await loadClientContext();
  const { data: existingData, error: existingError } = await supabase
    .from("channels")
    .select("id")
    .eq("client_id", clientId)
    .eq("type", "whatsapp")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load WhatsApp channel: ${existingError.message}`);
  }

  const channelPayload = {
    client_id: clientId,
    type: "whatsapp" as const,
    account_id: payload.data.phoneNumberId,
    account_name: parseNullableString(payload.data.accountName),
    access_token: payload.data.accessToken,
    status: "active" as const,
    connected_at: new Date().toISOString(),
  };

  const result = existingData
    ? await supabase
        .from("channels")
        .update(channelPayload)
        .eq("id", existingData.id)
        .eq("client_id", clientId)
    : await supabase.from("channels").insert(channelPayload);

  if (result.error) {
    throw new Error(`Failed to save WhatsApp channel: ${result.error.message}`);
  }

  revalidatePath("/channels");
}

async function disconnectChannelAction(formData: FormData) {
  "use server";

  const payload = disconnectSchema.safeParse({
    channelId: formData.get("channel_id"),
  });

  if (!payload.success) {
    return;
  }

  const { supabase, clientId } = await loadClientContext();
  const { error } = await supabase
    .from("channels")
    .update({
      status: "disconnected",
    })
    .eq("id", payload.data.channelId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to disconnect channel: ${error.message}`);
  }

  revalidatePath("/channels");
}

function buildChannelMap(channels: ChannelRow[]): Map<Platform, ChannelRow> {
  const channelMap = new Map<Platform, ChannelRow>();

  for (const channel of channels) {
    if (!channelMap.has(channel.type)) {
      channelMap.set(channel.type, channel);
    }
  }

  return channelMap;
}

function renderConnectionBadge(status: Channel["status"] | "ready") {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${getStatusClassName(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

export default async function ChannelsPage() {
  const { supabase, clientId } = await loadClientContext();
  await ensureWebsiteChannel(supabase, clientId);
  const { data } = await supabase
    .from("channels")
    .select("id, type, account_id, account_name, status, connected_at")
    .eq("client_id", clientId)
    .order("connected_at", { ascending: false });

  const channels = (data ?? []) as ChannelRow[];
  const channelMap = buildChannelMap(channels);

  const instagramChannel = channelMap.get("instagram") ?? null;
  const facebookChannel = channelMap.get("facebook") ?? null;
  const whatsappChannel = channelMap.get("whatsapp") ?? null;
  const websiteChannel = channelMap.get("website") ?? null;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto")
    ?? (host?.includes("localhost") ? "http" : "https");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || (host ? `${protocol}://${host}` : "");
  const normalisedAppUrl = appUrl.replace(/\/$/, "");
  const webhookUrl = normalisedAppUrl
    ? `${normalisedAppUrl}/api/webhook/whatsapp`
    : "Set NEXT_PUBLIC_APP_URL to generate webhook URL";
  const verifyTokenDisplay = process.env.META_VERIFY_TOKEN?.trim()
    ? "Configured in environment"
    : "Set META_VERIFY_TOKEN in environment";
  const embedCode = normalisedAppUrl
    ? `<script src="${normalisedAppUrl}/widget.js" data-client="${clientId}" defer></script>`
    : "Set NEXT_PUBLIC_APP_URL to generate widget embed code";

  return (
    <div className="flex flex-col gap-6 p-8 sm:p-10">
      <div className="flex flex-col gap-4">
        <SectionLabel>Channels</SectionLabel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-black uppercase text-pitch">
              Connect Your Lead Sources.
            </h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-dust">
              Connect Meta channels, save your WhatsApp webhook settings, and
              embed the website widget so leads flow into the inbox.
            </p>
          </div>

          <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
            {channels.filter((channel) => channel.status === "active").length} active
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionLabel>Instagram</SectionLabel>
                <div className="mt-3 flex items-center gap-2">
                  <h2 className="font-display text-3xl font-black uppercase text-pitch">
                    Instagram
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${channelStyles.instagram}`}
                  >
                    instagram
                  </span>
                </div>
              </div>
              {renderConnectionBadge(instagramChannel?.status ?? "ready")}
            </div>

            <p className="mt-4 font-body text-sm leading-6 text-dust">
              Meta OAuth will connect Instagram DMs and subscribe your account to
              message webhooks.
            </p>

            {instagramChannel?.status === "active" ? (
              <div className="mt-5 space-y-3">
                <div className="font-body text-sm text-pitch">
                  {instagramChannel.account_name?.trim() || "Instagram account connected"}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                  Connected {formatDate(instagramChannel.connected_at)}
                </div>
                <form action={disconnectChannelAction}>
                  <input type="hidden" name="channel_id" value={instagramChannel.id} />
                  <button type="submit" className={buttonClassNames.ghost}>
                    Disconnect
                  </button>
                </form>
              </div>
            ) : (
              <div className="mt-5">
                <button type="button" disabled className={buttonClassNames.secondary}>
                  Meta OAuth coming soon
                </button>
                <div className="mt-2 font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                  Manual Meta setup is not enabled in this build
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionLabel>Facebook</SectionLabel>
                <div className="mt-3 flex items-center gap-2">
                  <h2 className="font-display text-3xl font-black uppercase text-pitch">
                    Facebook
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${channelStyles.facebook}`}
                  >
                    facebook
                  </span>
                </div>
              </div>
              {renderConnectionBadge(facebookChannel?.status ?? "ready")}
            </div>

            <p className="mt-4 font-body text-sm leading-6 text-dust">
              Meta OAuth will connect Facebook Page messages and subscribe your
              page to webhook events.
            </p>

            {facebookChannel?.status === "active" ? (
              <div className="mt-5 space-y-3">
                <div className="font-body text-sm text-pitch">
                  {facebookChannel.account_name?.trim() || "Facebook page connected"}
                </div>
                <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                  Connected {formatDate(facebookChannel.connected_at)}
                </div>
                <form action={disconnectChannelAction}>
                  <input type="hidden" name="channel_id" value={facebookChannel.id} />
                  <button type="submit" className={buttonClassNames.ghost}>
                    Disconnect
                  </button>
                </form>
              </div>
            ) : (
              <div className="mt-5">
                <button type="button" disabled className={buttonClassNames.secondary}>
                  Meta OAuth coming soon
                </button>
                <div className="mt-2 font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                  Manual Meta setup is not enabled in this build
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionLabel>WhatsApp</SectionLabel>
                <div className="mt-3 flex items-center gap-2">
                  <h2 className="font-display text-3xl font-black uppercase text-pitch">
                    WhatsApp
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${channelStyles.whatsapp}`}
                  >
                    whatsapp
                  </span>
                </div>
              </div>
              {renderConnectionBadge(whatsappChannel?.status ?? "ready")}
            </div>

            <div className="mt-5 grid gap-4 rounded-xl border border-border bg-parchment p-4">
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                  Webhook URL
                </div>
                <code className="mt-1 block break-all font-mono text-xs text-pitch">
                  {webhookUrl}
                </code>
              </div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                  Verify token
                </div>
                <code className="mt-1 block break-all font-mono text-xs text-pitch">
                  {verifyTokenDisplay}
                </code>
              </div>
            </div>

            <form action={saveWhatsAppChannelAction} className="mt-5 space-y-4">
              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="phone-number-id"
                >
                  Phone number ID
                </label>
                <input
                  id="phone-number-id"
                  name="phone_number_id"
                  type="text"
                  required
                  defaultValue={whatsappChannel?.account_id ?? ""}
                  className={getInputClassName()}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="whatsapp-account-name"
                >
                  Account name
                </label>
                <input
                  id="whatsapp-account-name"
                  name="account_name"
                  type="text"
                  defaultValue={whatsappChannel?.account_name ?? ""}
                  className={getInputClassName()}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="whatsapp-access-token"
                >
                  Access token
                </label>
                <input
                  id="whatsapp-access-token"
                  name="access_token"
                  type="password"
                  required
                  placeholder="Paste a fresh token"
                  className={getInputClassName()}
                />
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                  Existing tokens are never displayed
                </div>
              </div>

              <button type="submit" className={buttonClassNames.primary}>
                Save WhatsApp channel
              </button>
            </form>
          </div>
        </Card>

        <Card>
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionLabel>Website</SectionLabel>
                <div className="mt-3 flex items-center gap-2">
                  <h2 className="font-display text-3xl font-black uppercase text-pitch">
                    Website
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${channelStyles.website}`}
                  >
                    website
                  </span>
                </div>
              </div>
              {renderConnectionBadge(
                websiteChannel?.status === "active" ? websiteChannel.status : "ready",
              )}
            </div>

            <p className="mt-4 font-body text-sm leading-6 text-dust">
              Install this snippet on your site to route widget messages into
              the lead inbox for this client.
            </p>

            <div className="mt-5 rounded-xl border border-border bg-parchment p-4">
              <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                Embed code
              </div>
              <code className="mt-2 block break-all font-mono text-xs text-pitch">
                {embedCode}
              </code>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <CopyButton value={embedCode} />
              <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                {websiteChannel?.status === "active"
                  ? "Connected"
                  : "Ready to install"}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
