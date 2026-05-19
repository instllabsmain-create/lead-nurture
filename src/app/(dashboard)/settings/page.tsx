import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { buttonClassNames } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { DEFAULT_CONFIG, getClientConfig } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type {
  AILanguage,
  Client,
  ClientConfig,
  NotifyVia,
  RoutingFallback,
  RoutingType,
} from "@/types";

const ROUTING_TYPES = ["human_handoff", "agent_assignment"] as const;
const NOTIFY_VIA_OPTIONS = ["whatsapp", "email"] as const;
const FALLBACK_OPTIONS = ["notify_owner", "reassign"] as const;
const LANGUAGE_OPTIONS = ["auto", "en", "hi", "hinglish"] as const;

type ClientRow = Pick<Client, "id" | "user_id" | "name" | "config">;

const settingsSchema = z.object({
  businessName: z.string().trim().min(1),
  businessDescription: z.string().trim().min(1),
  idealCustomer: z.string().trim().min(1),
  qualificationQuestions: z.string().optional(),
  questionAnswered: z.coerce.number().int().min(0).max(100),
  buyingSignal: z.coerce.number().int().min(0).max(100),
  urgencySignal: z.coerce.number().int().min(0).max(100),
  negativeSignal: z.coerce.number().int().min(-100).max(0),
  routingType: z.enum(ROUTING_TYPES),
  assignmentThreshold: z.coerce.number().int().min(50).max(100),
  notifyVia: z.array(z.enum(NOTIFY_VIA_OPTIONS)),
  acceptTimeoutMinutes: z.coerce.number().int().min(1).max(120),
  fallback: z.enum(FALLBACK_OPTIONS),
  model: z.string().trim().min(1),
  language: z.enum(LANGUAGE_OPTIONS),
  responseDelaySeconds: z.coerce.number().int().min(0).max(120),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getInputClassName(): string {
  return "w-full rounded-md border border-border bg-parchment px-3.5 py-2.5 font-body text-sm text-pitch outline-none transition-all placeholder:text-dust focus:border-saffron focus:ring-2 focus:ring-saffron/20";
}

function getTextareaClassName(): string {
  return `${getInputClassName()} resize-y`;
}

function parseQuestions(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function getLanguageLabel(value: AILanguage): string {
  switch (value) {
    case "auto":
      return "Auto";
    case "en":
      return "English";
    case "hi":
      return "Hindi";
    case "hinglish":
      return "Hinglish";
  }
}

function getRoutingLabel(value: RoutingType): string {
  switch (value) {
    case "human_handoff":
      return "Human handoff";
    case "agent_assignment":
      return "Agent assignment";
    case "round_robin":
      return "Round robin";
  }
}

function getNotifyLabel(value: NotifyVia): string {
  switch (value) {
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "Email";
  }
}

function getFallbackLabel(value: RoutingFallback): string {
  switch (value) {
    case "notify_owner":
      return "Notify owner";
    case "reassign":
      return "Reassign";
  }
}

async function loadClientContext(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  client: ClientRow;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("clients")
    .select("id, user_id, name, config")
    .eq("user_id", user.id)
    .maybeSingle();

  const client = (data as ClientRow | null) ?? null;

  if (!client) {
    redirect("/onboarding");
  }

  return {
    supabase,
    client,
  };
}

async function saveSettingsAction(formData: FormData) {
  "use server";

  const payload = settingsSchema.safeParse({
    businessName: formData.get("business_name"),
    businessDescription: formData.get("business_description"),
    idealCustomer: formData.get("ideal_customer"),
    qualificationQuestions: formData.get("qualification_questions"),
    questionAnswered: formData.get("question_answered"),
    buyingSignal: formData.get("buying_signal"),
    urgencySignal: formData.get("urgency_signal"),
    negativeSignal: formData.get("negative_signal"),
    routingType: formData.get("routing_type"),
    assignmentThreshold: formData.get("assignment_threshold"),
    notifyVia: formData.getAll("notify_via"),
    acceptTimeoutMinutes: formData.get("accept_timeout_minutes"),
    fallback: formData.get("fallback"),
    model: formData.get("model"),
    language: formData.get("language"),
    responseDelaySeconds: formData.get("response_delay_seconds"),
  });

  if (!payload.success) {
    return;
  }

  const { supabase, client } = await loadClientContext();
  const currentConfigRecord = isRecord(client.config) ? client.config : {};
  const currentConfig = getClientConfig(client.config);
  const qualificationQuestions = parseQuestions(payload.data.qualificationQuestions);

  const nextConfig: ClientConfig = {
    ...currentConfigRecord,
    business_name: payload.data.businessName,
    business_description: payload.data.businessDescription,
    ideal_customer: payload.data.idealCustomer,
    qualification_questions: qualificationQuestions,
    scoring: {
      ...currentConfig.scoring,
      question_answered: payload.data.questionAnswered,
      buying_signal: payload.data.buyingSignal,
      urgency_signal: payload.data.urgencySignal,
      negative_signal: payload.data.negativeSignal,
    },
    routing: {
      ...currentConfig.routing,
      type: payload.data.routingType,
      assignment_threshold: payload.data.assignmentThreshold,
      notify_via: payload.data.notifyVia,
      accept_timeout_minutes: payload.data.acceptTimeoutMinutes,
      fallback: payload.data.fallback,
    },
    ai: {
      ...currentConfig.ai,
      model: payload.data.model,
      language: payload.data.language,
      response_delay_seconds: payload.data.responseDelaySeconds,
    },
  };

  const { error } = await supabase
    .from("clients")
    .update({
      name: payload.data.businessName,
      config: nextConfig,
    })
    .eq("id", client.id)
    .eq("user_id", client.user_id);

  if (error) {
    throw new Error(`Failed to save settings: ${error.message}`);
  }

  revalidatePath("/settings");
}

export default async function SettingsPage() {
  const { client } = await loadClientContext();
  const config = getClientConfig(client.config);
  const qualificationQuestions =
    config.qualification_questions ?? DEFAULT_CONFIG.qualification_questions;
  const scoring = config.scoring ?? DEFAULT_CONFIG.scoring;
  const routing = config.routing ?? DEFAULT_CONFIG.routing;
  const ai = config.ai ?? DEFAULT_CONFIG.ai;

  return (
    <div className="flex flex-col gap-6 p-8 sm:p-10">
      <div className="flex flex-col gap-4">
        <SectionLabel>Settings</SectionLabel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-display text-4xl font-black uppercase text-pitch">
              Configure Your Nurture Engine.
            </h1>
            <p className="mt-2 max-w-2xl font-body text-sm leading-6 text-dust">
              Update business context, qualification rules, routing thresholds,
              and AI behavior without losing the rest of your saved config.
            </p>
          </div>

          <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
            Saved to client config
          </div>
        </div>
      </div>

      <form action={saveSettingsAction} className="space-y-6">
        <Card>
          <SectionLabel>Business Profile</SectionLabel>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="business-name"
              >
                Business name
              </label>
              <input
                id="business-name"
                name="business_name"
                type="text"
                required
                defaultValue={config.business_name ?? client.name}
                className={getInputClassName()}
              />
            </div>

            <div className="lg:col-span-2">
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="business-description"
              >
                Business description
              </label>
              <textarea
                id="business-description"
                name="business_description"
                rows={6}
                required
                defaultValue={config.business_description ?? ""}
                className={getTextareaClassName()}
              />
            </div>

            <div className="lg:col-span-2">
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="ideal-customer"
              >
                Ideal customer
              </label>
              <textarea
                id="ideal-customer"
                name="ideal_customer"
                rows={4}
                required
                defaultValue={config.ideal_customer ?? ""}
                className={getTextareaClassName()}
              />
            </div>
          </div>
        </Card>

        <Card>
          <SectionLabel>Qualification Questions</SectionLabel>
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              {qualificationQuestions.length > 0 ? (
                qualificationQuestions.map((question, index) => (
                  <span
                    key={`${question}-${index}`}
                    className="rounded-full border border-border bg-parchment px-3 py-1 font-body text-xs text-pitch"
                  >
                    {question}
                  </span>
                ))
              ) : (
                <span className="font-body text-sm text-dust">
                  No qualification questions saved yet.
                </span>
              )}
            </div>

            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="qualification-questions"
              >
                Questions
              </label>
              <textarea
                id="qualification-questions"
                name="qualification_questions"
                rows={8}
                defaultValue={qualificationQuestions.join("\n")}
                className={getTextareaClassName()}
              />
              <div className="mt-2 font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                One question per line. Edit lines to update or remove them.
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <SectionLabel>Scoring Settings</SectionLabel>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="question-answered"
                >
                  Question answered
                </label>
                <input
                  id="question-answered"
                  name="question_answered"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={scoring.question_answered ?? DEFAULT_CONFIG.scoring.question_answered}
                  className={getInputClassName()}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="buying-signal"
                >
                  Buying signal
                </label>
                <input
                  id="buying-signal"
                  name="buying_signal"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={scoring.buying_signal ?? DEFAULT_CONFIG.scoring.buying_signal}
                  className={getInputClassName()}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="urgency-signal"
                >
                  Urgency signal
                </label>
                <input
                  id="urgency-signal"
                  name="urgency_signal"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={scoring.urgency_signal ?? DEFAULT_CONFIG.scoring.urgency_signal}
                  className={getInputClassName()}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="negative-signal"
                >
                  Negative signal
                </label>
                <input
                  id="negative-signal"
                  name="negative_signal"
                  type="number"
                  min={-100}
                  max={0}
                  defaultValue={scoring.negative_signal ?? DEFAULT_CONFIG.scoring.negative_signal}
                  className={getInputClassName()}
                />
              </div>
            </div>
          </Card>

          <Card>
            <SectionLabel>AI Settings</SectionLabel>
            <div className="mt-5 grid gap-4">
              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="model"
                >
                  Model
                </label>
                <input
                  id="model"
                  name="model"
                  type="text"
                  defaultValue={ai.model ?? DEFAULT_CONFIG.ai.model}
                  className={getInputClassName()}
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="language"
                >
                  Language
                </label>
                <select
                  id="language"
                  name="language"
                  defaultValue={ai.language ?? DEFAULT_CONFIG.ai.language}
                  className={getInputClassName()}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {getLanguageLabel(option)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                  htmlFor="response-delay-seconds"
                >
                  Response delay seconds
                </label>
                <select
                  id="response-delay-seconds"
                  name="response_delay_seconds"
                  defaultValue={String(
                    ai.response_delay_seconds
                    ?? DEFAULT_CONFIG.ai.response_delay_seconds,
                  )}
                  className={getInputClassName()}
                >
                  {[0, 30, 60, 120].map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {seconds === 0 ? "Instant" : `${seconds}s`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <SectionLabel>Routing Settings</SectionLabel>
          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="routing-type"
              >
                Routing type
              </label>
              <select
                id="routing-type"
                name="routing_type"
                defaultValue={routing.type ?? DEFAULT_CONFIG.routing.type}
                className={getInputClassName()}
              >
                {ROUTING_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {getRoutingLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="assignment-threshold"
              >
                Assignment threshold
              </label>
              <input
                id="assignment-threshold"
                name="assignment_threshold"
                type="number"
                min={50}
                max={100}
                defaultValue={
                  routing.assignment_threshold
                  ?? DEFAULT_CONFIG.routing.assignment_threshold
                }
                className={getInputClassName()}
              />
            </div>

            <div>
              <span className="mb-2 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                Notify via
              </span>
              <div className="flex flex-wrap gap-3">
                {NOTIFY_VIA_OPTIONS.map((option) => {
                  const isChecked =
                    routing.notify_via?.includes(option) ?? false;

                  return (
                    <label
                      key={option}
                      className="flex items-center gap-3 rounded-md border border-border bg-parchment px-3.5 py-3"
                    >
                      <input
                        name="notify_via"
                        type="checkbox"
                        value={option}
                        defaultChecked={isChecked}
                        className="h-4 w-4 rounded border-border accent-saffron"
                      />
                      <span className="font-body text-sm text-pitch">
                        {getNotifyLabel(option)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="accept-timeout-minutes"
              >
                Accept timeout minutes
              </label>
              <input
                id="accept-timeout-minutes"
                name="accept_timeout_minutes"
                type="number"
                min={1}
                max={120}
                defaultValue={
                  routing.accept_timeout_minutes
                  ?? DEFAULT_CONFIG.routing.accept_timeout_minutes
                }
                className={getInputClassName()}
              />
            </div>

            <div className="lg:col-span-2">
              <label
                className="mb-1.5 block font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                htmlFor="fallback"
              >
                Fallback
              </label>
              <select
                id="fallback"
                name="fallback"
                defaultValue={routing.fallback ?? DEFAULT_CONFIG.routing.fallback}
                className={getInputClassName()}
              >
                {FALLBACK_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {getFallbackLabel(option)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        <div className="flex justify-end">
          <button type="submit" className={buttonClassNames.primary}>
            Save settings
          </button>
        </div>
      </form>
    </div>
  );
}
