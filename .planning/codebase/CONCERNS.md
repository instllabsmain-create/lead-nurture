# Codebase Concerns

**Analysis Date:** 2026-05-23

## Tech Debt

**Auth and tenant-resolution drift:**
- Issue: The app runtime uses Clerk plus the Supabase service-role client, while the database schema, RLS policies, and local testing guide still describe a Supabase-auth `user_id` model. `getActiveClientContext()` also auto-attaches a signed-in Clerk user to a configured or first client when no explicit mapping exists.
- Files: `src/lib/active-client.ts`, `src/middleware.ts`, `src/lib/supabase/server.ts`, `supabase/migrations/20240101000000_initial_schema.sql`, `supabase/migrations/20240105000000_clients_clerk_user_id.sql`, `TESTING.md`
- Impact: Tenant ownership rules are hard to reason about, correctness depends on service-role filters instead of enforced RLS, and setup/debugging follow stale auth assumptions.
- Fix approach: Pick one ownership model, make Clerk-to-client linkage explicit, remove fallback tenant selection, and align the schema, policies, and docs with the runtime path.

**Configuration surface exceeds implemented behavior:**
- Issue: Several saved config fields are parsed and editable but not enforced in the runtime flow. `response_delay_seconds`, `accept_timeout_minutes`, `fallback`, and `disabled_features` are stored, but the message pipeline does not use them. `round_robin` exists in types/config parsing, but the settings UI only exposes `human_handoff` and `agent_assignment`.
- Files: `src/lib/config.ts`, `src/types/index.ts`, `src/app/(dashboard)/settings/page.tsx`, `src/app/api/message/route.ts`, `src/lib/assign.ts`
- Impact: Operators can change settings that appear supported but do nothing, which creates silent behavior mismatches and brittle support/debugging.
- Fix approach: Either implement each stored control in the runtime pipeline or remove it from the persisted config and UI until supported.

**Large mixed-responsibility files in core paths:**
- Issue: High-risk files combine validation, data access, side effects, and UI in single modules, especially in the webhook/message pipeline and dashboard screens.
- Files: `src/app/api/message/route.ts`, `src/app/api/followup/route.ts`, `src/lib/normalise.ts`, `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/agents/page.tsx`, `src/app/(dashboard)/channels/page.tsx`
- Impact: Small changes require reasoning across multiple concerns at once, making regressions more likely and unit-level testing harder.
- Fix approach: Split domain services from route handlers and extract reusable form/data modules before adding more features.

## Known Bugs

**Outbound messages can be recorded even when delivery fails:**
- Symptoms: AI replies are inserted into `messages` before channel delivery is attempted, so the UI can show a sent outbound message that never reached the lead if the provider call fails.
- Files: `src/app/api/message/route.ts`, `src/lib/channels/index.ts`, `src/lib/channels/facebook.ts`, `src/lib/channels/instagram.ts`, `src/lib/channels/whatsapp.ts`, `src/lib/channels/website.ts`
- Trigger: Any provider error during `sendReply()`, including Meta API failures or the unimplemented website adapter.
- Workaround: Inspect server logs manually and reconcile with provider dashboards; there is no retry or delivery-status repair path.

**Website outbound messaging is not implemented:**
- Symptoms: Any outbound send to the `website` channel throws immediately.
- Files: `src/lib/channels/website.ts`, `src/lib/channels/index.ts`, `src/app/api/message/route.ts`, `src/app/api/send/route.ts`
- Trigger: AI reply, human reply, or follow-up for a lead whose channel resolves to `website`.
- Workaround: None in code; website leads can only create inbound messages.

**Lead answers leak internal scoring flags into the UI and notifications:**
- Symptoms: Reserved keys like `__signal_buying`, `__signal_urgency`, and `__signal_negative` are stored alongside customer answers and can be rendered in the lead detail view or sent in agent notifications.
- Files: `src/lib/score.ts`, `src/components/leads/lead-detail.tsx`, `src/lib/notify.ts`, `src/lib/prompts.ts`
- Trigger: Any scored conversation that matches the buying, urgency, or negative keyword heuristics.
- Workaround: None; the same `answers` JSON is reused for scoring persistence, prompting, and display.

**Broadcasts are exposed in navigation but not implemented:**
- Symptoms: The broadcasts screen is a placeholder and the backend endpoint returns `501 Not implemented`.
- Files: `src/app/(dashboard)/broadcasts/page.tsx`, `src/app/api/broadcast/route.ts`
- Trigger: Any attempt to build or trigger a broadcast flow.
- Workaround: Not applicable; the feature is intentionally incomplete.

## Security Considerations

**Fallback tenant attachment can grant the wrong account to a signed-in user:**
- Risk: A Clerk user with no existing mapping can be attached to `APP_CLIENT_ID`, `DEMO_CLIENT_ID`, or even the first client row in the database.
- Files: `src/lib/active-client.ts`
- Current mitigation: Clerk auth is required before the resolver runs.
- Recommendations: Remove the configured-client and first-client fallback branches, require explicit provisioning/invitation, and fail closed when no client mapping exists.

