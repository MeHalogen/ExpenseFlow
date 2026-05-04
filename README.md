# ExpenseFlow

ExpenseFlow is a mobile-first personal expense tracking app built with React, Vite, Tailwind CSS, Framer Motion, Recharts, and Supabase. It is optimized for fast one-thumb daily logging on phone browsers and is ready to deploy on Netlify.

## Highlights

- Fast bottom-sheet expense entry with smart defaults
- Home dashboard with monthly total, daily average, insight card, donut and bar charts
- Analytics screen with trend and bank split charts
- Transactions screen with search and filters
- Supabase-ready persistence with realtime subscriptions
- Local cache fallback for offline-first continuity
- Netlify-ready routing and environment variable setup

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- ShadCN-style UI primitives with Radix-based components
- Framer Motion
- Recharts
- Supabase

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy env values:
   ```bash
   cp .env.example .env
   ```
3. Add your Supabase values in `.env`.
4. Start development:
   ```bash
   npm run dev
   ```

## Supabase schema

Create a table named `expenses`:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null,
  category text not null,
  mode text not null check (mode in ('UPI', 'Card', 'Cash')),
  bank text not null,
  note text not null default '',
  date date not null,
  created_at timestamptz not null default now()
);
```

Enable realtime for the `expenses` table in Supabase.

## Netlify deploy

1. Push this folder to GitHub.
2. Import the repo into Netlify.
3. Set build command to `npm run build` and publish directory to `dist`.
4. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy.

## Notes

- The app falls back to local cache when Supabase env vars are missing.
- For full PWA installability, add `vite-plugin-pwa` and a manifest in a later pass.
- Edit and gesture actions can be expanded further with a native-swipe library if needed.
# ExpenseFlow2
