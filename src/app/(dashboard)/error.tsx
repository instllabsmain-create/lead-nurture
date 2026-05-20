"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-parchment flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <p className="font-mono text-[9px] uppercase tracking-[2.5px] text-dust mb-4">
          INSTL.LABS / error
        </p>
        <h1 className="font-display font-black text-4xl uppercase text-pitch mb-3">
          Something broke.
        </h1>
        <p className="font-body text-sm text-dust mb-2">
          {error.message ?? "An unexpected error occurred."}
        </p>
        {error.digest && (
          <p className="font-mono text-[10px] text-dust/60 mb-6">
            Digest: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="px-5 py-2.5 bg-saffron text-white rounded-md font-body text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
