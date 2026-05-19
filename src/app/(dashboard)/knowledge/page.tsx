import { revalidatePath } from "next/cache";
import { z } from "zod";

import { buttonClassNames } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { getActiveClientContext } from "@/lib/active-client";
import type { KnowledgeBase } from "@/types";

type KnowledgeRow = Pick<
  KnowledgeBase,
  "id" | "title" | "content" | "created_at"
>;

const createKnowledgeSchema = z.object({
  title: z.string().trim().optional(),
  content: z.string().trim().min(1),
});

const updateKnowledgeSchema = z.object({
  entryId: z.uuid(),
  title: z.string().trim().optional(),
  content: z.string().trim().min(1),
});

const deleteKnowledgeSchema = z.object({
  entryId: z.uuid(),
});

function parseNullableTitle(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getInputClassName(): string {
  return "w-full rounded-md border border-border bg-parchment px-3.5 py-2.5 font-body text-sm text-pitch outline-none transition-all placeholder:text-dust focus:border-saffron focus:ring-2 focus:ring-saffron/20";
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getPreview(content: string): string {
  const normalized = content.replace(/\s+/g, " ").trim();

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117)}...`;
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

async function createEntryAction(formData: FormData) {
  "use server";

  const payload = createKnowledgeSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!payload.success) {
    return;
  }

  const { supabase, clientId } = await loadClientContext();
  const { error } = await supabase.from("knowledge_base").insert({
    client_id: clientId,
    title: parseNullableTitle(payload.data.title),
    content: payload.data.content,
  });

  if (error) {
    throw new Error(`Failed to create knowledge entry: ${error.message}`);
  }

  revalidatePath("/knowledge");
}

async function updateEntryAction(formData: FormData) {
  "use server";

  const payload = updateKnowledgeSchema.safeParse({
    entryId: formData.get("entry_id"),
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!payload.success) {
    return;
  }

  const { supabase, clientId } = await loadClientContext();
  const { error } = await supabase
    .from("knowledge_base")
    .update({
      title: parseNullableTitle(payload.data.title),
      content: payload.data.content,
    })
    .eq("id", payload.data.entryId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to update knowledge entry: ${error.message}`);
  }

  revalidatePath("/knowledge");
}

async function deleteEntryAction(formData: FormData) {
  "use server";

  const payload = deleteKnowledgeSchema.safeParse({
    entryId: formData.get("entry_id"),
  });

  if (!payload.success) {
    return;
  }

  const { supabase, clientId } = await loadClientContext();
  const { error } = await supabase
    .from("knowledge_base")
    .delete()
    .eq("id", payload.data.entryId)
    .eq("client_id", clientId);

  if (error) {
    throw new Error(`Failed to delete knowledge entry: ${error.message}`);
  }

  revalidatePath("/knowledge");
}

export default async function KnowledgePage() {
  const { supabase, clientId } = await loadClientContext();
  const { data } = await supabase
    .from("knowledge_base")
    .select("id, title, content, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  const entries = (data ?? []) as KnowledgeRow[];

  return (
    <div className="flex flex-col gap-6 p-8 sm:p-10">
      <div className="flex flex-col gap-4">
        <SectionLabel>Knowledge Base</SectionLabel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-black uppercase text-pitch">
              Train The AI On Your Business.
            </h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-dust">
              Add facts, policies, and product details so AI replies stay
              accurate when leads ask questions.
            </p>
          </div>

          <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
            {entries.length} entries
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <SectionLabel>Add Entry</SectionLabel>
          <form action={createEntryAction} className="mt-5 space-y-4">
            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="knowledge-title"
              >
                Title
              </label>
              <input
                id="knowledge-title"
                name="title"
                type="text"
                placeholder="Refund policy"
                className={getInputClassName()}
              />
            </div>

            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="knowledge-content"
              >
                Content
              </label>
              <textarea
                id="knowledge-content"
                name="content"
                rows={10}
                required
                placeholder="Add facts the AI should use when answering leads."
                className={getInputClassName()}
              />
            </div>

            <button type="submit" className={buttonClassNames.primary}>
              Save entry
            </button>
          </form>
        </Card>

        <div className="space-y-4">
          {entries.length === 0 ? (
            <Card>
              <SectionLabel>Knowledge</SectionLabel>
              <h2 className="mt-3 font-display text-3xl font-black uppercase text-pitch">
                No Knowledge Added Yet.
              </h2>
              <p className="mt-3 max-w-xl font-body text-sm leading-6 text-dust">
                The AI uses this information to answer lead questions accurately.
                Add pricing notes, delivery rules, service coverage, FAQs, or
                policies here.
              </p>
            </Card>
          ) : (
            entries.map((entry) => (
              <Card key={entry.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-body text-base font-medium text-pitch">
                          {entry.title?.trim() || "Untitled entry"}
                        </div>
                        <div className="mt-1 font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                          Added {formatDate(entry.created_at)}
                        </div>
                      </div>

                      <div className="max-w-sm font-body text-xs text-dust lg:text-right">
                        {getPreview(entry.content)}
                      </div>
                    </div>

                    <form action={updateEntryAction} className="mt-5 space-y-4">
                      <input type="hidden" name="entry_id" value={entry.id} />

                      <div>
                        <label
                          className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                          htmlFor={`title-${entry.id}`}
                        >
                          Title
                        </label>
                        <input
                          id={`title-${entry.id}`}
                          name="title"
                          type="text"
                          defaultValue={entry.title ?? ""}
                          className={getInputClassName()}
                        />
                      </div>

                      <div>
                        <label
                          className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                          htmlFor={`content-${entry.id}`}
                        >
                          Content
                        </label>
                        <textarea
                          id={`content-${entry.id}`}
                          name="content"
                          rows={8}
                          defaultValue={entry.content}
                          required
                          className={getInputClassName()}
                        />
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button type="submit" className={buttonClassNames.secondary}>
                          Save changes
                        </button>
                      </div>
                    </form>
                  </div>

                  <form action={deleteEntryAction} className="shrink-0">
                    <input type="hidden" name="entry_id" value={entry.id} />
                    <button type="submit" className={buttonClassNames.ghost}>
                      Delete
                    </button>
                  </form>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
