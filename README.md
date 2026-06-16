# Sprout Savings Tracker — Architecture Reference

## Tech Stack
- **React 18** + Vite (frontend framework)
- **Supabase** (Postgres DB + Auth + Realtime WebSockets)
- **Gemini 2.5 Flash** (AI chatbot via REST API)
- **Tailwind CSS** (utility-first styling, green/yellow theme)
- **Recharts** (charts and data visualization)
- **Lucide React** (icon set)

---

## Directory Structure

```
sprout/
├── supabase/
│   └── schema.sql              ← Run this FIRST in Supabase SQL Editor
│
└── src/
    ├── lib/
    │   └── supabaseClient.js   ← Singleton client + typed query helpers
    │
    ├── services/
    │   └── geminiService.js    ← All Gemini logic (context builder, stream)
    │
    ├── hooks/
    │   └── useSavings.js       ← Single hook: data, realtime, actions
    │
    ├── components/
    │   ├── Sidebar.jsx         ← Nav (desktop sidebar + mobile tab bar)
    │   ├── Dashboard.jsx       ← Home view: balance, quick-add, goals
    │   ├── TransactionHistory.jsx  ← Full ledger with filter/sort/delete
    │   ├── AIChat.jsx          ← Streaming Gemini chatbot
    │   ├── Goals.jsx           ← Goal CRUD + vine progress bars (lazy)
    │   └── Insights.jsx        ← Charts: line, bar, pie (lazy)
    │
    └── App.jsx                 ← Root: auth gate, layout, tab router
```

---

## Data Flow Diagram

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
                                       ────►  Goals.jsx
                                       ────►  Insights.jsx
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

| Table            | Key columns                                    | Notes                          |
|------------------|------------------------------------------------|--------------------------------|
| `transactions`   | id, user_id, type, amount, category, date, goal_id | FK → goals (SET NULL on delete) |
| `goals`          | id, user_id, name, target_amount, target_date  | Cascades to transactions       |
| `user_settings`  | id, user_id, gemini_api_key, currency          | One row per user               |

**View:** `goal_progress` — pre-aggregates `saved_amount` and `progress_percent` per goal using a JOIN, so the frontend never needs to compute these.

All tables have **Row Level Security** enabled. Every policy checks `auth.uid() = user_id`.

---

## useSavings.js — Public API

```js
const {
  // Auth
  user,

  // Raw data (from Supabase)
  transactions, goals, settings,

  // Derived/computed (useMemo)
  balance, totalDeposited, totalWithdrawn,
  monthNet, balanceSeries, monthlyData, categoryBreakdown,

  // UI state
  loading, error,

  // Actions (all optimistic)
  addTransaction(payload),
  removeTransaction(id),
  addGoal(payload),
  removeGoal(id),
  updateSettings(patch),
} = useSavings();
```

### Optimistic Update Pattern
Every mutating action in `useSavings`:
1. Adds a temp row to local state immediately (UI updates in <1ms)
2. Calls Supabase
3. Replaces temp row with real DB row on success, or rolls back on error

---

## geminiService.js — Exports

| Export                | Type             | Purpose                                      |
|-----------------------|------------------|----------------------------------------------|
| `buildFinancialContext(params)` | `() => string` | Formats app state into Gemini-readable text |
| `askGemini(key, msg, ctx, history)` | `async () => string` | Single-turn, resolves when done    |
| `streamGemini(key, msg, ctx, history)` | `async generator` | Yields text chunks via SSE        |
| `GeminiError`         | `class`          | Typed error with `.code` property            |

### Why streaming?
`streamGemini` uses Gemini's `alt=sse` endpoint. `AIChat.jsx` renders each
chunk as it arrives, giving a typewriter effect that makes responses feel
instant rather than waiting 3-6 seconds for a full reply.

---

## Setup

### 1. Prerequisites
```bash
node >= 18
npm >= 9
```

### 2. Install dependencies
```bash
npm create vite@latest sprout -- --template react
cd sprout
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
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

### 6. Environment variables (`.env.local`)
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

> **Never commit `.env.local` to git.**

### 7. Copy source files
Copy all files from `src/` into your Vite project's `src/` folder.

### 8. Run
```bash
npm run dev
```

---

## Security Notes

1. **Gemini API key** — stored in `user_settings.gemini_api_key` in Supabase.
   It is protected by RLS (only the owner can read it). For a production app
   used by many people, proxy the Gemini call through a Supabase Edge Function
   instead of exposing the key to the browser.

2. **Supabase anon key** — safe to expose in the browser. It only grants access
   to what RLS policies allow (i.e., the user's own rows).

3. **RLS is mandatory** — never disable it. Every table has policies that
   restrict reads and writes to `auth.uid() = user_id`.

---

## Extending the App

| Feature              | Where to add                          |
|----------------------|---------------------------------------|
| Recurring budgets    | New `budgets` table + `useBudgets` hook |
| Export to CSV        | Utility fn in `src/utils/export.js`  |
| Push notifications   | Supabase Edge Functions + cron job   |
| Multi-currency       | Add `exchange_rate` to `user_settings`|
| Receipt photo upload | Supabase Storage + column in `transactions` |
