# TESTING

Local testing guide for `INSTL.LABS Lead Nurturer`.

This guide follows the current app flow from [apis.md](/Users/kartik/Downloads/Lead%20Nurture/instl-nurture/apis.md:1) and [architecture.md](/Users/kartik/Downloads/Lead%20Nurture/instl-nurture/architecture.md:1).

## Prerequisites

1. Install dependencies:

```bash
npm install
```

2. Apply the database schema:

```bash
supabase db push
```

3. Start the app:

```bash
npm run dev
```

4. Use a public URL or tunnel when testing:
- Meta webhooks from the Meta dashboard
- QStash callbacks to `/api/followup`

`localhost` is fine for direct `curl` tests you run yourself.

## 1. Environment variables

Create `.env.local` with these values:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENROUTER_API_KEY=
META_APP_SECRET=
META_VERIFY_TOKEN=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

Quick check:

```bash
for name in \
  NEXT_PUBLIC_SUPABASE_URL \
  NEXT_PUBLIC_SUPABASE_ANON_KEY \
  SUPABASE_SERVICE_ROLE_KEY \
  OPENROUTER_API_KEY \
  META_APP_SECRET \
  META_VERIFY_TOKEN \
  QSTASH_TOKEN \
  QSTASH_CURRENT_SIGNING_KEY \
  QSTASH_NEXT_SIGNING_KEY \
  RESEND_API_KEY \
  NEXT_PUBLIC_APP_URL
do
  if [ -z "${(P)name}" ]; then
    echo "Missing: $name"
  else
    echo "OK: $name"
  fi
done
```

Expected result:
- every required variable prints `OK`

If you are using `bash` instead of `zsh`, replace `${(P)name}` with `${!name}`.

## 2. Supabase connection

Test browser-auth connectivity:

```bash
curl -i "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/settings" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected result:
- `200 OK`

Test server-side DB connectivity from the terminal only:

```bash
curl -i "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/clients?select=id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected result:
- `200 OK`

Do not use the service role key in browser code.

## 3. Google login

1. Make sure Google auth is enabled in Supabase Auth.
2. Make sure the redirect URL includes:

```text
http://localhost:3000/auth/callback
```

3. Open:

```text
http://localhost:3000/login
```

4. Click `Continue with Google`.

Expected result:
- first-time user goes to `/onboarding`
- returning user with `onboarding_completed = true` goes to `/dashboard`

If you land on `/login?error=auth_failed`, check:
- Google provider enabled
- redirect URL matches exactly
- `NEXT_PUBLIC_SUPABASE_URL` and anon key are correct

## 4. Onboarding

1. Sign in with a Google user that does not yet have a completed client row.
2. Complete all 3 onboarding steps.
3. Submit the form.

Expected result:
- browser redirects to `/dashboard`
- a row exists in `clients`
- `onboarding_completed = true`
- onboarding answers are stored inside `clients.config`

Check in Supabase:

```sql
select id, name, email, onboarding_completed, config
from public.clients
order by created_at desc;
```

## 5. Dashboard stats

Use the fake message tests in sections 7 to 9 first, then open:

```text
http://localhost:3000/dashboard
```

Expected result:
- `Total leads` matches lead count for your client
- `Active` matches leads with `status = engaging`
- `Qualified today` matches leads with `status = qualified` and `last_active >= today midnight`
- `Messages sent today` matches outbound messages created today

Useful SQL:

```sql
select count(*) from public.leads where client_id = '<CLIENT_ID>';
select count(*) from public.leads where client_id = '<CLIENT_ID>' and status = 'engaging';
select count(*) from public.leads where client_id = '<CLIENT_ID>' and status = 'qualified' and last_active >= date_trunc('day', now());
select count(*) from public.messages where client_id = '<CLIENT_ID>' and direction = 'outbound' and sent_at >= date_trunc('day', now());
```

## 6. Creating a test channel manually in Supabase

The safest end-to-end local test uses a manual `website` channel because it lets you exercise the message pipeline without needing real Meta credentials.

First, get your client id:

```sql
select id, name, email
from public.clients
order by created_at desc;
```

Create one active website channel for that client. Use the client UUID as `account_id`.

```sql
insert into public.channels (
  client_id,
  type,
  account_id,
  account_name,
  status
)
values (
  '<CLIENT_ID>',
  'website',
  '<CLIENT_ID>',
  'Website widget',
  'active'
);
```

Expected result:
- one `channels` row exists for `type = 'website'`
- `account_id` equals the client UUID

Check:

```sql
select id, client_id, type, account_id, account_name, status
from public.channels
where client_id = '<CLIENT_ID>'
order by connected_at desc;
```

