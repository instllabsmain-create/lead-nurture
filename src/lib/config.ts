import type {
  AIConfig,
  AILanguage,
  ClientConfig,
  NotifyVia,
  RoutingConfig,
  RoutingFallback,
  RoutingType,
  ScoringConfig,
  TeamConfig,
  TeamMode,
} from "@/types";

interface DefaultClientConfig {
  qualification_questions: string[];
  scoring: Required<ScoringConfig>;
  routing: {
    type: RoutingType;
    assignment_threshold: number;
    handoff_triggers: string[];
    notify_via: NotifyVia[];
    accept_timeout_minutes: number;
    fallback: RoutingFallback;
  };
  ai: {
    model: string;
    language: AILanguage;
    response_delay_seconds: number;
  };
  disabled_features: string[];
}

export const DEFAULT_CONFIG: DefaultClientConfig = {
  qualification_questions: [
    "What product or service are you looking for?",
    "What is your budget range?",
    "When are you looking to get started?",
    "Where are you located?",
  ],
  scoring: {
    question_answered: 10,
    buying_signal: 15,
    urgency_signal: 20,
    negative_signal: -20,
  },
  routing: {
    type: "human_handoff",
    assignment_threshold: 70,
    handoff_triggers: ["talk to someone", "human", "call me", "speak to"],
    notify_via: ["whatsapp"],
    accept_timeout_minutes: 10,
    fallback: "notify_owner",
  },
  ai: {
    model: "google/gemini-2.5-flash-lite",
    language: "auto",
    response_delay_seconds: 0,
  },
  disabled_features: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getRoutingType(value: unknown): RoutingType | undefined {
  if (
    value === "human_handoff" ||
    value === "agent_assignment" ||
    value === "round_robin"
  ) {
    return value;
  }

  return undefined;
}

function getNotifyVia(value: unknown): NotifyVia[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter(
    (item): item is NotifyVia => item === "whatsapp" || item === "email",
  );
}

function getRoutingFallback(value: unknown): RoutingFallback | undefined {
  if (value === "reassign" || value === "notify_owner") {
    return value;
  }

  return undefined;
}

function getAILanguage(value: unknown): AILanguage | undefined {
  if (value === "en" || value === "hi" || value === "hinglish" || value === "auto") {
    return value;
  }

  return undefined;
}

function getTeamMode(value: unknown): TeamMode | undefined {
  if (value === "just_me" || value === "sales_team") {
    return value;
  }

  return undefined;
}

function getScoringConfig(value: unknown): Required<ScoringConfig> {
  const scoring = isRecord(value) ? value : {};

  return {
    question_answered:
      getOptionalNumber(scoring.question_answered) ??
      DEFAULT_CONFIG.scoring.question_answered,
    buying_signal:
      getOptionalNumber(scoring.buying_signal) ?? DEFAULT_CONFIG.scoring.buying_signal,
    urgency_signal:
      getOptionalNumber(scoring.urgency_signal) ?? DEFAULT_CONFIG.scoring.urgency_signal,
    negative_signal:
      getOptionalNumber(scoring.negative_signal) ??
      DEFAULT_CONFIG.scoring.negative_signal,
  };
}

function getRoutingConfig(value: unknown): Required<RoutingConfig> {
  const routing = isRecord(value) ? value : {};

  return {
    type: getRoutingType(routing.type) ?? DEFAULT_CONFIG.routing.type,
    assignment_threshold:
      getOptionalNumber(routing.assignment_threshold) ??
      DEFAULT_CONFIG.routing.assignment_threshold,
    handoff_triggers:
      getStringArray(routing.handoff_triggers) ??
      [...DEFAULT_CONFIG.routing.handoff_triggers],
    notify_via:
      getNotifyVia(routing.notify_via) ?? [...DEFAULT_CONFIG.routing.notify_via],
    accept_timeout_minutes:
      getOptionalNumber(routing.accept_timeout_minutes) ??
      DEFAULT_CONFIG.routing.accept_timeout_minutes,
    fallback: getRoutingFallback(routing.fallback) ?? DEFAULT_CONFIG.routing.fallback,
  };
}

function getAIConfig(value: unknown): AIConfig {
  const ai = isRecord(value) ? value : {};

  return {
    system_prompt: getOptionalString(ai.system_prompt),
    model: getOptionalString(ai.model) ?? DEFAULT_CONFIG.ai.model,
    language: getAILanguage(ai.language) ?? DEFAULT_CONFIG.ai.language,
    response_delay_seconds:
      getOptionalNumber(ai.response_delay_seconds) ??
      DEFAULT_CONFIG.ai.response_delay_seconds,
  };
}

function getTeamConfig(value: unknown): TeamConfig {
  const team = isRecord(value) ? value : {};
  const mode = getTeamMode(team.mode) ?? "just_me";
  const agentCount = getOptionalNumber(team.agent_count);

  if (mode === "sales_team" && agentCount && agentCount > 0) {
    return {
      mode,
      agent_count: agentCount,
    };
  }

  return {
    mode,
  };
}

export function getClientConfig(clientConfig: unknown): ClientConfig {
  const config = isRecord(clientConfig) ? clientConfig : {};

  return {
    business_name: getOptionalString(config.business_name) ?? "",
    business_description: getOptionalString(config.business_description) ?? "",
    business_type: getStringArray(config.business_type) ?? [],
    ideal_customer: getOptionalString(config.ideal_customer) ?? "",
    customer_sources: getStringArray(config.customer_sources) ?? [],
    qualification_questions:
      getStringArray(config.qualification_questions) ??
      [...DEFAULT_CONFIG.qualification_questions],
    scoring: getScoringConfig(config.scoring),
    routing: getRoutingConfig(config.routing),
    ai: getAIConfig(config.ai),
    disabled_features:
      getStringArray(config.disabled_features) ?? [...DEFAULT_CONFIG.disabled_features],
    team: getTeamConfig(config.team),
  };
}
