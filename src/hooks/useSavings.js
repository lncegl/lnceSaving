// src/hooks/useSavings.js
// ─────────────────────────────────────────────────────────────
// The single source of truth for all savings data in the UI.
//
// Responsibilities:
//   1. Listen to Supabase Auth — expose `user`, react to sign-in/out
//   2. Fetch initial data from Supabase on mount (parallel)
//   3. Subscribe to real-time Postgres changes on transactions + goals
//   4. Expose action helpers (addTransaction, addGoal, …) with
//      optimistic local-state updates that roll back on DB error
//   5. Derive computed values via useMemo so components stay dumb
//
// Import path contract (matches lnceSaving folder structure):
//   src/hooks/useSavings.js  →  ../lib/supabaseClient
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase,
  fetchTransactions,
  fetchGoals,
  fetchOrCreateSettings,
  insertTransaction,
  deleteTransaction  as dbDeleteTransaction,
  insertGoal,
  deleteGoal         as dbDeleteGoal,
  upsertSettings,
} from '../lib/supabaseClient';

// ─────────────────────────────────────────────────────────────
// Pure helpers (no React deps — safe to call outside effects)
// ─────────────────────────────────────────────────────────────

/** Returns the current month as a "YYYY-MM" prefix string. */
function currentMonthPrefix() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Generates a temporary UUID-like string for optimistic rows. */
function tempId() {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useSavings() {
  // ── Raw server data ──────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [goals,        setGoals]        = useState([]);
  const [settings,     setSettings]     = useState(null);
  const [user,         setUser]         = useState(null);

  // ── UI flags ─────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ─────────────────────────────────────────────────────────
  // 1. Auth state listener
  //    - Runs once on mount
  //    - `user` drives everything else (data fetch, subscriptions)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Seed user from the current persisted session immediately so the
    // loading spinner is shown rather than a flash of the auth screen.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authSubscription.unsubscribe();
  }, []);

  // ─────────────────────────────────────────────────────────
  // 2. Initial data load
  //    Re-runs every time `user` changes (sign-in / sign-out).
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    // User signed out — clear everything
    if (!user) {
      setTransactions([]);
      setGoals([]);
      setSettings(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        // Fetch in parallel — passing user.id securely to isolate data rows
        const [txData, goalsData, settingsData] = await Promise.all([
          fetchTransactions(user.id),
          fetchGoals(user.id),
          fetchOrCreateSettings(user.id),
        ]);

        if (cancelled) return;
        setTransactions(txData     ?? []);
        setGoals(goalsData         ?? []);
        setSettings(settingsData   ?? null);
      } catch (err) {
        if (!cancelled) {
          console.error('[useSavings] Initial load failed:', err);
          setError(err.message ?? 'Failed to load savings data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();

    // Cleanup: if the user changes before the fetch resolves, discard stale results
    return () => { cancelled = true; };
  }, [user]);

  // ─────────────────────────────────────────────────────────
  // 3. Real-time Supabase subscriptions
  //    We do a full refetch on any change instead of surgical
  //    row patching — simpler, correct, and cheap at this scale.
  //    Goal progress is a DB VIEW so it must be refetched when
  //    transactions change (its JOIN output changes).
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const txChannel = supabase
      .channel(`rt:transactions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',          // INSERT | UPDATE | DELETE
          schema: 'public',
          table:  'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Transactions changed → refresh transactions and goals filtered by user.id
          Promise.all([fetchTransactions(user.id), fetchGoals(user.id)])
            .then(([txData, goalsData]) => {
              setTransactions(txData   ?? []);
              setGoals(goalsData       ?? []);
            })
            .catch((err) => console.error('[useSavings] Realtime tx sync failed:', err));
        }
      )
      .subscribe();

    const goalsChannel = supabase
      .channel(`rt:goals:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'goals',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchGoals(user.id)
            .then((goalsData) => setGoals(goalsData ?? []))
            .catch((err) => console.error('[useSavings] Realtime goals sync failed:', err));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(goalsChannel);
    };
  }, [user]);

  // ─────────────────────────────────────────────────────────
  // 4. Derived / computed state
  //    All arithmetic lives here, not in components.
  //    useMemo ensures these only recompute when `transactions` changes.
  // ─────────────────────────────────────────────────────────
  const derived = useMemo(() => {
    // ── Totals ──
    const totalDeposited = transactions
      .filter((t) => t.type === 'deposit')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalWithdrawn = transactions
      .filter((t) => t.type === 'withdrawal')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalDeposited - totalWithdrawn;

    // ── This month's net ──
    const monthPrefix = currentMonthPrefix();
    const thisMonthTx = transactions.filter((t) => t.date?.startsWith(monthPrefix));
    const monthNet    = thisMonthTx.reduce(
      (sum, t) => sum + (t.type === 'deposit' ? Number(t.amount) : -Number(t.amount)),
      0
    );

    // ── Balance-over-time series (for LineChart) ──
    // Sort ascending by date then created_at so the line is chronological
    const sorted = [...transactions].sort((a, b) => {
      const dateCmp = (a.date ?? '').localeCompare(b.date ?? '');
      if (dateCmp !== 0) return dateCmp;
      return (a.created_at ?? '').localeCompare(b.created_at ?? '');
    });

    let running = 0;
    const balanceSeries = sorted.map((t) => {
      running += t.type === 'deposit' ? Number(t.amount) : -Number(t.amount);
      return { date: t.date, balance: running };
    });

    // ── Monthly bar chart data ──
    const monthMap = {};
    transactions.forEach((t) => {
      const key = (t.date ?? '').slice(0, 7); // "YYYY-MM"
      if (!key) return;
      if (!monthMap[key]) monthMap[key] = { month: key, deposits: 0, withdrawals: 0 };
      if (t.type === 'deposit')    monthMap[key].deposits    += Number(t.amount);
      else                         monthMap[key].withdrawals += Number(t.amount);
    });
    const monthlyData = Object.values(monthMap).sort((a, b) =>
      a.month.localeCompare(b.month)
    );

    // ── Category breakdown for PieChart (withdrawals only) ──
    const catMap = {};
    transactions
      .filter((t) => t.type === 'withdrawal')
      .forEach((t) => {
        const cat = t.category ?? 'Other';
        catMap[cat] = (catMap[cat] ?? 0) + Number(t.amount);
      });
    const categoryBreakdown = Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      balance,
      totalDeposited,
      totalWithdrawn,
      monthNet,
      balanceSeries,
      monthlyData,
      categoryBreakdown,
    };
  }, [transactions]);

  // ─────────────────────────────────────────────────────────
  // 5. Action helpers — all optimistic
  //    Pattern for every action:
  //       a) Build a temp row and apply it to local state immediately
  //       b) Call Supabase
  //       c) On success: replace temp row with the real DB row
  //       d) On error:  roll back, re-throw so the UI can show the error
  // ─────────────────────────────────────────────────────────

  /** Add a deposit or withdrawal. `payload` omits `user_id` (added here). */
  const addTransaction = useCallback(
    async (payload) => {
      if (!user) throw new Error('Not authenticated.');

      // Build the optimistic row with a temp ID
      const tempRow = {
        id:         tempId(),
        user_id:    user.id,
        created_at: new Date().toISOString(),
        // Attach goal name for display if goal_id is provided
        goals: payload.goal_id
          ? (goals.find((g) => g.id === payload.goal_id) ?? null)
          : null,
        ...payload,
      };

      setTransactions((prev) => [tempRow, ...prev]);

      try {
        const saved = await insertTransaction({ ...payload, user_id: user.id });

        // Replace the temp row with the real one from the DB
        setTransactions((prev) =>
          prev.map((t) => (t.id === tempRow.id ? { ...saved, goals: tempRow.goals } : t))
        );

        // Refresh goals so progress percentages update (filtered by user.id)
        fetchGoals(user.id)
          .then((goalsData) => setGoals(goalsData ?? []))
          .catch(console.error);

        return saved;
      } catch (err) {
        // Roll back the optimistic row
        setTransactions((prev) => prev.filter((t) => t.id !== tempRow.id));
        throw err;
      }
    },
    [user, goals]
  );

  /** Delete a transaction by ID. */
  const removeTransaction = useCallback(
    async (id) => {
      const snapshot = transactions.find((t) => t.id === id);

      // Optimistic removal
      setTransactions((prev) => prev.filter((t) => t.id !== id));

      try {
        await dbDeleteTransaction(id);

        // Refresh goal progress after a transaction is deleted (filtered by user.id)
        fetchGoals(user.id)
          .then((goalsData) => setGoals(goalsData ?? []))
          .catch(console.error);
      } catch (err) {
        // Roll back
        if (snapshot) {
          setTransactions((prev) => [snapshot, ...prev]);
        }
        throw err;
      }
    },
    [transactions, user]
  );

  /** Create a new savings goal. `payload` omits `user_id`. */
  const addGoal = useCallback(
    async (payload) => {
      if (!user) throw new Error('Not authenticated.');

      const saved = await insertGoal({ ...payload, user_id: user.id });

      // The goal_progress VIEW won't push via realtime (it's a VIEW),
      // so we manually append a row with zeroed progress fields.
      setGoals((prev) => [
        ...prev,
        {
          ...saved,
          saved_amount:     0,
          progress_percent: 0,
        },
      ]);

      return saved;
    },
    [user]
  );

  /** Delete a savings goal by ID. Cascade-nulls related transactions on the DB side. */
  const removeGoal = useCallback(
    async (id) => {
      const snapshot = goals.find((g) => g.id === id);

      // Optimistic removal
      setGoals((prev) => prev.filter((g) => g.id !== id));

      try {
        await dbDeleteGoal(id);

        // The DB cascade set goal_id → NULL on related transactions,
        // so mirror that in local state to keep them consistent.
        setTransactions((prev) =>
          prev.map((t) =>
            t.goal_id === id ? { ...t, goal_id: null, goals: null } : t
          )
        );
      } catch (err) {
        // Roll back
        if (snapshot) setGoals((prev) => [...prev, snapshot]);
        throw err;
      }
    },
    [goals]
  );

  /** Update / upsert user settings. `patch` is a partial settings object. */
  const updateSettings = useCallback(
    async (patch) => {
      if (!user) throw new Error('Not authenticated.');

      // Optimistic update — merge patch into local settings immediately
      setSettings((prev) => ({ ...prev, ...patch }));

      try {
        const updated = await upsertSettings(user.id, patch);
        setSettings(updated);
        return updated;
      } catch (err) {
        // Roll back to last known good settings
        setSettings((prev) => {
          // Undo the patch keys — not perfect but prevents stale UI
          const rollback = { ...prev };
          Object.keys(patch).forEach((k) => delete rollback[k]);
          return rollback;
        });
        throw err;
      }
    },
    [user]
  );

  // ─────────────────────────────────────────────────────────
  // 6. Public API
  // ─────────────────────────────────────────────────────────
  return {
    // ── Auth ──
    user,

    // ── Raw server data ──
    transactions,
    goals,
    settings,

    // ── Derived / computed (all from useMemo) ──
    ...derived,

    // ── UI flags ──
    loading,
    error,

    // ── Actions ──
    addTransaction,
    removeTransaction,
    addGoal,
    removeGoal,
    updateSettings,
  };
}