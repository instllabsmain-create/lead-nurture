# Start Here
> This file is for you — the developer. Read this first before opening Claude Code.
> Every other file in this folder is for Claude Code only.

---

## What you are building

INSTL.LABS Lead Nurturer — a multi-tenant AI SaaS that connects to a business's Instagram, WhatsApp, Facebook, and website chat. When a lead sends a message, the AI qualifies them, scores them 0–100, and either assigns them to a sales agent or notifies the owner to take over. One platform, infinite clients, zero per-client setup.

---

## Accounts you need to create manually

Claude Code cannot create accounts. Do these yourself before starting:

| Service | URL | What to get |
|---|---|---|
| Supabase | supabase.com | Project URL, anon key, service role key |
| OpenRouter | openrouter.ai | API key |
| Upstash | upstash.com | QStash token + signing keys, Redis URL + token |
| Resend | resend.com | API key |
| Meta Developer | developers.facebook.com | App secret, verify token |
| Vercel | vercel.com | Just an account — CLI handles the rest |
| GitHub | github.com | Just an account — gh CLI handles the rest |

---

## CLIs you need installed

You said you already have these. Confirm before starting:

```bash
node --version        # need 18+
gh --version          # GitHub CLI
supabase --version    # Supabase CLI
vercel --version      # Vercel CLI
```

---

## How to use Claude Code with these docs

1. Open your terminal in the project folder
2. Run `claude`
3. At the start of every session, say:

```
Read claude.md, architecture.md, database.md, and apis.md before doing anything.
```

4. Then give it a specific task from `phases.md`
5. One phase at a time — never skip ahead

---

## File guide — what each doc is for

| File | Purpose | Read it? |
|---|---|---|
| `start-here.md` | This file — your guide | ✅ Yes, you're reading it |
| `claude.md` | Main instructions for Claude Code — rules, setup, constraints | Skim it |
| `architecture.md` | How the system is structured — folders, data flow, tech stack | Skim it |
| `ux.md` | Design system, brand tokens, every UI component | Only if building UI |
| `prd.md` | Full product requirements — what each feature does | Reference only |
| `agents.md` | AI engine, scoring, assignment logic in detail | Only if debugging AI |
| `database.md` | Full schema, migrations, indexes, RLS | Run the SQL in Supabase |
| `phases.md` | Build order — which prompt to give Claude Code next | Use this actively |
| `apis.md` | Every API route — inputs, outputs, errors | Reference when building routes |

---

## Before you start — checklist

- [ ] All 7 accounts created above
- [ ] All API keys and tokens collected
- [ ] CLIs verified (node, gh, supabase, vercel)
- [ ] Read through `phases.md` so you know what's coming
- [ ] Opened `database.md` — ready to paste schema into Supabase SQL editor

---

## The one thing that will break everything if you get it wrong

The Meta webhook verify token and app secret must match exactly what's in your Meta Developer Portal. When you set `META_VERIFY_TOKEN` in your environment, use the same string when configuring the webhook in Meta's dashboard.

Default value we've used everywhere in these docs:
```
META_VERIFY_TOKEN=instl_nurture_verify_9mKx3pQ7
```

You can change it — just make sure it matches in both places.

---

## When Claude Code gets stuck

1. Paste the exact error back into Claude Code
2. Say: `"Fix only this error. Do not change anything else."`
3. If it keeps breaking: say `"Revert this file to before your last change and try a different approach"`
4. Never let Claude Code refactor things that were working — it will break them

---

## Key contact points in the codebase

Once built, these are the most important files to understand:

| File | Why it matters |
|---|---|
| `src/app/api/message/route.ts` | Core pipeline — everything runs through here |
| `src/lib/ai.ts` | AI reply generation |
| `src/lib/score.ts` | Lead scoring |
| `src/lib/assign.ts` | Agent assignment |
| `src/lib/prompts.ts` | All AI prompts — change behaviour here |
| `src/middleware.ts` | Auth guard — touch with care |

---

## Deployment

Everything deploys automatically via Vercel when you push to GitHub.
Local webhook testing requires ngrok:

```bash
npx ngrok http 3000
# Copy the https URL → paste into Meta webhook settings
# Also set NEXT_PUBLIC_APP_URL=https://xxx.ngrok.io in .env.local
```

---

## Questions to ask yourself before starting each phase

1. Are all env vars filled in `.env.local`?
2. Is the Supabase schema pushed?
3. Did the previous phase compile without errors?
4. Did I test the previous phase before moving on?

If any answer is no — do not proceed.
