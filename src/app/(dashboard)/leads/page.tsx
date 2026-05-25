import Link from "next/link";

import { LeadCard } from "@/components/leads/lead-card";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { getActiveClientContext } from "@/lib/active-client";
import type { LeadStatus, MessageContent, Platform } from "@/types";

type StatusFilter = LeadStatus | "all";
type ScoreBandFilter = "all" | "cold" | "warm" | "hot";
type AssignmentFilter = "all" | "assigned" | "unassigned";

interface LeadsPageProps {
  searchParams: Promise<{
    status?: string;
    score?: string;
    assignment?: string;
  }>;
}

interface LeadRow {
  id: string;
  name: string | null;
  handle: string | null;
  score: number;
  status: LeadStatus;
  last_active: string;
  assigned_agent_id: string | null;
  channel_id: string | null;
}

interface MessageRow {
  lead_id: string;
  content: MessageContent;
}

interface AgentRow {
  id: string;
  name: string;
}

interface ChannelRow {
  id: string;
  type: Platform;
}

const statusOptions: StatusFilter[] = [
  "all",
  "new",
  "engaging",
  "qualified",
  "assigned",
  "closed",
  "unqualified",
];

const scoreOptions: ScoreBandFilter[] = ["all", "cold", "warm", "hot"];
const assignmentOptions: AssignmentFilter[] = ["all", "assigned", "unassigned"];
const LEADS_PAGE_LIMIT = 100;
const RECENT_MESSAGES_PER_LEAD = 4;
const MIN_RECENT_MESSAGES = 80;

function parseStatusFilter(value: string | undefined): StatusFilter {
  return statusOptions.includes(value as StatusFilter) ? (value as StatusFilter) : "all";
}

function parseScoreBandFilter(value: string | undefined): ScoreBandFilter {
  return scoreOptions.includes(value as ScoreBandFilter)
    ? (value as ScoreBandFilter)
    : "all";
}

function parseAssignmentFilter(value: string | undefined): AssignmentFilter {
  return assignmentOptions.includes(value as AssignmentFilter)
    ? (value as AssignmentFilter)
    : "all";
}

