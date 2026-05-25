"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-parchment px-6">
      <div className="w-full max-w-md rounded-3xl border border-border bg-white/90 p-8 shadow-[0_24px_80px_rgba(41,28,16,0.08)]">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[2.5px] text-dust">
          INSTL.LABS
        </p>
        <h1 className="mb-3 font-display text-4xl font-black uppercase text-pitch">
          We could not load this screen.
        </h1>
        <p className="mb-2 font-body text-sm leading-6 text-dust">
          Try again. If the issue keeps happening, share the reference below with support.
        </p>
        {error.digest && (
          <p className="mb-6 rounded-md bg-parchment px-3 py-2 font-mono text-[10px] text-dust">
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-saffron px-5 py-2.5 font-body text-sm font-medium text-white transition-colors hover:bg-saffron-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