## 7. Testing `/api/message` with a fake `NormalisedMessage`

Use the manual website channel from section 6.

Send a fake inbound message:

```bash
curl -i http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "<CLIENT_ID>",
    "channel": "website",
    "direction": "inbound",
    "from": {
      "id": "test-session-001",
      "name": "Test Lead"
    },
    "to": {
      "id": "<CLIENT_ID>"
    },
    "content": {
      "type": "text",
      "text": "Hi, I am interested and want to buy. My budget is 50000 and I need it today in Bandra."
    },
    "timestamp": "2026-05-19T10:00:00.000Z",
    "raw": {
      "source": "manual-test"
    }
  }'
```

Expected HTTP result:
- `200 OK`
- body is `{"ok":true}`

Expected database result:
- lead is created or updated in `leads`
- one inbound row is inserted in `messages`
- background processing starts through `waitUntil`

Check:

```sql
select id, client_id, platform_id, name, score, status, answers, last_active
from public.leads
where client_id = '<CLIENT_ID>'
  and platform_id = 'test-session-001';

select direction, ai_generated, content, sent_at
from public.messages
where client_id = '<CLIENT_ID>'
order by sent_at desc
limit 10;
```

Important note:
- with the current codebase, the `website` send adapter is intentionally not implemented
- that means outbound send will fail safely, but the route should still return `200` and the pipeline should continue

## 8. Testing AI reply generation

Prerequisites:
- `OPENROUTER_API_KEY` is set
- there is at least one `knowledge_base` row for the client, or a business description in `clients.config`

Add a quick knowledge base entry if needed:

```sql
insert into public.knowledge_base (client_id, title, content)
values (
  '<CLIENT_ID>',
  'Business facts',
  'We sell modular kitchens in Mumbai. Delivery usually takes 14 days.'
);
```

Then run the `/api/message` test from section 7.

Expected result:
- an outbound `messages` row appears with `ai_generated = true`
- `content.text` contains a short AI reply

Check:

```sql
select direction, ai_generated, content, sent_at
from public.messages
where client_id = '<CLIENT_ID>'
  and lead_id = (
    select id from public.leads
    where client_id = '<CLIENT_ID>' and platform_id = 'test-session-001'
  )
order by sent_at desc
limit 5;
```

If you want to confirm the pipeline is resilient when AI fails:
- temporarily unset `OPENROUTER_API_KEY`
- repeat the `/api/message` test
- expect `200 OK` from the route and the inbound message to still be saved

## 9. Testing lead scoring

Send a second strong-signal message for the same fake lead:

```bash
curl -i http://localhost:3000/api/message \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "<CLIENT_ID>",
    "channel": "website",
    "direction": "inbound",
    "from": {
      "id": "test-session-001",
      "name": "Test Lead"
    },
    "to": {
      "id": "<CLIENT_ID>"
    },
    "content": {
      "type": "text",
      "text": "How much does it cost? I need it asap. I am in Bandra and I want to order this week."
    },
    "timestamp": "2026-05-19T10:05:00.000Z",
    "raw": {
      "source": "manual-test-2"
    }
  }'
```

Expected result:
- `leads.score` increases
- `leads.answers` starts filling in
- `leads.status` moves to `engaging` or `qualified`
- score stays between `0` and `100`

Check:

```sql
select platform_id, score, status, answers
from public.leads
where client_id = '<CLIENT_ID>'
  and platform_id = 'test-session-001';
```

## 10. Testing human send route

There are two practical tests here.

### Auth and validation test

Without a session, call:

```bash
curl -i http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{"leadId":"00000000-0000-0000-0000-000000000000","message":"Hello"}'
```

Expected result:
- `401 Unauthorized`

### Real send test

This requires a real connected Instagram, Facebook, or WhatsApp channel with a valid token.

1. Log in through the browser.
2. Open a real lead in `/inbox/[leadId]`.
3. Click `Take over from AI`.
4. Send a message.

Expected result:
- request returns `200`
- a new outbound `messages` row is created with `ai_generated = false`
- `lead.last_active` updates

Important note:
- sending a human message on a `website` lead will fail right now because the website send adapter is still a placeholder

## 11. Testing follow-up route safely

The safest test is a skip-path test, not a real send.

Why:
- `/api/followup` requires a valid QStash signature
- the `website` send adapter is not implemented

### Safe skip-path test

1. Use your public preview URL or a tunnel for the app.
2. Insert a pending follow-up row:

```sql
insert into public.follow_ups (
  client_id,
  lead_id,
  message,
  scheduled_at,
  sent
)
values (
  '<CLIENT_ID>',
  '<LEAD_ID>',
  'Safe follow-up test',
  now(),
  false
);
```

