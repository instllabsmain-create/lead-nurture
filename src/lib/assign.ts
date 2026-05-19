import type { SupabaseClient } from "@supabase/supabase-js";

import { getClientConfig } from "@/lib/config";
import type { Agent, Client, Lead, RoutingType } from "@/types";

interface AssignLeadArgs {
  lead: Lead;
  client: Client;
  supabase: SupabaseClient;
}

function getLocationAnswer(answers: Record<string, string>): string | null {
  const locationEntry = Object.entries(answers).find(([question, answer]) => {
    const normalizedQuestion = question.toLowerCase();

    return (
      answer.trim().length > 0 &&
      (normalizedQuestion.includes("where") ||
        normalizedQuestion.includes("location") ||
        normalizedQuestion.includes("area") ||
        normalizedQuestion.includes("city"))
    );
  });

  if (locationEntry) {
    return locationEntry[1];
  }

  const fallback = Object.values(answers).find((answer) => answer.trim().length > 0);
  return fallback ?? null;
}

function sortByLoad(agents: Agent[]): Agent[] {
  return [...agents].sort((left, right) => left.active_leads - right.active_leads);
}

const ASSIGNMENT_ROUTING_TYPES: RoutingType[] = ["agent_assignment", "round_robin"];

export async function assignLead({
  lead,
  client,
  supabase,
}: AssignLeadArgs): Promise<Agent | null> {
  const config = getClientConfig(client.config);
  const routingType = config.routing?.type;

  if (!routingType || !ASSIGNMENT_ROUTING_TYPES.includes(routingType)) {
    return null;
  }

  const threshold = config.routing?.assignment_threshold ?? 70;

  if (lead.score < threshold) {
    return null;
  }

  if (lead.assigned_agent_id) {
    return null;
  }

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("client_id", client.id)
    .eq("is_available", true);

  if (error) {
    throw new Error(`Failed to fetch available agents: ${error.message}`);
  }

  const availableAgents = ((data ?? []) as Agent[]).filter(
    (agent) => agent.active_leads < agent.max_leads,
  );

  if (availableAgents.length === 0) {
    return null;
  }

  const locationAnswer = getLocationAnswer(lead.answers);
  let pool = availableAgents;

  if (locationAnswer) {
    const normalizedLocation = locationAnswer.toLowerCase();
    const territoryMatches = availableAgents.filter(
      (agent) =>
        agent.territories.length === 0 ||
        agent.territories.some((territory) =>
          normalizedLocation.includes(territory.toLowerCase()),
        ),
    );

    if (territoryMatches.length > 0) {
      pool = territoryMatches;
    }
  }

  const sortedAgents = sortByLoad(pool);
  // round_robin: purely sequential, ignores score and load
  // agent_assignment: hot leads (>85) get the least busy agent; others round-robin
  const assignedAgent =
    routingType === "round_robin"
      ? sortedAgents[Math.floor(Date.now() / 1000) % sortedAgents.length]
      : lead.score > 85
        ? sortedAgents[0]
        : sortedAgents[Math.floor(Date.now() / 1000) % sortedAgents.length];

  const assignedAt = new Date().toISOString();

  const [leadUpdate, agentUpdate] = await Promise.all([
    supabase
      .from("leads")
      .update({
        assigned_agent_id: assignedAgent.id,
        assigned_at: assignedAt,
        status: "assigned",
      })
      .eq("id", lead.id)
      .eq("client_id", client.id),
    supabase
      .from("agents")
      .update({
        active_leads: assignedAgent.active_leads + 1,
      })
      .eq("id", assignedAgent.id)
      .eq("client_id", client.id),
  ]);

  if (leadUpdate.error) {
    throw new Error(`Failed to assign lead: ${leadUpdate.error.message}`);
  }

  if (agentUpdate.error) {
    throw new Error(`Failed to update agent load: ${agentUpdate.error.message}`);
  }

  return {
    ...assignedAgent,
    active_leads: assignedAgent.active_leads + 1,
  };
}
