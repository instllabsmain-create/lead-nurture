# Testing Patterns

**Analysis Date:** 2026-05-23

## Test Framework

**Runner:**
- Not detected.
- Config: Not detected. No `vitest.config.*`, `jest.config.*`, `playwright.config.*`, or `cypress.config.*` file exists at repo root.

**Assertion Library:**
- Not detected.

**Run Commands:**
```bash
npm run lint                      # Only package-level quality command in `package.json`
# No `test` script is configured in `package.json`
# No watch-mode script is configured
# No coverage command is configured
```

## Test File Organization

**Location:**
- No in-repo test files were found. Searches for `*.test.*`, `*.spec.*`, and `__tests__/` returned no matches under `/Users/kartik/Downloads/Lead Nurture/instl-nurture`.
- There is no dedicated `tests/` or `src/test/` directory.

**Naming:**
- Not established by existing files.
- To match the current structure, add future tests adjacent to the module they exercise, for example `src/lib/config.test.ts`, `src/hooks/use-realtime.test.ts`, `src/app/api/send/route.test.ts`, or `src/components/inbox/conversation-thread.test.tsx`.

**Structure:**
```text
Not applicable in the current tree.
No co-located tests, no __tests__ directory, and no dedicated test workspace exist.
```

## Test Structure

**Suite Organization:**
```ts
// No in-repo example exists yet.
// Mirror the source path when adding tests:
// `src/lib/config.ts` -> `src/lib/config.test.ts`
// `src/app/api/message/route.ts` -> `src/app/api/message/route.test.ts`
```

**Patterns:**
- No shared setup, teardown, or assertion conventions are established because no test runner is configured.
- The codebase is easiest to test in layers:
  - Pure helpers in `src/lib/config.ts`, `src/lib/normalise.ts`, and `src/hooks/use-realtime.ts`.
  - Data loaders in `src/app/(dashboard)/inbox/_data.ts`.
  - API routes in `src/app/api/send/route.ts`, `src/app/api/ai-control/route.ts`, `src/app/api/followup/route.ts`, and `src/app/api/message/route.ts`.
  - Server actions co-located in `src/app/(dashboard)/agents/page.tsx`, `src/app/(dashboard)/channels/page.tsx`, `src/app/(dashboard)/knowledge/page.tsx`, and `src/app/(dashboard)/settings/page.tsx`.

## Mocking

**Framework:** Not detected

**Patterns:**
```ts
// No in-repo mocking pattern exists.
// The natural seams are external boundaries:
// - `@/lib/supabase/server`
// - `@/lib/supabase/client`
// - `@clerk/nextjs/server`
// - `@/lib/channels`
// - `@/lib/ai`
// - `fetch`
// - `@upstash/qstash`
```

**What to Mock:**
- Mock Clerk identity lookups when testing `src/lib/active-client.ts`.
- Mock Supabase clients for route handlers and server actions in `src/app/api/` and `src/app/(dashboard)/**/page.tsx`.
- Mock channel adapters and third-party senders when testing `src/lib/channels/index.ts`, `src/app/api/send/route.ts`, `src/app/api/message/route.ts`, and `src/lib/notify.ts`.
- Mock `fetch` for webhook forwarding in `src/app/api/webhook/website/route.ts` and `src/lib/meta-webhook.ts`.
- Mock `Receiver.verify(...)` for `src/app/api/followup/route.ts`.

**What NOT to Mock:**
- Do not mock pure parsing and shaping helpers in `src/lib/config.ts`, `src/lib/normalise.ts`, `src/hooks/use-realtime.ts`, `src/app/(dashboard)/dashboard/page.tsx`, or `src/app/(dashboard)/inbox/_data.ts`; test those with real inputs and expected outputs.
- Do not mock simple UI wrappers such as `src/components/ui/card.tsx`, `src/components/ui/section-label.tsx`, or `src/components/ui/button.ts`; they are better covered via rendering assertions if component tests are added.

## Fixtures and Factories

**Test Data:**
```ts
// No in-repo fixtures or factories exist.
// Add small local factories near the first tests that need them:
// - leadFactory for `src/types/index.ts` Lead shapes
// - messageFactory for `src/types/index.ts` Message shapes
// - clientConfigFactory for `src/lib/config.ts`
```

**Location:**
- Not established.
- If fixtures become shared across multiple suites, create them under a dedicated helper path such as `src/test/` or `src/testing/` and keep the directory mirrored to the domain types in `src/types/index.ts`.

## Coverage

**Requirements:** None enforced

**View Coverage:**
```bash
# Not available. No coverage tool or script is configured.
```

**Current Posture:**
- There are no automated tests and no coverage thresholds.
- There are no GitHub workflow files under `.github/workflows/`, so no CI test gate is present in the repository.
- The only existing quality gate is linting through `package.json`.
- A direct lint execution on the current tree reports two warnings:
  - `src/lib/normalise.ts` has an unused `getRequiredArrayItem` helper.
  - `.agents/skills/clerk-tanstack-patterns/templates/tanstack-basic-auth/src/routes/__root.tsx` is linted because the repo-level `eslint` command is broader than the app source tree.

## Test Types

**Unit Tests:**
- Not used.
- Highest-value first targets are pure or mostly pure modules such as `src/lib/config.ts`, `src/lib/normalise.ts`, `src/lib/score.ts`, `src/lib/prompts.ts`, and the payload parsers in `src/hooks/use-realtime.ts`.

**Integration Tests:**
- Not used.
- Highest-value integration targets are API handlers with branching behavior and side effects:
  - `src/app/api/send/route.ts`
  - `src/app/api/ai-control/route.ts`
  - `src/app/api/followup/route.ts`
  - `src/app/api/message/route.ts`
  - `src/app/api/webhook/website/route.ts`
  - `src/lib/meta-webhook.ts`

**E2E Tests:**
- Not used.
- No Playwright or Cypress configuration is present.
- The dashboard flow would need end-to-end coverage across auth, inbox polling, realtime updates, and form-driven server actions in `src/app/(dashboard)/`.

## Common Patterns

**Async Testing:**
```ts
// No in-repo example exists.
// Future async tests need to await:
// - route handlers in `src/app/api/**/route.ts`
// - server data loaders like `loadInboxData`
// - realtime parsing callbacks in `src/hooks/use-realtime.ts`
```

**Error Testing:**
```ts
// No in-repo example exists.
// Future error-path coverage should assert:
// - 400/403/404/500 `Response.json(...)` branches in `src/app/api/`
// - silent `return` on invalid FormData in dashboard server actions
// - tolerant `{ ok: true }` responses in webhook-style paths such as `src/app/api/message/route.ts`
```

## How to Add Tests

- Add a real test runner to `package.json` before adding isolated test files. No runner choice is established in the current repo.
- Mirror source paths so tests remain easy to locate from the module being edited.
- Start with the highest-signal seams:
  - `src/lib/config.ts` for config sanitization.
  - `src/lib/normalise.ts` for webhook payload normalization.
  - `src/lib/active-client.ts` for Clerk-to-client resolution logic.
  - `src/app/(dashboard)/inbox/_data.ts` for conversation shaping and redirect behavior.
  - `src/app/api/message/route.ts` and `src/app/api/followup/route.ts` for multi-step workflows.
  - `src/app/(dashboard)/settings/page.tsx` and `src/app/(dashboard)/agents/page.tsx` for server actions that mutate Supabase rows.
- Add a CI workflow under `.github/workflows/` once a runner is chosen; the repository currently has no automated execution path for tests.

---

*Testing analysis: 2026-05-23*
