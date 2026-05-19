export type Platform = "instagram" | "whatsapp" | "facebook" | "website";
export type LeadStatus =
  | "new"
  | "engaging"
  | "qualified"
  | "unqualified"
  | "assigned"
  | "closed";
export type MessageDirection = "inbound" | "outbound";
export type BroadcastStatus = "draft" | "scheduled" | "sending" | "sent";
export type RoutingType =
  | "human_handoff"
  | "agent_assignment"
  | "round_robin";
export type NotifyVia = "whatsapp" | "email";
export type RoutingFallback = "reassign" | "notify_owner";
export type AILanguage = "en" | "hi" | "hinglish" | "auto";
export type TeamMode = "just_me" | "sales_team";

export interface RoutingConfig {
  type: RoutingType;
  assignment_threshold?: number;
  handoff_triggers?: string[];
  notify_via?: NotifyVia[];
  accept_timeout_minutes?: number;
  fallback?: RoutingFallback;
}

export interface AIConfig {
  system_prompt?: string;
  model?: string;
  language?: AILanguage;
  response_delay_seconds?: number;
}

export interface ScoringConfig {
  question_answered?: number;
  buying_signal?: number;
  urgency_signal?: number;
  negative_signal?: number;
}

export interface TeamConfig {
  mode: TeamMode;
  agent_count?: number;
}

export interface ClientConfig {
  business_name?: string;
  business_description?: string;
  business_type?: string[];
  ideal_customer?: string;
  customer_sources?: string[];
  qualification_questions?: string[];
  scoring?: ScoringConfig;
  routing?: RoutingConfig;
  ai?: AIConfig;
  disabled_features?: string[];
  team?: TeamConfig;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email: string;
  plan: string;
  onboarding_completed: boolean;
  config: ClientConfig;
  created_at: string;
}

export interface Channel {
  id: string;
  client_id: string;
  type: Platform;
  account_id: string | null;
  account_name: string | null;
  access_token: string | null;
  status: "active" | "expired" | "disconnected";
  connected_at: string;
}

export interface Agent {
  id: string;
  client_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  territories: string[];
  specialities: string[];
  max_leads: number;
  active_leads: number;
  is_available: boolean;
  working_hours: Record<string, { start: number; end: number }>;
  created_at: string;
}

export interface Lead {
  id: string;
  client_id: string;
  channel_id: string | null;
  platform_id: string;
  name: string | null;
  handle: string | null;
  avatar: string | null;
  phone: string | null;
  email: string | null;
  score: number;
  status: LeadStatus;
  answers: Record<string, string>;
  tags: string[];
  assigned_agent_id: string | null;
  assigned_at: string | null;
  first_seen: string;
  last_active: string;
}

export interface MessageContent {
  type: "text" | "image" | "audio";
  text?: string;
  url?: string;
}

export interface Message {
  id: string;
  client_id: string;
  lead_id: string;
  direction: MessageDirection;
  channel: Platform;
  content: MessageContent;
  ai_generated: boolean;
  sent_at: string;
}

export interface KnowledgeBase {
  id: string;
  client_id: string;
  title: string | null;
  content: string;
  created_at: string;
}

export interface FollowUp {
  id: string;
  client_id: string;
  lead_id: string;
  message: string;
  scheduled_at: string;
  sent: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface Broadcast {
  id: string;
  client_id: string;
  name: string | null;
  channel: Platform;
  message_template: string | null;
  audience: {
    status?: LeadStatus[];
    score_min?: number;
    tags?: string[];
    all?: boolean;
  };
  status: BroadcastStatus;
  scheduled_at: string | null;
  sent_count: number;
  created_at: string;
}

export interface NormalisedMessage {
  client_id?: string;
  channel: Platform;
  direction: MessageDirection;
  from: {
    id: string;
    name?: string;
    handle?: string;
  };
  to: {
    id: string;
  };
  content: MessageContent;
  timestamp: string;
  raw: Record<string, unknown>;
}
