import Link from "next/link";
import { notFound } from "next/navigation";

import {
  LeadDetail,
  type LeadDetailMessage,
} from "@/components/leads/lead-detail";
import { SectionLabel } from "@/components/ui/section-label";
import { getActiveClientContext } from "@/lib/active-client";
import type { Lead, Message, Platform } from "@/types";

interface LeadPageProps {
  params: Promise<{
    id: string;
  }>;
}

interface AgentRow {
  id: string;
  name: string;
}

type MessageRow = Pick<
  Message,
  "id" | "direction" | "content" | "ai_generated" | "sent_at" | "channel"
>;

export default async function LeadPage({ params }: LeadPageProps) {
  const { id } = await params;
  const { supabase, client } = await getActiveClientContext();

  const { data: leadData } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("client_id", client.id)
    .maybeSingle();

  const lead = (leadData as Lead | null) ?? null;

  if (!lead) {
    notFound();
  }

  const [agentResult, messagesResult] = await Promise.all([
    lead.assigned_agent_id
      ? supabase
          .from("agents")
          .select("id, name")
          .eq("client_id", client.id)
          .eq("id", lead.assigned_agent_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("messages")
      .select("id, direction, content, ai_generated, sent_at, channel")
      .eq("client_id", client.id)
      .eq("lead_id", lead.id)
      .order("sent_at", { ascending: false })
      .limit(12),
  ]);

  const assignedAgent = (agentResult.data as AgentRow | null) ?? null;
  const recentMessagesDescending = (messagesResult.data ?? []) as MessageRow[];
  const messages: LeadDetailMessage[] = [...recentMessagesDescending]
    .reverse()
    .map((message) => ({
      id: message.id,
      direction: message.direction,
      content: message.content,
      aiGenerated: message.ai_generated,
      sentAt: message.sent_at,
      channel: message.channel as Platform,
    }));

  return (
    <div className="flex flex-col gap-6 p-8 sm:p-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <SectionLabel>Lead Detail</SectionLabel>
          <h1 className="mt-3 font-display text-4xl font-black uppercase text-pitch">
            Lead Profile.
          </h1>
        </div>

        <Link
          href={`/inbox/${lead.id}`}
          className="rounded-md bg-ember px-4 py-2 font-body text-sm font-medium text-ember-text transition-colors duration-150 hover:bg-saffron hover:text-white"
        >
          Open conversation
        </Link>
      </div>

      <LeadDetail
        lead={{
          id: lead.id,
          name: lead.name,
          handle: lead.handle,
          email: lead.email,
          phone: lead.phone,
          score: lead.score,
          status: lead.status,
          answers: lead.answers,
          tags: lead.tags,
          assignedAgentName: assignedAgent?.name ?? null,
          lastActive: lead.last_active,
        }}
        messages={messages}
      />
    </div>
  );
}