function buildFilterHref(
  filters: {
    status: StatusFilter;
    score: ScoreBandFilter;
    assignment: AssignmentFilter;
  },
  next: Partial<{
    status: StatusFilter;
    score: ScoreBandFilter;
    assignment: AssignmentFilter;
  }>,
): string {
  const params = new URLSearchParams();
  const merged = { ...filters, ...next };

  if (merged.status !== "all") {
    params.set("status", merged.status);
  }

  if (merged.score !== "all") {
    params.set("score", merged.score);
  }

  if (merged.assignment !== "all") {
    params.set("assignment", merged.assignment);
  }

  const query = params.toString();

  return query ? `/leads?${query}` : "/leads";
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

function getFilterClassName(isActive: boolean): string {
  if (isActive) {
    return "rounded-full border border-saffron bg-ember px-3 py-1.5 font-body text-xs text-ember-text";
  }

  return "rounded-full border border-border bg-white px-3 py-1.5 font-body text-xs text-dust transition-colors duration-150 hover:border-saffron hover:text-saffron";
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const filtersFromSearch = await searchParams;
  const statusFilter = parseStatusFilter(filtersFromSearch.status);
  const scoreFilter = parseScoreBandFilter(filtersFromSearch.score);
  const assignmentFilter = parseAssignmentFilter(filtersFromSearch.assignment);
  const { supabase, client } = await getActiveClientContext();

  let leadsQuery = supabase
    .from("leads")
    .select("id, name, handle, score, status, last_active, assigned_agent_id, channel_id")
    .eq("client_id", client.id)
    .order("last_active", { ascending: false })
    .limit(LEADS_PAGE_LIMIT);

  if (statusFilter !== "all") {
    leadsQuery = leadsQuery.eq("status", statusFilter);
  }

  if (assignmentFilter === "assigned") {
    leadsQuery = leadsQuery.not("assigned_agent_id", "is", null);
  }

  if (assignmentFilter === "unassigned") {
    leadsQuery = leadsQuery.is("assigned_agent_id", null);
  }

  if (scoreFilter === "cold") {
    leadsQuery = leadsQuery.lt("score", 50);
  }

  if (scoreFilter === "warm") {
    leadsQuery = leadsQuery.gte("score", 50).lte("score", 80);
  }

  if (scoreFilter === "hot") {
    leadsQuery = leadsQuery.gt("score", 80);
  }

  const { data: leadsData } = await leadsQuery;
  const leads = (leadsData ?? []) as LeadRow[];

  const leadIds = leads.map((lead) => lead.id);
  const assignedAgentIds = leads
    .map((lead) => lead.assigned_agent_id)
    .filter((agentId): agentId is string => typeof agentId === "string");
  const channelIds = leads
    .map((lead) => lead.channel_id)
    .filter((channelId): channelId is string => typeof channelId === "string");

  let messages: MessageRow[] = [];
  let agents: AgentRow[] = [];
  let channels: ChannelRow[] = [];

  if (leadIds.length > 0) {
    const [messagesResult, agentsResult, channelsResult] = await Promise.all([
      supabase
        .from("messages")
        .select("lead_id, content, sent_at")
        .eq("client_id", client.id)
        .in("lead_id", leadIds)
        .order("sent_at", { ascending: false })
        .limit(Math.max(leadIds.length * RECENT_MESSAGES_PER_LEAD, MIN_RECENT_MESSAGES)),
      assignedAgentIds.length > 0
        ? supabase
            .from("agents")
            .select("id, name")
            .eq("client_id", client.id)
            .in("id", assignedAgentIds)
        : Promise.resolve({ data: [], error: null }),
      channelIds.length > 0
        ? supabase
            .from("channels")
            .select("id, type")
            .eq("client_id", client.id)
            .in("id", channelIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    messages = (messagesResult.data ?? []) as MessageRow[];
    agents = (agentsResult.data ?? []) as AgentRow[];
    channels = (channelsResult.data ?? []) as ChannelRow[];
  }

  const latestMessageByLeadId = new Map<string, MessageRow>();

  for (const message of messages) {
    if (!latestMessageByLeadId.has(message.lead_id)) {
      latestMessageByLeadId.set(message.lead_id, message);
    }
  }

  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]));
  const channelById = new Map(channels.map((channel) => [channel.id, channel.type]));

  const activeFilters = {
    status: statusFilter,
    score: scoreFilter,
    assignment: assignmentFilter,
  };

  return (
    <div className="flex flex-col gap-6 p-8 sm:p-10">
      <div className="flex flex-col gap-4">
        <SectionLabel>Leads</SectionLabel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-black uppercase text-pitch">
              Manage Your Leads.
            </h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-dust">
              Review qualified leads, inspect recent activity, and jump into the
              right conversation when human follow-up is needed.
            </p>
          </div>

          <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
            {leads.length} leads found
          </div>
        </div>
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
              Status
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <Link
                  key={option}
                  href={buildFilterHref(activeFilters, { status: option })}
                  className={getFilterClassName(statusFilter === option)}
                >
                  {option}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
              Score band
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {scoreOptions.map((option) => (
                <Link
                  key={option}
                  href={buildFilterHref(activeFilters, { score: option })}
                  className={getFilterClassName(scoreFilter === option)}
                >
                  {option}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
              Assignment
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {assignmentOptions.map((option) => (
                <Link
                  key={option}
                  href={buildFilterHref(activeFilters, { assignment: option })}
                  className={getFilterClassName(assignmentFilter === option)}
                >
                  {option}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {leads.length === 0 ? (
        <Card>
          <SectionLabel>Leads</SectionLabel>
          <h2 className="mt-3 font-display text-3xl font-black uppercase text-pitch">
            No Leads Yet.
          </h2>
          <p className="mt-3 max-w-xl font-body text-sm leading-6 text-dust">
            Once inbound messages arrive, your leads will appear here with score,
            status, and recent activity.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {leads.map((lead) => {
            const latestMessage = latestMessageByLeadId.get(lead.id);

            return (
              <LeadCard
                key={lead.id}
                id={lead.id}
                name={lead.name}
                handle={lead.handle}
                channel={lead.channel_id ? channelById.get(lead.channel_id) ?? null : null}
                score={lead.score}
                status={lead.status}
                lastActive={lead.last_active}
                preview={getMessagePreview(latestMessage?.content ?? null)}
                assignedAgentName={
                  lead.assigned_agent_id
                    ? agentNameById.get(lead.assigned_agent_id) ?? null
                    : null
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
