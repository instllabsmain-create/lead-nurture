import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { buttonClassNames } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { createClient } from "@/lib/supabase/server";
import type { Agent } from "@/types";

interface ClientRow {
  id: string;
}

type AgentRow = Pick<
  Agent,
  | "id"
  | "name"
  | "phone"
  | "email"
  | "territories"
  | "max_leads"
  | "active_leads"
  | "is_available"
  | "created_at"
>;

interface AssignedLeadRow {
  assigned_agent_id: string | null;
}

const createAgentSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  email: z.union([z.string().trim().email(), z.literal("")]),
  territories: z.string().trim().optional(),
  max_leads: z.coerce.number().int().min(1),
  is_available: z.boolean(),
});

const updateAgentSchema = z.object({
  agentId: z.uuid(),
  max_leads: z.coerce.number().int().min(1),
  is_available: z.boolean(),
});

const deleteAgentSchema = z.object({
  agentId: z.uuid(),
});

function parseBooleanField(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

function parseNullableString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseTerritories(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function getInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getAvailabilityClassName(isAvailable: boolean): string {
  return isAvailable
    ? "bg-ember text-ember-text"
    : "bg-parchment text-dust";
}

function getInputClassName(): string {
  return "w-full rounded-md border border-border bg-parchment px-3.5 py-2.5 font-body text-sm text-pitch outline-none transition-all placeholder:text-dust focus:border-saffron focus:ring-2 focus:ring-saffron/20";
}

async function loadClientContext(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  clientId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: clientData } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  const client = (clientData as ClientRow | null) ?? null;

  if (!client) {
    redirect("/onboarding");
  }

  return {
    supabase,
    clientId: client.id,
  };
}

async function createAgentAction(formData: FormData) {
  "use server";

  const payload = createAgentSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    territories: formData.get("territories"),
    max_leads: formData.get("max_leads"),
    is_available: parseBooleanField(formData.get("is_available")),
  });

  if (!payload.success) {
    return;
  }

  const { supabase, clientId } = await loadClientContext();
  const { error } = await supabase.from("agents").insert({
    client_id: clientId,
    name: payload.data.name,
    phone: parseNullableString(payload.data.phone),
    email: parseNullableString(payload.data.email),
    territories: parseTerritories(payload.data.territories),
    specialities: [],
    max_leads: payload.data.max_leads,
    active_leads: 0,
    is_available: payload.data.is_available,
    working_hours: {},
  });

  if (error) {
    throw new Error(`Failed to create agent: ${error.message}`);
  }

  revalidatePath("/agents");
}

async function updateAgentAction(formData: FormData) {
  "use server";

  const payload = updateAgentSchema.safeParse({
    agentId: formData.get("agent_id"),
    max_leads: formData.get("max_leads"),
    is_available: parseBooleanField(formData.get("is_available")),
  });

  if (!payload.success) {
    return;
  }

  const { supabase, clientId } = await loadClientContext();
  const { error } = await supabase
    .from("agents")
    .update({
      max_leads: payload.data.max_leads,
      is_available: payload.data.is_available,
    })
    .eq("id", payload.data.agentId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to update agent: ${error.message}`);
  }

  revalidatePath("/agents");
}

async function deleteAgentAction(formData: FormData) {
  "use server";

  const payload = deleteAgentSchema.safeParse({
    agentId: formData.get("agent_id"),
  });

  if (!payload.success) {
    return;
  }

  const { supabase, clientId } = await loadClientContext();
  const { data: agentData, error: agentError } = await supabase
    .from("agents")
    .select("id, active_leads")
    .eq("id", payload.data.agentId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (agentError) {
    throw new Error(`Failed to load agent: ${agentError.message}`);
  }

  if (!agentData) {
    return;
  }

  const { count: assignedLeadCount, error: leadCountError } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("assigned_agent_id", payload.data.agentId);

  if (leadCountError) {
    throw new Error(`Failed to check agent safety: ${leadCountError.message}`);
  }

  if ((assignedLeadCount ?? 0) > 0 || agentData.active_leads > 0) {
    return;
  }

  const { error } = await supabase
    .from("agents")
    .delete()
    .eq("id", payload.data.agentId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to delete agent: ${error.message}`);
  }

  revalidatePath("/agents");
}

