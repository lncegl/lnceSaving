# Sprout Savings Tracker

A personal savings tracker with AI-powered insights, real-time sync, and goal tracking — built with React, Supabase, and Gemini.

---

## Tech Stack

- **React 18** + Vite — frontend framework
- **Supabase** — Postgres DB + Auth + Realtime WebSockets
- **Gemini 2.5 Flash** — AI chatbot via REST API
- **Tailwind CSS** — utility-first styling (green/yellow theme)
- **Recharts** — charts and data visualization
- **Lucide React** — icon set
- **Cloudflare Workers** — deployment via Wrangler

---

## Directory Structure

```
lncesaving/
├── public/
│   └── alden.jpg
│
├── src/
│   ├── components/
│   │   ├── Activity.jsx          ← Activity feed / recent transactions view
│   │   ├── AIChat.jsx            ← Streaming Gemini chatbot
│   │   ├── Auth.jsx              ← Login / signup screens
│   │   ├── Bills.jsx             ← Bills tracking view
│   │   ├── Dashboard.jsx         ← Home view: balance, quick-add, goals
│   │   ├── Goals.jsx             ← Goal CRUD + vine progress bars (lazy)
│   │   ├── Insights.jsx          ← Charts: line, bar, pie (lazy)
│   │   ├── ResetPassword.jsx     ← Password reset flow
│   │   ├── Settings.jsx          ← User settings (currency, API key, etc.)
│   │   ├── Sidebar.jsx           ← Nav (desktop sidebar + mobile tab bar)
│   │   └── TransactionHistory.jsx ← Full ledger with filter/sort/delete
│   │
│   ├── hooks/                    ← Custom React hooks
│   │
│   ├── lib/
│   │   ├── geminiService.js      ← All Gemini logic (context builder, stream)
│   │   └── supabaseClient.js     ← Singleton client + typed query helpers
│   │
│   ├── App.jsx                   ← Root: auth gate, layout, tab router
│   ├── index.css                 ← Tailwind imports + Google Fonts
│   └── main.jsx                  ← Vite entry point
│
├── _redirects                    ← SPA redirect rules
├── .env                          ← Local environment variables
├── .env.production               ← Production environment variables
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── schema.sql                    ← Run this first in Supabase SQL Editor
├── tailwind.config.js
├── vite.config.js
└── wrangler.json                 ← Cloudflare Workers config
```

---

## Data Flow

```
Supabase (Postgres)
      │
      │  initial fetch (Promise.all)
      ▼
useSavings.js  ←──── realtime subscriptions (postgres_changes)
      │
      │  derived values computed with useMemo
      │  (balance, monthNet, balanceSeries, categoryBreakdown…)
      │
      ▼
App.jsx  ──── passes slices as props ────►  Dashboard.jsx
                                       ────►  TransactionHistory.jsx
                                       ────►  Activity.jsx
                                       ────►  Bills.jsx
                                       ────►  Goals.jsx
                                       ────►  Insights.jsx
                                       ────►  Settings.jsx
                                       ────►  AIChat.jsx
                                                   │
                                                   │  buildFinancialContext()
                                                   ▼
                                             geminiService.js
                                                   │
                                                   │  streamGemini() SSE
                                                   ▼
                                           Gemini 2.5 Flash API
```

---

## Supabase Tables

| Table            | Key columns                                               | Notes                             |
|------------------|-----------------------------------------------------------|-----------------------------------|
| `transactions`   | id, user_id, type, amount, category, date, goal_id        | FK → goals (SET NULL on delete)   |
| `goals`          | id, user_id, name, target_amount, target_date             | Cascades to transactions          |
| `user_settings`  | id, user_id, gemini_api_key, currency                     | One row per user                  |

**View:** `goal_progress` — pre-aggregates `saved_amount` and `progress_percent` per goal using a JOIN, so the frontend never needs to compute these.

All tables have **Row Level Security (RLS)** enabled. Every policy checks `auth.uid() = user_id`.

---

## Setup

### 1. Prerequisites
```bash
node >= 18
npm >= 9
```

### 2. Install dependencies
```bash
npm create vite@latest lncesaving -- --template react
cd lncesaving
npm install @supabase/supabase-js recharts lucide-react
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 3. Configure Tailwind (`tailwind.config.js`)
```js
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

### 4. Add CSS imports (`src/index.css`)
```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;700&family=Inter:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### 5. Run Supabase schema
1. Go to **Supabase Dashboard → SQL Editor → New Query**
2. Paste the contents of `schema.sql`
3. Click **Run**

### 6. Environment variables

Create `.env` for local development:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

Create `.env.production` for Cloudflare deployment:
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

> **Never commit these files to git.** Both are listed in `.gitignore`.

### 7. Copy source files
Copy all files from `src/` into your Vite project's `src/` folder.

### 8. Run locally
```bash
npm run dev
```

### 9. Deploy to Cloudflare Workers
```bash
npx wrangler deploy
```

---

## Security Notes

1. **Gemini API key** — stored in `user_settings.gemini_api_key` in Supabase, protected by RLS (only the owner can read it). For a multi-user production app, proxy Gemini calls through a Supabase Edge Function instead of exposing the key to the browser.

2. **Supabase anon key** — safe to expose in the browser. It only grants access to what RLS policies allow (the user's own rows).

3. **RLS is mandatory** — never disable it. Every table has policies restricting reads and writes to `auth.uid() = user_id`.

---

## Extending the App

| Feature               | Where to add                            |
|-----------------------|-----------------------------------------|
| Recurring budgets     | New `budgets` table + `useBudgets` hook |
| Export to CSV         | Utility fn in `src/utils/export.js`     |
| Push notifications    | Supabase Edge Functions + cron job      |
| Multi-currency        | Add `exchange_rate` to `user_settings`  |
| Receipt photo upload  | Supabase Storage + column in `transactions` |