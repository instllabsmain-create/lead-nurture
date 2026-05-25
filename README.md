# INSTL Lead Nurture

Production dashboard for capturing website and Meta leads, routing conversations into an operator inbox, and controlling AI follow-up by lead.

## Stack

- Next.js 16 App Router
- React 19
- Clerk authentication
- Supabase data storage
- Tailwind CSS 4

## Local Development

```sh
npm install
npm run dev
```

Open `http://localhost:3000`.

## Required Environment

Set these before running production builds or deploys:

```sh
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
OPENAI_API_KEY=
META_VERIFY_TOKEN=
```

Optional settings:

```sh
NEXT_PUBLIC_DEFAULT_CLIENT_ID=
NEXT_PUBLIC_DEMO_SUBDOMAIN=demo
ALLOW_SHARED_DEMO_CLIENT=
```

## Production Checks

Run these before deploying:

```sh
npm run lint
npm run build
```

The app should not expose raw server errors to users, should keep generated agent artifacts out of commits, and should only ship after a clean production build.
