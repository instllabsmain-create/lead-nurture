"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";

import { buttonClassNames } from "@/components/ui/button";

interface MessageInputProps {
  leadId: string;
  defaultAiHandling: boolean;
}

interface SendMessageRequest {
  leadId: string;
  message: string;
}

interface SendMessageSuccessResponse {
  ok: true;
}

interface SendMessageErrorResponse {
  error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSendResponse(
  payload: unknown,
): SendMessageSuccessResponse | SendMessageErrorResponse {
  if (isRecord(payload) && payload.ok === true) {
    return { ok: true };
  }

  if (isRecord(payload) && typeof payload.error === "string") {
    return { error: payload.error };
  }

  return { error: "Unexpected response from server" };
}

export function MessageInput({
  leadId,
  defaultAiHandling,
}: MessageInputProps) {
  const [draft, setDraft] = useState("");
  const [isAiHandling, setIsAiHandling] = useState(defaultAiHandling);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage() {
    const trimmed = draft.trim();

    if (!trimmed || isAiHandling || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const payload: SendMessageRequest = {
        leadId,
        message: trimmed,
      };

      const response = await fetch("/api/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = parseSendResponse((await response.json()) as unknown);

      if (!response.ok) {
        throw new Error(
          "error" in result ? result.error : "Failed to send message",
        );
      }

      setDraft("");
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Failed to send message",
      );
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
            className={buttonClassNames.ghost}
            onClick={() => setIsAiHandling(false)}
          >
            Take over from AI
          </button>
        ) : (
          <button
            type="button"
            className={buttonClassNames.secondary}
            onClick={() => setIsAiHandling(true)}
          >
            Hand back to AI
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
            onClick={() => {
              void sendMessage();
            }}
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
