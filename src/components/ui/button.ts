export const buttonClassNames = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-saffron px-5 py-2.5 font-body text-sm font-medium text-white transition-all duration-150 hover:bg-saffron-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-white px-5 py-2.5 font-body text-sm text-dust transition-all duration-150 hover:bg-parchment hover:text-pitch active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
  ghost:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-saffron bg-transparent px-5 py-2.5 font-body text-sm font-medium text-saffron transition-all duration-150 hover:bg-ember active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45",
} as const;

export type ButtonVariant = keyof typeof buttonClassNames;
