"use client";

import { useState } from "react";

import { buttonClassNames } from "@/components/ui/button";

interface CopyButtonProps {
  value: string;
}

export function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleCopy();
      }}
      className={buttonClassNames.secondary}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default CopyButton;
