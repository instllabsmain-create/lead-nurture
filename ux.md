# UX
> Design system, brand tokens, and every UI component pattern.
> Follow this exactly. No deviations on color or typography.

---

## Brand

**Name:** INSTL.LABS
**Wordmark rendering:**
```tsx
<span className="font-display font-black text-xl uppercase tracking-tight text-pitch">
  INSTL<span className="text-saffron">.</span>LABS
</span>
```
The dot is always saffron. Always uppercase. Never change the typeface.

---

## Font installation

```typescript
// src/app/layout.tsx
import { Barlow_Condensed, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'

const barlowCondensed = Barlow_Condensed({
  weight: ['600', '700', '800', '900'],
  subsets: ['latin'],
  variable: '--font-display',
})
const ibmPlexSans = IBM_Plex_Sans({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  variable: '--font-body',
})
const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-mono',
})
// Apply to <body>:
// className={`${barlowCondensed.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
```

---

## Tailwind config

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        saffron: '#E8640C',
        'saffron-hover': '#CC550A',
        pitch: '#0A0A09',
        parchment: '#F4F1EC',
        dust: '#7B7673',
        ember: '#FEF3EE',
        'ember-border': '#F0DDD1',
        'ember-text': '#B84E09',
        border: '#E8E6E1',
      },
    },
  },
  plugins: [],
}
export default config
```

---

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `saffron` | #E8640C | ONLY accent — buttons, active states, focus rings, progress |
| `saffron-hover` | #CC550A | Button hover |
| `pitch` | #0A0A09 | Primary text |
| `parchment` | #F4F1EC | Page background |
| `dust` | #7B7673 | Secondary text, labels |
| `ember` | #FEF3EE | Tint — chips, avatars, active nav |
| `ember-border` | #F0DDD1 | Borders on ember elements |
| `ember-text` | #B84E09 | Text on ember backgrounds |
| `border` | #E8E6E1 | All default borders |

**Rules:**
- Saffron is the ONLY accent. No green. No blue. No purple.
- No gradients anywhere.
- Page background is always `bg-parchment`.
- Cards are always `bg-white`.

---

## Typography rules

- `font-display` (Barlow Condensed) — headings only, always UPPERCASE
- `font-body` (IBM Plex Sans) — all body copy, UI text, descriptions
- `font-mono` (IBM Plex Mono) — all labels, IDs, timestamps, data, metadata

---

## Component library

### Page background
```tsx
<div className="min-h-screen bg-parchment">
```

### Card
```tsx
<div className="bg-white border border-border rounded-xl p-5">
```

### Section label
```tsx
<div className="font-mono text-[9px] uppercase tracking-[2.5px] text-dust">
  Section name
</div>
```

### Primary button
```tsx
<button className="inline-flex items-center gap-2 px-5 py-2.5
  bg-saffron text-white rounded-md
  font-body text-sm font-medium
  hover:bg-saffron-hover active:scale-[0.98]
  transition-all duration-150
  disabled:opacity-40 disabled:cursor-not-allowed">
```

### Secondary button
```tsx
<button className="inline-flex items-center gap-2 px-5 py-2.5
  bg-white text-dust rounded-md
  border border-border font-body text-sm
  hover:bg-parchment active:scale-[0.98]
  transition-all duration-150">
```

### Ghost button
```tsx
<button className="inline-flex items-center gap-2 px-5 py-2.5
  bg-transparent text-saffron rounded-md
  border border-saffron font-body text-sm font-medium
  hover:bg-ember active:scale-[0.98]
  transition-all duration-150">
```

### Input label
```tsx
<label className="block font-mono text-[9px] uppercase tracking-[2.5px] text-dust mb-1.5">
```

### Text input
```tsx
<input className="w-full px-3.5 py-2.5
  font-body text-sm text-pitch
  bg-parchment border border-border rounded-md outline-none
  focus:ring-2 focus:ring-saffron/20 focus:border-saffron
  placeholder:text-dust transition-all" />
```

### Textarea
```tsx
<textarea className="w-full px-3.5 py-2.5
  font-body text-sm text-pitch
  bg-parchment border border-border rounded-md
  outline-none resize-none
  focus:ring-2 focus:ring-saffron/20 focus:border-saffron
  placeholder:text-dust transition-all" />
```

### Chip — inactive
```tsx
<button className="px-3 py-1.5 rounded-full
  font-body text-xs border border-border
  text-dust bg-white
  hover:border-saffron hover:text-saffron
  transition-all duration-150">
```

### Chip — active
```tsx
<button className="px-3 py-1.5 rounded-full
  font-body text-xs border border-saffron
  text-ember-text bg-ember
  transition-all duration-150">
```

### Avatar
```tsx
<div className="w-8 h-8 rounded-full bg-ember
  flex items-center justify-center
  font-mono text-[10px] font-medium text-ember-text flex-shrink-0">
  AK
</div>
```
Avatar initials: first letter of first name + first letter of last name, UPPERCASE.

### Score badge
```tsx
// Hot (score > 80)
<span className="px-2 py-0.5 rounded-full bg-saffron text-white font-mono text-[9px]">
  {score}
</span>

// Warm (score 50–80)
<span className="px-2 py-0.5 rounded-full bg-ember text-ember-text font-mono text-[9px]">
  {score}
</span>

// Cold (score < 50)
<span className="px-2 py-0.5 rounded-full bg-parchment text-dust font-mono text-[9px]">
  {score}
</span>
```

### Status badge
```tsx
const statusStyles = {
  new:          'bg-parchment text-dust',
  engaging:     'bg-ember text-ember-text',
  qualified:    'bg-saffron text-white',
  unqualified:  'bg-parchment text-dust',
  assigned:     'bg-pitch text-parchment',
  closed:       'bg-parchment text-dust',
}
<span className={`px-2 py-0.5 rounded-full font-mono text-[9px] ${statusStyles[status]}`}>
  {status}
</span>
```

### Channel badge
```tsx
const channelStyles = {
  instagram: 'bg-[#F0E8F5] text-[#7B2D8B]',
  whatsapp:  'bg-[#E8F5EE] text-[#1A7A44]',
  facebook:  'bg-[#E8F0F8] text-[#1557A0]',
  website:   'bg-parchment text-dust',
}
<span className={`px-2 py-0.5 rounded-full font-mono text-[9px] ${channelStyles[channel]}`}>
  {channel}
</span>
```

### Stat card
```tsx
<div className="bg-parchment rounded-lg p-3">
  <div className="font-display font-black text-3xl text-pitch leading-none">{value}</div>
  <div className="font-mono text-[8px] uppercase tracking-[2px] text-dust mt-1">{label}</div>
  <div className="font-body text-[11px] text-saffron mt-1">{sub}</div>
</div>
```

### Usage bar
```tsx
<div>
  <div className="font-mono text-[8px] uppercase tracking-[2px] text-dust mb-1.5">
    {label}
  </div>
  <div className="h-[3px] bg-border rounded-full overflow-hidden">
    <div className="h-full bg-saffron rounded-full" style={{ width: `${pct}%` }} />
  </div>
  <div className="font-mono text-[9px] text-dust mt-1">{used} of {limit}</div>
</div>
```

### Loading dots
```tsx
<div className="flex gap-1.5">
  {[0, 1, 2].map(i => (
    <div key={i}
      className="w-1.5 h-1.5 rounded-full bg-saffron animate-bounce"
      style={{ animationDelay: `${i * 0.15}s` }}
    />
  ))}
</div>
```

### Lead card
```tsx
<div className="flex items-center gap-3 p-3
  border border-border rounded-lg bg-white cursor-pointer
  hover:border-saffron transition-all duration-150">
  <div className="w-8 h-8 rounded-full bg-ember flex items-center justify-center
    font-mono text-[10px] font-medium text-ember-text flex-shrink-0">
    {initials}
  </div>
  <div className="flex-1 min-w-0">
    <div className="font-body text-sm font-medium text-pitch truncate">{name}</div>
    <div className="font-body text-xs text-dust truncate">{meta}</div>
  </div>
  <scoreBadge />
</div>
```

### Message bubble — inbound
```tsx
<div className="flex gap-3 mb-4">
  <avatar />
  <div className="max-w-[70%] bg-white border border-border
    rounded-2xl rounded-tl-sm px-4 py-2.5">
    <p className="font-body text-sm text-pitch leading-relaxed">{text}</p>
    <p className="font-mono text-[9px] text-dust mt-1.5">{timeAgo}</p>
  </div>
</div>
```

### Message bubble — outbound
```tsx
<div className="flex gap-3 mb-4 justify-end">
  <div className="max-w-[70%] bg-saffron rounded-2xl rounded-tr-sm px-4 py-2.5">
    <p className="font-body text-sm text-white leading-relaxed">{text}</p>
    <div className="flex items-center gap-2 mt-1.5 justify-end">
      {ai_generated && (
        <span className="font-mono text-[8px] text-white/60">AI</span>
      )}
      <span className="font-mono text-[9px] text-white/60">{timeAgo}</span>
    </div>
  </div>
</div>
```

### Sidebar nav item — inactive
```tsx
<div className="flex items-center gap-2.5 px-3 py-2 rounded-md
  font-body text-sm text-dust cursor-pointer
  hover:bg-parchment hover:text-pitch transition-all">
```

### Sidebar nav item — active
```tsx
<div className="flex items-center gap-2.5 px-3 py-2 rounded-md
  font-body text-sm font-medium text-ember-text bg-ember cursor-pointer">
```

### Toast
```tsx
// Fixed bottom-right, 3 second auto-dismiss
<div className="fixed bottom-6 right-6 bg-pitch text-parchment
  font-mono text-sm px-4 py-2 rounded-md z-50
  animate-fade-in">
  Saved.
</div>
```

### Empty state
```tsx
<div className="text-center py-12 px-6">
  <div className="font-display font-bold text-lg uppercase tracking-wide text-pitch mb-2">
    {title}
  </div>
  <div className="font-body text-sm text-dust mb-5">{description}</div>
  <primaryButton />
</div>
```

---

## Page specs

### Login
- Full screen `bg-parchment`
- Content left-aligned (not centered), right half empty
- Wordmark top left
- Display heading: `"NURTURE YOUR LEADS."`
- Subtext: `"AI replies to every message. You close the deals."`
- One button: `"Continue with Google"`

### Onboarding
- `bg-parchment`, max-width 480px centered
- 3 progress line segments at top (saffron = complete)
- Step label in `font-mono text-[9px] uppercase tracking-[3px] text-dust`
- Heading in `font-display font-bold text-2xl uppercase`
- Chips for multi-select throughout

### Sidebar
- 200px fixed, `bg-white border-r border-border`
- Wordmark at top
- Nav items in order: Dashboard, Inbox (with unread count), Leads, Broadcasts, Agents, Channels, Knowledge Base, Settings
- Usage bar at bottom
- Settings pinned to very bottom

### Inbox
- Split: 280px list (bg-white) + flex-1 thread (bg-parchment)
- List has filter tabs: All / Unread / Assigned / Qualified
- Active conversation: `border-l-2 border-saffron`
- Thread auto-scrolls to bottom

---

## Voice & tone

| Write | Not |
|---|---|
| "20 leads found." | "We found 20 amazing leads for you!" |
| "2 searches left." | "You have 2 remaining credits." |
| "AI is handling this." | "Our AI system is managing this conversation." |
| "Something went wrong. Try again." | "An unexpected error has occurred." |
| "No leads yet." | "It looks like you haven't received any messages!" |

Rules:
- No exclamation marks in UI
- No "AI-powered" in labels
- Errors tell users what to do
- Max one sentence per label or hint

---

## Rules for UI code

1. `'use client'` at top of every client component
2. Never fetch data in client components — receive as props from server components
3. `font-display`, `font-body`, `font-mono` always — never `font-sans`
4. `bg-parchment` for all page backgrounds
5. `bg-white` for all cards
6. Saffron is the only accent — nothing else for interactive elements
7. All interactive elements: `active:scale-[0.98] transition-all duration-150`
8. Loading state: saffron bouncing dots — never a spinner
9. AI messages always have the `AI` label
10. Channel badges use channel-specific muted colors — not saffron
