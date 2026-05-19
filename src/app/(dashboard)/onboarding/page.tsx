"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { buttonClassNames } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { Wordmark } from "@/components/ui/wordmark";
import { createClient } from "@/lib/supabase/client";
import type { ClientConfig } from "@/types";

const BUSINESS_TYPES = [
  "Product seller",
  "Service provider",
  "Retailer",
  "Consultant",
  "Manufacturer",
  "Freelancer",
] as const;

const CUSTOMER_SOURCES = [
  "Referrals",
  "Social media",
  "Walk-ins",
  "Cold outreach",
  "Online ads",
] as const;

type Step = 1 | 2 | 3;
type TeamMode = "just_me" | "sales_team";

interface OnboardingConfig extends ClientConfig {
  business_name: string;
  team: {
    mode: TeamMode;
    agent_count?: number;
  };
}

interface OnboardingFormState {
  businessDescription: string;
  businessTypes: string[];
  idealCustomer: string;
  customerSources: string[];
  businessName: string;
  teamMode: TeamMode;
  agentCount: string;
}

const INITIAL_STATE: OnboardingFormState = {
  businessDescription: "",
  businessTypes: [],
  idealCustomer: "",
  customerSources: [],
  businessName: "",
  teamMode: "just_me",
  agentCount: "",
};

