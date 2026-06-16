-- ============================================================
-- SPROUT SAVINGS TRACKER — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- TABLE: goals
-- Must be created before transactions (FK dependency)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
  target_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- TABLE: transactions
-- ────────────────────────────────────────────────────────────
CREATE TYPE public.transaction_type AS ENUM ('deposit', 'withdrawal');

CREATE TABLE IF NOT EXISTS public.transactions (
  id          UUID                  PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID                  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        public.transaction_type NOT NULL,
  amount      NUMERIC(12, 2)        NOT NULL CHECK (amount > 0),
  category    TEXT                  NOT NULL DEFAULT 'Other',
  note        TEXT,
  date        DATE                  NOT NULL DEFAULT CURRENT_DATE,
  goal_id     UUID                  REFERENCES public.goals(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- TABLE: user_settings
-- One row per user (upsert pattern)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  currency       TEXT        NOT NULL DEFAULT 'PHP',
  currency_symbol TEXT       NOT NULL DEFAULT '₱',
  -- NOTE: In production, encrypt this column or store the key server-side.
  -- For a personal tool this is acceptable, but never expose it in public repos.
  gemini_api_key TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES — keep queries fast as data grows
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_user_id  ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date      ON public.transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_goal_id   ON public.transactions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id          ON public.goals(user_id);

-- ────────────────────────────────────────────────────────────
-- FUNCTION: auto-update updated_at timestamp
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Users can ONLY read/write their own rows.
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings  ENABLE ROW LEVEL SECURITY;

-- Transactions policies
CREATE POLICY "Users can view their own transactions"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transactions"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

-- Goals policies
CREATE POLICY "Users can view their own goals"
  ON public.goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON public.goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON public.goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON public.goals FOR DELETE
  USING (auth.uid() = user_id);

-- User settings policies
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- DATABASE VIEW: goal_progress
-- Aggregates transaction amounts per goal — use this in queries
-- instead of computing it in JavaScript.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.goal_progress AS
SELECT
  g.id,
  g.user_id,
  g.name,
  g.target_amount,
  g.target_date,
  g.created_at,
  COALESCE(SUM(
    CASE
      WHEN t.type = 'deposit'    THEN  t.amount
      WHEN t.type = 'withdrawal' THEN -t.amount
      ELSE 0
    END
  ), 0) AS saved_amount,
  ROUND(
    COALESCE(SUM(
      CASE WHEN t.type = 'deposit' THEN t.amount
           WHEN t.type = 'withdrawal' THEN -t.amount
           ELSE 0 END
    ), 0) / NULLIF(g.target_amount, 0) * 100, 2
  ) AS progress_percent
FROM public.goals g
LEFT JOIN public.transactions t
  ON t.goal_id = g.id AND t.user_id = g.user_id
GROUP BY g.id;

-- Allow users to read their own goal_progress rows
CREATE POLICY "Users can view their own goal progress"
  ON public.goal_progress FOR SELECT
  USING (auth.uid() = user_id);

ALTER VIEW public.goal_progress OWNER TO postgres;