**Website webhook accepts unauthenticated lead injection:**
- Risk: `/api/webhook/website` only validates the payload shape and that `client_id` exists. Anyone who knows a valid client UUID can create inbound leads/messages for that tenant.
- Files: `src/app/api/webhook/website/route.ts`, `src/app/(dashboard)/channels/page.tsx`
- Current mitigation: `zod` schema validation plus a `clientExists()` lookup.
- Recommendations: Add a signed widget token or per-client webhook secret, rate limiting, origin validation, and a dedicated public identifier that is not enough on its own to write tenant data.

**Service-role access is used for ordinary dashboard reads and writes:**
- Risk: End-user paths bypass RLS entirely and rely on every query manually scoping by `client_id`.
- Files: `src/lib/supabase/server.ts`, `src/lib/active-client.ts`, `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/agents/page.tsx`, `src/app/(dashboard)/channels/page.tsx`, `src/app/(dashboard)/knowledge/page.tsx`, `src/app/api/send/route.ts`, `src/app/api/ai-control/route.ts`
- Current mitigation: Most queries add `.eq("client_id", client.id)`.
- Recommendations: Use a user-scoped Supabase client for authenticated dashboard traffic, reserve service-role access for trusted jobs/webhooks, and centralize tenant-filter enforcement.

**Channel access tokens are stored as plain text:**
- Risk: The schema comment explicitly notes encryption is required in production, but the current flow stores raw platform tokens in `channels.access_token`.
- Files: `supabase/migrations/20240101000000_initial_schema.sql`, `src/app/(dashboard)/channels/page.tsx`
- Current mitigation: None in the application layer.
- Recommendations: Encrypt tokens at rest, minimize who can read them, and consider moving provider secrets to a dedicated secrets store or KMS-backed envelope encryption.

## Performance Bottlenecks

**Inbox polling re-queries broad snapshots every 5 seconds:**
- Problem: The client polls `/api/inbox` every 5 seconds and the server rebuilds the inbox snapshot by loading all leads, recent messages, and optionally the full selected thread.
- Files: `src/hooks/use-conversations.ts`, `src/app/api/inbox/route.ts`, `src/app/(dashboard)/inbox/_data.ts`
- Cause: The polling path is active while the existing realtime hooks in `src/hooks/use-realtime.ts` are unused.
- Improvement path: Replace polling with realtime or incremental sync, paginate thread history, and fetch only changed conversations instead of rebuilding the full snapshot.

**Lead list queries scale with total message volume:**
- Problem: The leads page fetches all matching leads, then loads all messages for those lead IDs ordered by `sent_at` just to compute previews.
- Files: `src/app/(dashboard)/leads/page.tsx`
- Cause: There is no pagination, cursoring, or SQL-level “latest message per lead” projection.
- Improvement path: Add paginated lead queries and compute last-message previews with a view, materialized view, or window-function query.

**Inbound message processing does many synchronous steps per webhook:**
- Problem: Each inbound message can trigger DB writes, recent-message reads, knowledge-base reads, an OpenRouter request, lead scoring, assignment, notifications, and follow-up scheduling in one logical pass.
- Files: `src/app/api/message/route.ts`, `src/lib/ai.ts`, `src/lib/notify.ts`, `src/lib/queue.ts`, `src/lib/assign.ts`, `src/lib/score.ts`
- Cause: The route mixes real-time webhook acknowledgement with downstream business work and only partially defers it via `waitUntil`.
- Improvement path: Introduce a durable queue/job layer, add idempotency keys, and split acknowledgement from processing so provider retries do not multiply work.

## Fragile Areas

**The inbound message pipeline is non-idempotent and failure-tolerant in unsafe ways:**
- Files: `src/app/api/message/route.ts`, `src/lib/meta-webhook.ts`, `src/app/api/webhook/website/route.ts`
- Why fragile: Duplicate webhook deliveries will insert duplicate `messages`, potentially regenerate AI replies, reschedule follow-ups, and trigger repeated notifications because there is no inbound deduplication key or unique constraint on provider message IDs.
- Safe modification: Add provider-specific message identifiers to the schema, enforce idempotent inserts, and isolate each downstream step behind retry-safe records.
- Test coverage: No automated tests were found for duplicate delivery, partial failures, or replay handling.

**Manual payload normalization is easy to break as providers evolve:**
- Files: `src/lib/normalise.ts`, `src/app/api/webhook/instagram/route.ts`, `src/app/api/webhook/facebook/route.ts`, `src/app/api/webhook/whatsapp/route.ts`, `src/app/api/webhook/website/route.ts`
- Why fragile: The parser relies on hand-written object walking across multiple vendor payload shapes with no fixture-backed contract tests.
- Safe modification: Capture real webhook fixtures, wrap each provider in a dedicated schema layer, and add regression tests per supported event type.
- Test coverage: No `*.test.*` or `*.spec.*` files were found anywhere under the repo.

**Server-action forms fail silently on validation errors:**
- Files: `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/agents/page.tsx`, `src/app/(dashboard)/channels/page.tsx`, `src/app/(dashboard)/knowledge/page.tsx`
- Why fragile: Invalid `zod` parses return early without persisting, logging, or surfacing form-state errors back to the user.
- Safe modification: Return structured action state, render validation feedback in the form, and unit-test the form-data parsers separately from the page components.
- Test coverage: No form action tests or component tests were found.

