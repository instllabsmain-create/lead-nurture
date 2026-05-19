export const buttonClassNames = {
  primary:
    "inline-flex items-center gap-2 rounded-md bg-saffron px-5 py-2.5 font-body text-sm font-medium text-white transition-all duration-150 hover:bg-saffron-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40",
  secondary:
    "inline-flex items-center gap-2 rounded-md border border-border bg-white px-5 py-2.5 font-body text-sm text-dust transition-all duration-150 hover:bg-parchment active:scale-[0.98]",
  ghost:
    "inline-flex items-center gap-2 rounded-md border border-saffron bg-transparent px-5 py-2.5 font-body text-sm font-medium text-saffron transition-all duration-150 hover:bg-ember active:scale-[0.98]",
} as const;

export type ButtonVariant = keyof typeof buttonClassNames;
