"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";

import { buttonClassNames } from "@/components/ui/button";

interface MessageInputProps {
  leadId: string;
  aiPaused: boolean;
  onConversationChange?: () => Promise<void> | void;
}

interface SendMessageRequest {
  leadId: string;
  message: string;
}

interface AiControlRequest {
  leadId: string;
  paused: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSendResponse(
  payload: unknown,
): { ok: true } | { error: string } {
  if (isRecord(payload) && payload.ok === true) {
    return { ok: true };
  }

  if (isRecord(payload) && typeof payload.error === "string") {
    return { error: payload.error };
  }

  return { error: "Unexpected response from server" };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function MessageInput({
  leadId,
  aiPaused,
  onConversationChange,
}: MessageInputProps) {
  const [draft, setDraft] = useState("");
  const [aiHandlingOverride, setAiHandlingOverride] = useState<boolean | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAiHandling = aiHandlingOverride ?? !aiPaused;

  async function toggleAi(paused: boolean) {
    setIsTogglingAi(true);
    setError(null);

    try {
      const payload: AiControlRequest = { leadId, paused };
      const response = await fetch("/api/ai-control", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to update AI mode");
      }

      setAiHandlingOverride(!paused);

      if (onConversationChange) {
        await onConversationChange();
        setAiHandlingOverride(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update AI mode");
    } finally {
      setIsTogglingAi(false);
    }
  }

  async function sendMessage() {
    const trimmed = draft.trim();

    if (!trimmed || isAiHandling || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const payload: SendMessageRequest = { leadId, message: trimmed };
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = parseSendResponse(await readJson(response));

      if (!response.ok) {
        throw new Error("error" in result ? result.error : "Failed to send message");
      }

      setDraft("");
      await onConversationChange?.();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  const isDisabled = isAiHandling || isSending;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-mono text-[9px] uppercase tracking-[2.5px] text-dust">
          {isAiHandling ? "AI is handling this" : "Human reply mode"}
        </div>

        {isAiHandling ? (
          <button
            type="button"
            disabled={isTogglingAi}
            className={buttonClassNames.ghost}
            onClick={() => void toggleAi(true)}
          >
            {isTogglingAi ? "Updating..." : "Take over from AI"}
          </button>
        ) : (
          <button
            type="button"
            disabled={isTogglingAi}
            className={buttonClassNames.secondary}
            onClick={() => void toggleAi(false)}
          >
            {isTogglingAi ? "Updating..." : "Hand back to AI"}
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-parchment p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          rows={4}
          placeholder={
            isAiHandling ? "AI is handling this conversation." : "Type your reply"
          }
          className="w-full resize-none bg-transparent px-0 py-0 font-body text-sm text-pitch outline-none placeholder:text-dust disabled:cursor-not-allowed disabled:text-dust"
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="font-mono text-[9px] uppercase tracking-[1.5px] text-dust">
            Enter sends · Shift+Enter adds a new line
          </div>

          <button
            type="button"
            onClick={() => { void sendMessage(); }}
            disabled={isDisabled || draft.trim().length === 0}
            className={buttonClassNames.primary}
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="font-body text-xs text-saffron">{error}</p>
      ) : null}
    </div>
  );
}

export default MessageInput;
