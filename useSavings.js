// src/hooks/useSavings.js
// ─────────────────────────────────────────────────────────────
// The single source of truth for all savings data in the UI.
//
// Responsibilities:
//   1. Fetch initial data from Supabase on mount
//   2. Subscribe to real-time changes (postgres_changes)
//   3. Expose action helpers (addTransaction, addGoal, …)
//   4. Derive computed values (balance, monthNet, categoryBreakdown, …)
//      so components stay as dumb as possible
//
// Pattern: every action helper optimistically updates local state
// THEN calls Supabase, rolling back on error.  This makes the UI
// feel instant even on a slow connection.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase,
  fetchTransactions,
  fetchGoals,
  fetchOrCreateSettings,
  insertTransaction,
  deleteTransaction as dbDeleteTx,
  insertGoal,
  deleteGoal as dbDeleteGoal,
  upsertSettings,
} from '../lib/supabaseClient';

// ─────────────────────────────────────────────────────────────
// Helper: current YYYY-MM prefix
// ─────────────────────────────────────────────────────────────
function currentMonthPrefix() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useSavings() {
  // ── Raw data from Supabase ──
  const [transactions, setTransactions] = useState([]);
  const [goals,        setGoals]        = useState([]);
  const [settings,     setSettings]     = useState(null);
  const [user,         setUser]         = useState(null);

  // ── UI flags ──
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // ─────────────────────────────────────────────────────────
  // Initial load + auth listener
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Get the active session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Watch for sign-in / sign-out
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_event, session) => setUser(session?.user ?? null)
    );

    return () => authSub.unsubscribe();
  }, []);

  // Fetch all data whenever the user changes
  useEffect(() => {
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
        const [tx, gs, cfg] = await Promise.all([
          fetchTransactions(),
          fetchGoals(),
          fetchOrCreateSettings(user.id),
        ]);
        if (!cancelled) {
          setTransactions(tx);
          setGoals(gs);
          setSettings(cfg);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [user]);

  // ─────────────────────────────────────────────────────────
  // Real-time subscriptions
  // We listen to transactions and goals; when any row changes
  // we refetch the relevant list.  (A full refetch is simpler
  // and safer than patching a local array with CDC events.)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const txChannel = supabase
      .channel('rt:transactions')
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchTransactions().then(setTransactions).catch(console.error)
      )
      .subscribe();

    const goalsChannel = supabase
      .channel('rt:goals')
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'goals',
          filter: `user_id=eq.${user.id}`,
        },
        // Goals changed → also refresh goals (progress view uses JOIN)
        () => fetchGoals().then(setGoals).catch(console.error)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(goalsChannel);
    };
  }, [user]);

  // ─────────────────────────────────────────────────────────
  // Derived / computed state  (useMemo keeps these O(n) once)
  // ─────────────────────────────────────────────────────────
  const derived = useMemo(() => {
    const totalDeposited  = transactions
      .filter((t) => t.type === 'deposit')
      .reduce((s, t) => s + Number(t.amount), 0);

    const totalWithdrawn  = transactions
      .filter((t) => t.type === 'withdrawal')
      .reduce((s, t) => s + Number(t.amount), 0);

    const balance = totalDeposited - totalWithdrawn;

    const monthPrefix = currentMonthPrefix();
    const monthTx     = transactions.filter((t) => t.date?.startsWith(monthPrefix));
    const monthNet    = monthTx.reduce(
      (s, t) => s + (t.type === 'deposit' ? Number(t.amount) : -Number(t.amount)),
      0
    );

    // Balance-over-time series (for line chart)
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const balanceSeries = sorted.map((t) => {
      running += t.type === 'deposit' ? Number(t.amount) : -Number(t.amount);
      return { date: t.date, balance: running };
    });

    // Monthly bar chart data
    const monthMap = {};
    transactions.forEach((t) => {
      const key = t.date.slice(0, 7);
      if (!monthMap[key]) monthMap[key] = { month: key, deposits: 0, withdrawals: 0 };
      if (t.type === 'deposit')    monthMap[key].deposits    += Number(t.amount);
      else                         monthMap[key].withdrawals += Number(t.amount);
    });
    const monthlyData = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));

    // Category breakdown for pie chart (withdrawals only)
    const catMap = {};
    transactions
      .filter((t) => t.type === 'withdrawal')
      .forEach((t) => { catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount); });
    const categoryBreakdown = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    return {
      totalDeposited,
      totalWithdrawn,
      balance,
      monthNet,
      balanceSeries,
      monthlyData,
      categoryBreakdown,
    };
  }, [transactions]);

  // ─────────────────────────────────────────────────────────
  // Action: add transaction (optimistic)
  // ─────────────────────────────────────────────────────────
  const addTransaction = useCallback(async (payload) => {
    if (!user) throw new Error('Not authenticated');

    // Optimistic row (temporary ID)
    const tempId  = `temp-${Date.now()}`;
    const tempRow = {
      id: tempId, user_id: user.id,
      goals: payload.goal_id ? goals.find((g) => g.id === payload.goal_id) ?? null : null,
      ...payload,
    };

    setTransactions((prev) => [tempRow, ...prev]);

    try {
      const saved = await insertTransaction({ ...payload, user_id: user.id });
      // Replace temp row with real row from DB
      setTransactions((prev) => prev.map((t) => (t.id === tempId ? { ...saved, goals: tempRow.goals } : t)));
      // Refetch goals since progress may have changed
      fetchGoals().then(setGoals).catch(console.error);
      return saved;
    } catch (err) {
      // Roll back
      setTransactions((prev) => prev.filter((t) => t.id !== tempId));
      throw err;
    }
  }, [user, goals]);

  // ─────────────────────────────────────────────────────────
  // Action: delete transaction (optimistic)
  // ─────────────────────────────────────────────────────────
  const removeTransaction = useCallback(async (id) => {
    const snapshot = transactions.find((t) => t.id === id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));

    try {
      await dbDeleteTx(id);
      fetchGoals().then(setGoals).catch(console.error);
    } catch (err) {
      // Roll back
      if (snapshot) setTransactions((prev) => [snapshot, ...prev]);
      throw err;
    }
  }, [transactions]);

  // ─────────────────────────────────────────────────────────
  // Action: add goal
  // ─────────────────────────────────────────────────────────
  const addGoal = useCallback(async (payload) => {
    if (!user) throw new Error('Not authenticated');
    const saved = await insertGoal({ ...payload, user_id: user.id });
    // The view won't auto-push via RT (it's a VIEW), so manually append
    setGoals((prev) => [...prev, { ...saved, saved_amount: 0, progress_percent: 0 }]);
    return saved;
  }, [user]);

  // ─────────────────────────────────────────────────────────
  // Action: delete goal (optimistic)
  // ─────────────────────────────────────────────────────────
  const removeGoal = useCallback(async (id) => {
    const snapshot = goals.find((g) => g.id === id);
    setGoals((prev) => prev.filter((g) => g.id !== id));

    try {
      await dbDeleteGoal(id);
      // Also remove goal_id from local transactions (DB cascade-nulled them)
      setTransactions((prev) =>
        prev.map((t) => (t.goal_id === id ? { ...t, goal_id: null, goals: null } : t))
      );
    } catch (err) {
      if (snapshot) setGoals((prev) => [...prev, snapshot]);
      throw err;
    }
  }, [goals]);

  // ─────────────────────────────────────────────────────────
  // Action: update settings
  // ─────────────────────────────────────────────────────────
  const updateSettings = useCallback(async (patch) => {
    if (!user) throw new Error('Not authenticated');
    const updated = await upsertSettings(user.id, patch);
    setSettings(updated);
    return updated;
  }, [user]);

  // ─────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────
  return {
    // Auth
    user,

    // Raw data
    transactions,
    goals,
    settings,

    // Derived / computed
    ...derived,

    // UI state
    loading,
    error,

    // Actions
    addTransaction,
    removeTransaction,
    addGoal,
    removeGoal,
    updateSettings,
  };
}
