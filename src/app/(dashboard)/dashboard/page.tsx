import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { createClient } from "@/lib/supabase/server";
import type { LeadStatus, MessageContent, Platform } from "@/types";

interface ClientRow {
  id: string;
  name: string;
}

interface RecentLeadRow {
  id: string;
  name: string | null;
  handle: string | null;
  score: number;
  status: LeadStatus;
  last_active: string;
}

interface RecentMessageRow {
  lead_id: string;
  content: MessageContent | null;
  sent_at: string;
  channel: Platform;
}

interface StatCardProps {
  value: number;
  label: string;
  sub: string;
}

interface ScoreBadgeProps {
  score: number;
}

interface StatusBadgeProps {
  status: LeadStatus;
}

interface ChannelBadgeProps {
  channel: Platform;
}

const statusStyles: Record<LeadStatus, string> = {
  new: "bg-parchment text-dust",
  engaging: "bg-ember text-ember-text",
  qualified: "bg-saffron text-white",
  unqualified: "bg-parchment text-dust",
  assigned: "bg-pitch text-parchment",
  closed: "bg-parchment text-dust",
};

const channelStyles: Record<Platform, string> = {
  instagram: "bg-[#F0E8F5] text-[#7B2D8B]",
  whatsapp: "bg-[#E8F5EE] text-[#1A7A44]",
  facebook: "bg-[#E8F0F8] text-[#1557A0]",
  website: "bg-parchment text-dust",
};

function StatCard({ value, label, sub }: StatCardProps) {
  return (
    <div className="rounded-lg bg-parchment p-3">
      <div className="font-display text-3xl font-black leading-none text-pitch">
        {value}
      </div>
      <div className="mt-1 font-mono text-[8px] uppercase tracking-[2px] text-dust">
        {label}
      </div>
      <div className="mt-1 font-body text-[11px] text-saffron">{sub}</div>
    </div>
  );
}

function ScoreBadge({ score }: ScoreBadgeProps) {
  const scoreClassName =
    score > 80
      ? "bg-saffron text-white"
      : score >= 50
        ? "bg-ember text-ember-text"
        : "bg-parchment text-dust";

  return (
    <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${scoreClassName}`}>
      {score}
    </span>
  );
}

function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${statusStyles[status]}`}
    >
      {status}
    </span>
  );
}

function ChannelBadge({ channel }: ChannelBadgeProps) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${channelStyles[channel]}`}
    >
      {channel}
    </span>
  );
}

function getInitials(name: string | null, handle: string | null): string {
  const source = name?.trim() || handle?.trim() || "Lead";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function formatLastActive(value: string): string {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getMessagePreview(content: MessageContent | null): string {
  if (!content) {
    return "No messages yet.";
  }

  const text = content.text?.trim();

  if (text) {
    return text;
  }

  switch (content.type) {
    case "image":
      return "Image shared.";
    case "audio":
      return "Audio shared.";
    default:
      return "Message received.";
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: clientData } = await supabase
    .from("clients")
    .select("id, name")
    .eq("user_id", user.id)
    .maybeSingle();

  const client = clientData as ClientRow | null;

  if (!client) {
    redirect("/onboarding");
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalLeadsResult,
    activeConversationsResult,
    qualifiedTodayResult,
    messagesSentTodayResult,
    recentLeadsResult,
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("status", "engaging"),
    supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("status", "qualified")
      .gte("last_active", startOfToday.toISOString()),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id)
      .eq("direction", "outbound")
      .gte("sent_at", startOfToday.toISOString()),
    supabase
      .from("leads")
      .select("id, name, handle, score, status, last_active")
      .eq("client_id", client.id)
      .order("last_active", { ascending: false })
      .limit(5),
  ]);

  const recentLeads = (recentLeadsResult.data ?? []) as RecentLeadRow[];
  const recentLeadIds = recentLeads.map((lead) => lead.id);

  let recentMessages: RecentMessageRow[] = [];

  if (recentLeadIds.length > 0) {
    const recentMessagesResult = await supabase
      .from("messages")
      .select("lead_id, content, sent_at, channel")
      .eq("client_id", client.id)
      .in("lead_id", recentLeadIds)
      .order("sent_at", { ascending: false });

    recentMessages = (recentMessagesResult.data ?? []) as RecentMessageRow[];
  }

  const latestMessageByLeadId = new Map<string, RecentMessageRow>();

  for (const message of recentMessages) {
    if (!latestMessageByLeadId.has(message.lead_id)) {
      latestMessageByLeadId.set(message.lead_id, message);
    }
  }

  const totalLeads = totalLeadsResult.count ?? 0;
  const activeConversations = activeConversationsResult.count ?? 0;
  const qualifiedToday = qualifiedTodayResult.count ?? 0;
  const messagesSentToday = messagesSentTodayResult.count ?? 0;

  return (
    <div className="flex flex-col gap-8 p-8 sm:p-10">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard value={totalLeads} label="Total leads" sub="All leads in your pipeline" />
        <StatCard
          value={activeConversations}
          label="Active"
          sub="Leads currently engaging"
        />
        <StatCard
          value={qualifiedToday}
          label="Qualified today"
          sub="Qualified since midnight"
        />
        <StatCard
          value={messagesSentToday}
          label="Sent today"
          sub="Outbound messages since midnight"
        />
      </div>

      <div className="space-y-4">
        <SectionLabel>RECENT CONVERSATIONS</SectionLabel>

        <Card>
          {recentLeads.length === 0 ? (
            <div className="py-10 text-center">
              <div className="font-display text-2xl font-bold uppercase text-pitch">
                No leads yet.
              </div>
              <p className="mt-2 font-body text-sm text-dust">
                Conversations will appear here once leads start messaging {client.name}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLeads.map((lead) => {
                const latestMessage = latestMessageByLeadId.get(lead.id);
                const displayName = lead.name?.trim() || lead.handle?.trim() || "Unknown lead";

                return (
                  <Link
                    key={lead.id}
                    href={`/inbox/${lead.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-white p-3 transition-all duration-150 hover:border-saffron"
                  >
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-ember font-mono text-[10px] font-medium text-ember-text">
                      {getInitials(lead.name, lead.handle)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-body text-sm font-medium text-pitch">
                          {displayName}
                        </div>
                        {latestMessage?.channel ? (
                          <ChannelBadge channel={latestMessage.channel} />
                        ) : null}
                        <StatusBadge status={lead.status} />
                      </div>

                      <div className="mt-1 truncate font-body text-xs text-dust">
                        {getMessagePreview(latestMessage?.content ?? null)}
                      </div>

                      <div className="mt-2 font-mono text-[9px] text-dust">
                        {formatLastActive(lead.last_active)}
                      </div>
                    </div>

                    <ScoreBadge score={lead.score} />
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
