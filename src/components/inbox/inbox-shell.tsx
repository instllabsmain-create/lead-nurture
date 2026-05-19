"use client";

import {
  ConversationList,
  type ConversationListItem,
} from "@/components/inbox/conversation-list";
import {
  ConversationThread,
  type ConversationThreadLead,
  type ConversationThreadMessage,
} from "@/components/inbox/conversation-thread";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { useConversations } from "@/hooks/use-conversations";

interface InboxShellProps {
  clientId: string;
  initialConversations: ConversationListItem[];
  activeLeadId?: string;
  initialLead?: ConversationThreadLead | null;
  initialMessages?: ConversationThreadMessage[];
}

export function InboxShell({
  clientId,
  initialConversations,
  activeLeadId,
  initialLead = null,
  initialMessages = [],
}: InboxShellProps) {
  const { conversations, selectedLead, messages } = useConversations({
    clientId,
    initialConversations,
    activeLeadId,
    initialLead,
    initialMessages,
  });

  return (
    <div className="bg-parchment p-4 lg:p-6">
      <div className="grid min-h-[calc(100vh-2rem)] overflow-hidden rounded-xl border border-border bg-white lg:grid-cols-[280px_minmax(0,1fr)]">
        <ConversationList
          conversations={conversations}
          activeLeadId={activeLeadId}
        />

        {selectedLead ? (
          <ConversationThread lead={selectedLead} messages={messages} />
        ) : (
          <div className="flex items-center justify-center border-t border-border bg-parchment p-6 lg:border-t-0">
            <Card>
              <SectionLabel>Conversation</SectionLabel>
              <h1 className="mt-3 font-display text-3xl font-black uppercase text-pitch">
                Select A Lead.
              </h1>
              <p className="mt-3 max-w-md font-body text-sm leading-6 text-dust">
                Pick a conversation from the list to review AI replies, score,
                and hand off the thread to a human when needed.
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default InboxShell;