export default async function AgentsPage() {
  const { supabase, clientId } = await loadClientContext();
  const { data: agentsData } = await supabase
    .from("agents")
    .select(
      "id, name, phone, email, territories, max_leads, active_leads, is_available, created_at",
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: true });

  const agents = (agentsData ?? []) as AgentRow[];
  const agentIds = agents.map((agent) => agent.id);
  const assignedLeadCounts = new Map<string, number>();

  if (agentIds.length > 0) {
    const { data: assignedLeadRows } = await supabase
      .from("leads")
      .select("assigned_agent_id")
      .eq("client_id", clientId)
      .in("assigned_agent_id", agentIds);

    for (const row of (assignedLeadRows ?? []) as AssignedLeadRow[]) {
      if (!row.assigned_agent_id) {
        continue;
      }

      assignedLeadCounts.set(
        row.assigned_agent_id,
        (assignedLeadCounts.get(row.assigned_agent_id) ?? 0) + 1,
      );
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8 sm:p-10">
      <div className="flex flex-col gap-4">
        <SectionLabel>Agents</SectionLabel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-black uppercase text-pitch">
              Manage Your Sales Team.
            </h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-dust">
              Add agents, control availability, and set lead capacity without
              changing the routing rules behind assignment.
            </p>
          </div>

          <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
            {agents.length} agents
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <SectionLabel>Add Agent</SectionLabel>
          <form action={createAgentAction} className="mt-5 space-y-4">
            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="agent-name"
              >
                Name
              </label>
              <input
                id="agent-name"
                name="name"
                type="text"
                required
                className={getInputClassName()}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="agent-phone"
              >
                Phone
              </label>
              <input
                id="agent-phone"
                name="phone"
                type="tel"
                className={getInputClassName()}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="agent-email"
              >
                Email
              </label>
              <input
                id="agent-email"
                name="email"
                type="email"
                className={getInputClassName()}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="agent-territories"
              >
                Territories
              </label>
              <textarea
                id="agent-territories"
                name="territories"
                rows={4}
                placeholder="Bandra, Andheri, South Delhi"
                className={getInputClassName()}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="agent-max-leads"
              >
                Max leads
              </label>
              <input
                id="agent-max-leads"
                name="max_leads"
                type="number"
                min={1}
                defaultValue={10}
                required
                className={getInputClassName()}
              />
            </div>

            <label className="flex items-center gap-3 rounded-md border border-border bg-parchment px-3.5 py-3">
              <input
                name="is_available"
                type="checkbox"
                defaultChecked
                className="h-4 w-4 rounded border-border accent-saffron"
              />
              <span className="font-body text-sm text-pitch">Available for assignment</span>
            </label>

            <button type="submit" className={buttonClassNames.primary}>
              Add agent
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          {agents.length === 0 ? (
            <Card>
              <SectionLabel>Team</SectionLabel>
              <h2 className="mt-3 font-display text-3xl font-black uppercase text-pitch">
                No Agents Yet.
              </h2>
              <p className="mt-3 max-w-xl font-body text-sm leading-6 text-dust">
                Add your first sales agent to start routing qualified leads to
                the right person.
              </p>
            </Card>
          ) : (
            agents.map((agent) => {
              const assignedLeadCount = assignedLeadCounts.get(agent.id) ?? 0;
              const canDelete = assignedLeadCount === 0 && agent.active_leads === 0;

              return (
                <Card key={agent.id}>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember font-mono text-[10px] font-medium text-ember-text">
                        {getInitials(agent.name)}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-body text-base font-medium text-pitch">
                            {agent.name}
                          </h2>
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${getAvailabilityClassName(agent.is_available)}`}
                          >
                            {agent.is_available ? "available" : "offline"}
                          </span>
                        </div>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                              Phone
                            </div>
                            <div className="mt-1 font-body text-sm text-pitch">
                              {agent.phone ?? "Not provided"}
                            </div>
                          </div>

                          <div>
                            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                              Email
                            </div>
                            <div className="mt-1 font-body text-sm text-pitch">
                              {agent.email ?? "Not provided"}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                            Territories
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {agent.territories.length > 0 ? (
                              agent.territories.map((territory) => (
                                <span
                                  key={territory}
                                  className="rounded-full border border-border bg-parchment px-3 py-1 font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                                >
                                  {territory}
                                </span>
                              ))
                            ) : (
                              <span className="font-body text-sm text-dust">
                                All territories
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-4 font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                          <span>{agent.active_leads} active leads</span>
                          <span>{agent.max_leads} max leads</span>
                          <span>Added {formatDate(agent.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full max-w-sm space-y-3">
                      <form action={updateAgentAction} className="space-y-3 rounded-xl border border-border bg-parchment p-4">
                        <input type="hidden" name="agent_id" value={agent.id} />

                        <div>
                          <label
                            className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                            htmlFor={`max-leads-${agent.id}`}
                          >
                            Max leads
                          </label>
                          <input
                            id={`max-leads-${agent.id}`}
                            name="max_leads"
                            type="number"
                            min={1}
                            defaultValue={agent.max_leads}
                            className={getInputClassName()}
                          />
                        </div>

                        <label className="flex items-center gap-3 rounded-md border border-border bg-white px-3.5 py-3">
                          <input
                            name="is_available"
                            type="checkbox"
                            defaultChecked={agent.is_available}
                            className="h-4 w-4 rounded border-border accent-saffron"
                          />
                          <span className="font-body text-sm text-pitch">
                            Available for assignment
                          </span>
                        </label>

                        <button type="submit" className={buttonClassNames.secondary}>
                          Save changes
                        </button>
                      </form>

                      <form action={deleteAgentAction} className="space-y-2">
                        <input type="hidden" name="agent_id" value={agent.id} />
                        <button
                          type="submit"
                          className={buttonClassNames.ghost}
                          disabled={!canDelete}
                        >
                          Delete agent
                        </button>
                        <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                          {canDelete
                            ? "Safe to delete"
                            : "Delete disabled while this agent still has active leads"}
                        </div>
                      </form>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