## Scaling Limits

**Agent capacity counters drift because there is no decrement path:**
- Files: `src/lib/assign.ts`, `src/app/(dashboard)/agents/page.tsx`, `supabase/migrations/20240101000000_initial_schema.sql`
- Current capacity: `active_leads` is incremented on assignment and used for load balancing and delete safety checks.
- Limit: Over time agents can remain permanently “full” even if their leads are closed or reassigned, because no code path decrements `active_leads`.
- Scaling path: Derive capacity from open assigned leads in SQL, or add transactional decrement logic when lead ownership/status changes.

**Conversation pages assume lead and message volumes stay small:**
- Files: `src/app/(dashboard)/inbox/_data.ts`, `src/hooks/use-conversations.ts`, `src/app/(dashboard)/leads/page.tsx`
- Current capacity: Inbox and lead pages load broad per-client datasets into memory and re-sort them on every request.
- Limit: Large tenants will see slower page loads, heavier polling traffic, and more expensive Supabase queries.
- Scaling path: Add pagination, summary tables/views, per-lead last-message projections, and a proper realtime/event stream instead of polling snapshots.

## Dependencies at Risk

**Unused Upstash Redis dependency and config surface:**
- Risk: `@upstash/redis` is declared and `TESTING.md` asks for Redis env vars, but no application code imports or uses Redis.
- Files: `package.json`, `TESTING.md`
- Impact: Extra secrets and operational setup are required for a dependency that currently does nothing, which increases confusion and maintenance load.
- Migration plan: Remove the package and env docs until there is a concrete cache/queue use case, or implement the intended Redis-backed feature end-to-end.

## Missing Critical Features

**Website widget delivery path is incomplete:**
- Problem: The channels page instructs users to embed `/widget.js`, but `public/widget.js` does not exist and the outbound website adapter is also unimplemented.
- Files: `src/app/(dashboard)/channels/page.tsx`, `src/lib/channels/website.ts`, `public/`
- Blocks: A working website-chat channel from install to reply loop.

**Self-serve Meta channel connection flow is still placeholder UI:**
- Problem: The Instagram and Facebook cards are disabled and labeled as OAuth placeholders; WhatsApp setup is manual token entry only.
- Files: `src/app/(dashboard)/channels/page.tsx`
- Blocks: Production-ready channel onboarding without direct database or secret handling.

**Guided onboarding flow is absent in the current app path:**
- Problem: `/onboarding` immediately redirects to `/settings`, while new clients are created with `onboarding_completed: true` in the fallback creation path and `TESTING.md` still documents a multi-step onboarding flow.
- Files: `src/app/(dashboard)/onboarding/page.tsx`, `src/lib/active-client.ts`, `TESTING.md`
- Blocks: Deterministic first-run setup, consistent tenant provisioning, and reliable docs for new-user testing.

## Test Coverage Gaps

**Webhook and messaging pipeline:**
- What's not tested: Signature verification, payload normalization, inbound deduplication, AI reply generation fallback, follow-up scheduling, and notification side effects.
- Files: `src/app/api/webhook/instagram/route.ts`, `src/app/api/webhook/facebook/route.ts`, `src/app/api/webhook/whatsapp/route.ts`, `src/app/api/webhook/website/route.ts`, `src/app/api/message/route.ts`, `src/app/api/followup/route.ts`, `src/lib/normalise.ts`, `src/lib/queue.ts`, `src/lib/notify.ts`, `src/lib/ai.ts`
- Risk: The highest-risk production flows can regress silently or duplicate side effects under retry/load.
- Priority: High

**Tenant resolution and auth safety:**
- What's not tested: Clerk-to-client attachment, configured-client fallback, first-client fallback, and default-client creation behavior.
- Files: `src/lib/active-client.ts`, `src/middleware.ts`
- Risk: A resolver change can expose the wrong tenant or strand valid users without access.
- Priority: High

**Dashboard server actions and data-heavy pages:**
- What's not tested: Settings persistence, agent CRUD safety, channel token handling, knowledge-base CRUD, inbox polling behavior, and lead-list preview queries.
- Files: `src/app/(dashboard)/settings/page.tsx`, `src/app/(dashboard)/agents/page.tsx`, `src/app/(dashboard)/channels/page.tsx`, `src/app/(dashboard)/knowledge/page.tsx`, `src/app/(dashboard)/inbox/_data.ts`, `src/hooks/use-conversations.ts`, `src/app/(dashboard)/leads/page.tsx`
- Risk: Refactors can break core operator workflows without an automated signal.
- Priority: Medium

**Repository-level automated testing baseline:**
- What's not tested: There is no automated test suite wired into `package.json`, and no `*.test.*` or `*.spec.*` files were detected in the repository.
- Files: `package.json`, `TESTING.md`
- Risk: All regression detection depends on manual testing and production observation.
- Priority: High

---

*Concerns audit: 2026-05-23*
