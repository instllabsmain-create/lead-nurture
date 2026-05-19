import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      colors: {
        saffron: "#E8640C",
        "saffron-hover": "#CC550A",
        pitch: "#0A0A09",
        parchment: "#F4F1EC",
        dust: "#7B7673",
        ember: "#FEF3EE",
        "ember-border": "#F0DDD1",
        "ember-text": "#B84E09",
        border: "#E8E6E1",
      },
    },
  },
  plugins: [],
};

export default config;
