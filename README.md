# Use Case Catalog

A private journal for product work. Brain-dump what you did, an Anthropic model structures it into a STAR card and tags it, and you retrieve it later by competency, domain, or full-text search. Built on Next.js (App Router) + Supabase + Google sign-in — the same stack as TradeTracker.

## What's here

```
app/
  page.tsx              server: auth gate + initial fetch
  CatalogApp.tsx        client: the whole UI (Capture / Catalog / Story Bank)
  login/page.tsx        Google sign-in
  auth/callback/route.ts  OAuth code exchange
  api/structure/route.ts  server route that calls Anthropic (holds the API key)
  globals.css           the design
lib/
  supabase/client.ts    browser client
  supabase/server.ts    server client
  types.ts              shared types + tag vocabularies
middleware.ts           refreshes the session each request
supabase/schema.sql     run this in Supabase
```

## Setup (about 15 minutes)

### 1. Supabase
1. Create a project at supabase.com.
2. Open **SQL Editor → New query**, paste in `supabase/schema.sql`, run it. This creates the `use_cases` table with row-level security so every row is private to its owner.
3. From **Project Settings → API**, copy the **Project URL** and the **anon public** key.

### 2. Google sign-in
1. In **Supabase → Authentication → Providers → Google**, enable it. Supabase shows you a **callback URL** (looks like `https://YOUR-PROJECT.supabase.co/auth/v1/callback`) — copy it.
2. In the [Google Cloud Console](https://console.cloud.google.com), create an **OAuth 2.0 Client ID** (Web application). Paste the Supabase callback URL into **Authorized redirect URIs**. Copy the **Client ID** and **Client secret**.
3. Paste those back into the Supabase Google provider settings and save.
4. In **Supabase → Authentication → URL Configuration**, add `http://localhost:3000` (and later your Vercel URL) to **Redirect URLs**.

### 3. Anthropic
Grab an API key from [console.anthropic.com](https://console.anthropic.com). It only ever lives server-side, in the `/api/structure` route.

### 4. Env + run
```bash
cp .env.local.example .env.local   # then fill in the four values
npm install
npm run dev
```
Open http://localhost:3000.

## Deploy (Vercel)
1. Push to GitHub, import the repo in Vercel.
2. Add the same four env vars in the Vercel project settings.
3. After the first deploy, add your `https://your-app.vercel.app` URL to **Supabase → Auth → URL Configuration → Redirect URLs**.

## Notes

- **Search and filtering run client-side** for the MVP — fetch your rows (RLS-scoped to you), filter in the browser. That's plenty for a personal catalog. The schema already includes a `search` tsvector + GIN indexes on the tag arrays, so when the catalog grows you can move filtering server-side via an RPC without a migration.
- **Cost**: each "Structure it" is one short Sonnet call (~1k output tokens). Pennies. Set `ANTHROPIC_MODEL=claude-haiku-4-5-20251001` in `.env.local` if you want it cheaper and faster.
- **Editing existing cards** isn't in the MVP — you can structure, review, edit, and save, but not re-open a saved card to edit. Easy next add (the update RLS policy is already in place).