3. Insert a newer inbound message for the same lead:

```sql
insert into public.messages (
  client_id,
  lead_id,
  direction,
  channel,
  content,
  ai_generated,
  sent_at
)
values (
  '<CLIENT_ID>',
  '<LEAD_ID>',
  'inbound',
  'website',
  '{"type":"text","text":"I already replied"}'::jsonb,
  false,
  now()
);
```

4. Publish a QStash job to your public app URL:

```bash
curl -X POST "https://qstash.upstash.io/v2/publish/$NEXT_PUBLIC_APP_URL/api/followup" \
  -H "Authorization: Bearer $QSTASH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "<LEAD_ID>",
    "clientId": "<CLIENT_ID>",
    "message": "Safe follow-up test"
  }'
```

Expected result:
- route is called with a valid signature
- it skips because there is a newer inbound message
- no new outbound follow-up message is created

Check:

```sql
select direction, content, sent_at
from public.messages
where client_id = '<CLIENT_ID>'
  and lead_id = '<LEAD_ID>'
order by sent_at desc
limit 10;
```

Also test queue creation safely through `/api/message`:
- after a normal inbound message, confirm a row appears in `follow_ups`

```sql
select id, lead_id, message, scheduled_at, sent
from public.follow_ups
where client_id = '<CLIENT_ID>'
order by created_at desc
limit 10;
```

## 12. Testing webhook verification manually

### GET verification test

Good token:

```bash
curl -i "http://localhost:3000/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=$META_VERIFY_TOKEN&hub.challenge=test123"
```

Expected result:
- `200 OK`
- response body is `test123`

Bad token:

```bash
curl -i "http://localhost:3000/api/webhook/instagram?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=test123"
```

Expected result:
- `403 Forbidden`

### POST signature verification test

Build a small payload:

```bash
BODY='{"entry":[{"messaging":[{"sender":{"id":"lead-123"},"recipient":{"id":"page-123"},"timestamp":1700000000,"message":{"text":"hello"}}]}]}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$META_APP_SECRET" -binary | xxd -p -c 256)
```

Valid signature:

```bash
curl -i http://localhost:3000/api/webhook/instagram \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=$SIG" \
  -d "$BODY"
```

Expected result:
- `200 OK`

Bad signature:

```bash
curl -i http://localhost:3000/api/webhook/instagram \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=badbadbad" \
  -d "$BODY"
```

Expected result:
- `403 Forbidden`

Note:
- a valid signed POST can still return `200` even if no matching channel exists
- that is expected, because webhook routes must respond quickly and safely

## 13. Common errors and fixes

### `Missing required environment variable`

Fix:
- check `.env.local`
- restart `npm run dev` after editing env vars

### `/login?error=auth_failed`

Fix:
- enable Google provider in Supabase
- verify redirect URL includes `/auth/callback`
- verify `NEXT_PUBLIC_SUPABASE_URL` and anon key

### Redirect loop to `/onboarding`

Fix:
- make sure the client row exists for the signed-in `user_id`
- make sure `onboarding_completed = true`

### `Channel not found for ...` in `/api/message`

Fix:
- create a `channels` row first
- make sure `normalised.to.id` matches `channels.account_id`
- make sure `channels.type` matches the payload channel

### AI reply not created

Fix:
- verify `OPENROUTER_API_KEY`
- check `knowledge_base` and business description
- inspect the latest inbound message text, because blank text cannot generate a useful reply

### Score stays at `0`

Fix:
- send text that includes qualification answers and buying or urgency signals
- check `clients.config.scoring`
- check `clients.config.qualification_questions`

### Human send returns `500`

Fix:
- confirm the lead belongs to the logged-in client
- confirm the lead has a real connected channel
- if the lead is on `website`, failure is expected for now because the website send adapter is not implemented

### `/api/followup` returns `403`

Fix:
- do not call it directly with plain `curl`
- call it through QStash so the signature headers are present
- verify `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`

### Meta webhook POST returns `403`

Fix:
- verify `META_APP_SECRET`
- compute the HMAC from the exact raw body
- make sure the header is `X-Hub-Signature-256: sha256=<digest>`

### Messages appear in DB but no live UI update

Fix:
- reload the inbox page
- verify the row `client_id` matches the current client
- verify Supabase Realtime is enabled for `messages` and `leads`

## Final smoke test

Before shipping, run:

```bash
npm run lint
npm run build
```

Expected result:
- both commands pass
- no new warnings beyond the known Next.js workspace-root and `middleware` deprecation warnings