function getChipClassName(isActive: boolean): string {
  if (isActive) {
    return "rounded-full border border-saffron bg-ember px-3 py-1.5 font-body text-xs text-ember-text transition-all duration-150";
  }

  return "rounded-full border border-border bg-white px-3 py-1.5 font-body text-xs text-dust transition-all duration-150 hover:border-saffron hover:text-saffron";
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<OnboardingFormState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isStepOneValid = form.businessDescription.trim().length > 0;
  const hasValidAgentCount =
    form.teamMode === "just_me" ||
    (Number.isInteger(Number(form.agentCount)) && Number(form.agentCount) > 0);
  const canSubmit = form.businessName.trim().length > 0 && hasValidAgentCount;

  function toggleMultiSelect(field: "businessTypes" | "customerSources", value: string) {
    setForm((current) => {
      const values = current[field];
      const nextValues = values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value];

      return {
        ...current,
        [field]: nextValues,
      };
    });
  }

  function handleBusinessDescriptionChange(value: string) {
    setForm((current) => ({
      ...current,
      businessDescription: value,
    }));
  }

  function handleIdealCustomerChange(value: string) {
    setForm((current) => ({
      ...current,
      idealCustomer: value,
    }));
  }

  function handleBusinessNameChange(value: string) {
    setForm((current) => ({
      ...current,
      businessName: value,
    }));
  }

  function handleTeamModeChange(value: TeamMode) {
    setForm((current) => ({
      ...current,
      teamMode: value,
      agentCount: value === "sales_team" ? current.agentCount : "",
    }));
  }

  function handleAgentCountChange(value: string) {
    setForm((current) => ({
      ...current,
      agentCount: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        router.push("/login");
        return;
      }

      if (!user.email) {
        throw new Error("Google account email is required to finish onboarding.");
      }

      const agentCount =
        form.teamMode === "sales_team" ? Number.parseInt(form.agentCount, 10) : undefined;

      const config: OnboardingConfig = {
        business_name: form.businessName.trim(),
        business_description: form.businessDescription.trim(),
        business_type: form.businessTypes,
        ideal_customer: form.idealCustomer.trim(),
        customer_sources: form.customerSources,
        team:
          form.teamMode === "sales_team" && agentCount
            ? {
                mode: "sales_team",
                agent_count: agentCount,
              }
            : {
                mode: "just_me",
              },
      };

      const { error: upsertError } = await supabase.from("clients").upsert(
        {
          user_id: user.id,
          name: form.businessName.trim(),
          email: user.email,
          config,
          onboarding_completed: true,
        },
        {
          onConflict: "user_id",
        },
      );

      if (upsertError) {
        throw new Error(upsertError.message);
      }

      router.push("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save onboarding details.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-parchment">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl px-8 py-8 sm:px-12 sm:py-10">
        <main className="flex w-full max-w-3xl flex-col">
          <div className="mb-16">
            <Wordmark />
          </div>

          <div className="mb-8 flex w-full gap-2">
            {[1, 2, 3].map((segment) => (
              <div
                key={segment}
                className={`h-1 flex-1 rounded-full ${
                  segment <= step ? "bg-saffron" : "bg-border"
                }`}
              />
            ))}
          </div>

          <Card>
            <form className="space-y-8" onSubmit={handleSubmit}>
              {step === 1 ? (
                <div className="space-y-6">
                  <SectionLabel>01 - YOUR BUSINESS</SectionLabel>

                  <div>
                    <label
                      className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2.5px] text-dust"
                      htmlFor="business-description"
                    >
                      What does your business do?
                    </label>
                    <textarea
                      id="business-description"
                      rows={6}
                      className="w-full rounded-md border border-border bg-parchment px-3.5 py-2.5 font-body text-sm text-pitch outline-none transition-all placeholder:text-dust focus:border-saffron focus:ring-2 focus:ring-saffron/20"
                      value={form.businessDescription}
                      onChange={(event) =>
                        handleBusinessDescriptionChange(event.target.value)
                      }
                    />
                  </div>

                  <div>
                    <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2.5px] text-dust">
                      Which best describes you?
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {BUSINESS_TYPES.map((type) => {
                        const isActive = form.businessTypes.includes(type);

                        return (
                          <button
                            key={type}
                            type="button"
                            className={getChipClassName(isActive)}
                            aria-pressed={isActive}
                            onClick={() => toggleMultiSelect("businessTypes", type)}
                          >
                            {type}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className={buttonClassNames.primary}
                      disabled={!isStepOneValid}
                      onClick={() => setStep(2)}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 2 ? (
                <div className="space-y-6">
                  <SectionLabel>02 - YOUR CUSTOMER</SectionLabel>

                  <div>
                    <label
                      className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2.5px] text-dust"
                      htmlFor="ideal-customer"
                    >
                      Describe your ideal customer
                    </label>
                    <textarea
                      id="ideal-customer"
                      rows={6}
                      className="w-full rounded-md border border-border bg-parchment px-3.5 py-2.5 font-body text-sm text-pitch outline-none transition-all placeholder:text-dust focus:border-saffron focus:ring-2 focus:ring-saffron/20"
                      value={form.idealCustomer}
                      onChange={(event) => handleIdealCustomerChange(event.target.value)}
                    />
                  </div>

                  <div>
                    <span className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2.5px] text-dust">
                      Where do your leads come from?
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {CUSTOMER_SOURCES.map((source) => {
                        const isActive = form.customerSources.includes(source);

                        return (
                          <button
                            key={source}
                            type="button"
                            className={getChipClassName(isActive)}
                            aria-pressed={isActive}
                            onClick={() => toggleMultiSelect("customerSources", source)}
                          >
                            {source}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className={buttonClassNames.secondary}
                      onClick={() => setStep(1)}
                    >
                      Back
                    </button>

                    <button
                      type="button"
                      className={buttonClassNames.primary}
                      onClick={() => setStep(3)}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="space-y-6">
                  <SectionLabel>03 - YOUR TEAM</SectionLabel>

                  <div>
                    <label
                      className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2.5px] text-dust"
                      htmlFor="business-name"
                    >
                      Business name
                    </label>
                    <input
                      id="business-name"
                      type="text"
                      autoComplete="organization"
                      className="w-full rounded-md border border-border bg-parchment px-3.5 py-2.5 font-body text-sm text-pitch outline-none transition-all placeholder:text-dust focus:border-saffron focus:ring-2 focus:ring-saffron/20"
                      value={form.businessName}
                      onChange={(event) => handleBusinessNameChange(event.target.value)}
                    />
                  </div>

                  <fieldset>
                    <legend className="mb-3 block font-mono text-[9px] uppercase tracking-[2.5px] text-dust">
                      Team setup
                    </legend>

                    <div className="space-y-3">
                      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-parchment px-3.5 py-3 font-body text-sm text-pitch">
                        <input
                          type="radio"
                          name="team-mode"
                          className="h-4 w-4 accent-saffron"
                          checked={form.teamMode === "just_me"}
                          onChange={() => handleTeamModeChange("just_me")}
                        />
                        <span>Just me</span>
                      </label>

                      <label className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-parchment px-3.5 py-3 font-body text-sm text-pitch">
                        <input
                          type="radio"
                          name="team-mode"
                          className="h-4 w-4 accent-saffron"
                          checked={form.teamMode === "sales_team"}
                          onChange={() => handleTeamModeChange("sales_team")}
                        />
                        <span>I have a sales team</span>
                      </label>
                    </div>
                  </fieldset>

                  {form.teamMode === "sales_team" ? (
                    <div>
                      <label
                        className="mb-1.5 block font-mono text-[9px] uppercase tracking-[2.5px] text-dust"
                        htmlFor="agent-count"
                      >
                        Number of agents
                      </label>
                      <input
                        id="agent-count"
                        type="number"
                        min={1}
                        inputMode="numeric"
                        className="w-full rounded-md border border-border bg-parchment px-3.5 py-2.5 font-body text-sm text-pitch outline-none transition-all placeholder:text-dust focus:border-saffron focus:ring-2 focus:ring-saffron/20"
                        value={form.agentCount}
                        onChange={(event) => handleAgentCountChange(event.target.value)}
                      />
                    </div>
                  ) : null}

                  {errorMessage ? (
                    <div className="rounded-md border border-ember-border bg-ember px-3.5 py-3 font-body text-sm text-ember-text">
                      {errorMessage}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className={buttonClassNames.secondary}
                      onClick={() => setStep(2)}
                    >
                      Back
                    </button>

                    <button
                      type="submit"
                      className={buttonClassNames.primary}
                      disabled={!canSubmit || isSubmitting}
                    >
                      {isSubmitting ? "Saving..." : "Get started"}
                    </button>
                  </div>
                </div>
              ) : null}
            </form>
          </Card>
        </main>
      </div>
    </div>
  );
}
