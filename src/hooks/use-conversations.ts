"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { ConversationListItem } from "@/components/inbox/conversation-list";
import type {
  ConversationThreadLead,
  ConversationThreadMessage,
} from "@/components/inbox/conversation-thread";

interface UseConversationsOptions {
  clientId: string;
  initialConversations: ConversationListItem[];
  activeLeadId?: string;
  initialLead?: ConversationThreadLead | null;
  initialMessages?: ConversationThreadMessage[];
}

interface UseConversationsResult {
  conversations: ConversationListItem[];
  selectedLead: ConversationThreadLead | null;
  messages: ConversationThreadMessage[];
  refresh: () => Promise<void>;
  isRefreshing: boolean;
}

interface InboxSnapshot {
  conversations: ConversationListItem[];
  selectedLead: ConversationThreadLead | null;
  messages: ConversationThreadMessage[];
}

const POLL_INTERVAL_MS = 15000;

function getInboxSnapshotUrl(activeLeadId?: string): string {
  if (!activeLeadId) {
    return "/api/inbox";
  }

  const params = new URLSearchParams({ leadId: activeLeadId });
  return `/api/inbox?${params.toString()}`;
}

export function useConversations({
  clientId,
  initialConversations,
  activeLeadId,
  initialLead = null,
  initialMessages = [],
}: UseConversationsOptions): UseConversationsResult {
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedLead, setSelectedLead] = useState<ConversationThreadLead | null>(
    initialLead,
  );
  const [messages, setMessages] = useState(initialMessages);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, startTransition] = useTransition();
  const inFlightRequestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    inFlightRequestRef.current?.abort();

    const controller = new AbortController();
    inFlightRequestRef.current = controller;
    setIsRefreshing(true);

    try {
      const response = await fetch(getInboxSnapshotUrl(activeLeadId), {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        return;
      }

      const snapshot = (await response.json()) as InboxSnapshot;

      if (controller.signal.aborted) {
        return;
      }

      startTransition(() => {
        setConversations(snapshot.conversations);
        setSelectedLead(snapshot.selectedLead);
        setMessages(snapshot.messages);
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        // Keep the current UI state if polling fails.
      }
    } finally {
      if (inFlightRequestRef.current === controller) {
        inFlightRequestRef.current = null;
        setIsRefreshing(false);
      }
    }
  }, [activeLeadId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, POLL_INTERVAL_MS);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      inFlightRequestRef.current?.abort();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clientId, refresh]);

  return {
    conversations,
    selectedLead,
    messages,
    refresh,
    isRefreshing,
  };
}
