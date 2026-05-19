import { LeadScore } from "@/components/leads/lead-score";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type { LeadStatus, MessageContent, MessageDirection, Platform } from "@/types";

export interface LeadDetailMessage {
  id: string;
  direction: MessageDirection;
  content: MessageContent;
  aiGenerated: boolean;
  sentAt: string;
  channel: Platform;
}

interface LeadDetailProps {
  lead: {
    id: string;
    name: string | null;
    handle: string | null;
    email: string | null;
    phone: string | null;
    score: number;
    status: LeadStatus;
    answers: Record<string, string>;
    tags: string[];
    assignedAgentName: string | null;
    lastActive: string;
  };
  messages: LeadDetailMessage[];
}

const statusStyles: Record<LeadStatus, string> = {
  new: "bg-parchment text-dust",
  engaging: "bg-ember text-ember-text",
  qualified: "bg-saffron text-white",
  unqualified: "bg-parchment text-dust",
  assigned: "bg-pitch text-parchment",
  closed: "bg-parchment text-dust",
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getDisplayName(name: string | null, handle: string | null): string {
  return name?.trim() || handle?.trim() || "Unknown lead";
}

function getMessageText(content: MessageContent): string {
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

export function LeadDetail({ lead, messages }: LeadDetailProps) {
  const answerEntries = Object.entries(lead.answers);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_360px]">
      <Card>
        <SectionLabel>Recent Messages</SectionLabel>
        <div className="mt-4 space-y-3">
          {messages.length === 0 ? (
            <div className="rounded-xl border border-border bg-parchment p-4 font-body text-sm text-dust">
              No recent messages yet.
            </div>
          ) : (
            messages.map((message) => {
              const isOutbound = message.direction === "outbound";

              return (
                <div
                  key={message.id}
                  className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}
                >
                  <div className="max-w-[85%] sm:max-w-[80%]">
                    <div
                      className={[
                        "rounded-2xl px-4 py-3 shadow-sm",
                        isOutbound
                          ? "bg-saffron text-white"
                          : "border border-border bg-parchment text-pitch",
                      ].join(" ")}
                    >
                      {message.aiGenerated ? (
                        <span
                          className={[
                            "mb-2 inline-flex rounded-full px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[1.5px]",
                            isOutbound
                              ? "bg-white/15 text-white"
                              : "bg-ember text-ember-text",
                          ].join(" ")}
                        >
                          AI
                        </span>
                      ) : null}

                      <p className="whitespace-pre-wrap font-body text-sm leading-6">
                        {getMessageText(message.content)}
                      </p>
                    </div>

                    <div
                      className={`mt-1 font-mono text-[9px] uppercase tracking-[1.5px] text-dust ${isOutbound ? "text-right" : "text-left"}`}
                    >
                      {formatDateTime(message.sentAt)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <SectionLabel>Profile</SectionLabel>
          <h1 className="mt-3 font-display text-3xl font-black uppercase text-pitch">
            {getDisplayName(lead.name, lead.handle)}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${statusStyles[lead.status]}`}
            >
              {lead.status}
            </span>
          </div>

          <div className="mt-5">
            <LeadScore score={lead.score} />
          </div>

          <div className="mt-5 space-y-3 font-body text-sm text-pitch">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                Email
              </div>
              <div className="mt-1">{lead.email ?? "Not provided"}</div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                Phone
              </div>
              <div className="mt-1">{lead.phone ?? "Not provided"}</div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                Assigned agent
              </div>
              <div className="mt-1">{lead.assignedAgentName ?? "Unassigned"}</div>
            </div>
            <div>
              <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                Last active
              </div>
              <div className="mt-1">{formatDateTime(lead.lastActive)}</div>
            </div>
          </div>
        </Card>

        <Card>
          <SectionLabel>Answers</SectionLabel>
          <div className="mt-4 space-y-3">
            {answerEntries.length === 0 ? (
              <div className="font-body text-sm text-dust">
                No qualification answers captured yet.
              </div>
            ) : (
              answerEntries.map(([question, answer]) => (
                <div key={question} className="rounded-lg bg-parchment p-3">
                  <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
                    {question}
                  </div>
                  <div className="mt-1 font-body text-sm text-pitch">{answer}</div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <SectionLabel>Tags</SectionLabel>
          <div className="mt-4 flex flex-wrap gap-2">
            {lead.tags.length === 0 ? (
              <div className="font-body text-sm text-dust">No tags yet.</div>
            ) : (
              lead.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-parchment px-3 py-1 font-mono text-[9px] uppercase tracking-[1.5px] text-dust"
                >
                  {tag}
                </span>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default LeadDetail;
