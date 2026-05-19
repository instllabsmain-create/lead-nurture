import Link from "next/link";

import { LeadScore } from "@/components/leads/lead-score";
import type { LeadStatus, Platform } from "@/types";

interface LeadCardProps {
  id: string;
  name: string | null;
  handle: string | null;
  channel: Platform | null;
  score: number;
  status: LeadStatus;
  lastActive: string;
  preview?: string;
  assignedAgentName?: string | null;
}

const statusStyles: Record<LeadStatus, string> = {
  new: "bg-parchment text-dust",
  engaging: "bg-ember text-ember-text",
  qualified: "bg-saffron text-white",
  unqualified: "bg-parchment text-dust",
  assigned: "bg-pitch text-parchment",
  closed: "bg-parchment text-dust",
};

const channelStyles: Record<Platform, string> = {
  instagram: "bg-[#F0E8F5] text-[#7B2D8B]",
  whatsapp: "bg-[#E8F5EE] text-[#1A7A44]",
  facebook: "bg-[#E8F0F8] text-[#1557A0]",
  website: "bg-parchment text-dust",
};

function getInitials(name: string | null, handle: string | null): string {
  const source = name?.trim() || handle?.trim() || "Lead";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getDisplayName(name: string | null, handle: string | null): string {
  return name?.trim() || handle?.trim() || "Unknown lead";
}

function formatLastActive(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getChannelLabel(channel: Platform): string {
  switch (channel) {
    case "instagram":
      return "Instagram";
    case "whatsapp":
      return "WhatsApp";
    case "facebook":
      return "Facebook";
    case "website":
      return "Website";
  }
}

export function LeadCard({
  id,
  name,
  handle,
  channel,
  score,
  status,
  lastActive,
  preview,
  assignedAgentName,
}: LeadCardProps) {
  return (
    <Link
      href={`/leads/${id}`}
      className="block rounded-xl border border-border bg-white p-4 transition-colors duration-150 hover:bg-parchment"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember font-mono text-[10px] font-medium text-ember-text">
          {getInitials(name, handle)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-body text-sm font-medium text-pitch">
                {getDisplayName(name, handle)}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {channel ? (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${channelStyles[channel]}`}
                  >
                    {getChannelLabel(channel)}
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[9px] ${statusStyles[status]}`}
                >
                  {status}
                </span>
              </div>
            </div>

            <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
              {formatLastActive(lastActive)}
            </div>
          </div>

          <div className="mt-4">
            <LeadScore score={score} />
          </div>

          {preview ? (
            <p className="mt-3 truncate font-body text-xs text-dust">{preview}</p>
          ) : null}

          <div className="mt-3 font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
            {assignedAgentName ? `Assigned to ${assignedAgentName}` : "Unassigned"}
          </div>
        </div>
      </div>
    </Link>
  );
}

export default LeadCard;
