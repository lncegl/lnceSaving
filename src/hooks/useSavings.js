// src/hooks/useSavings.js
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  supabase,
  fetchTransactions,
  fetchGoals,
  fetchOrCreateSettings,
  insertTransaction,
  deleteTransaction as dbDeleteTransaction,
  insertGoal,
  deleteGoal as dbDeleteGoal,
  upsertSettings,
} from '../lib/supabaseClient';

function currentMonthPrefix() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function useSavings() {
  const [transactions, setTransactions] = useState([]);
  const [goals,        setGoals]        = useState([]);
  const [settings,     setSettings]     = useState(null);
  const [user,         setUser]         = useState(null);
  const [error,        setError]        = useState(null);
  
  // Custom states to handle the initialization sequence cleanly
  const [authInitialized, setAuthInitialized] = useState(false);
  const [loading,         setLoading]         = useState(true);

  // 1. Safe Auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthInitialized(true);
    }).catch(err => {
      console.error("[useSavings] Session discovery crash:", err);
      setAuthInitialized(true);
    });

    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthInitialized(true);
    });

    return () => authSubscription.unsubscribe();
  }, []);

  // 2. Safe, Isolated Initial Data Loading Sequence
  useEffect(() => {
    if (!authInitialized) return;

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
        let txData = [];
        try {
          txData = await fetchTransactions(user.id);
        } catch (e) { console.error("[useSavings] fetchTransactions failed:", e); }

        let goalsData = [];
        try {
          goalsData = await fetchGoals(user.id);
        } catch (e) { console.error("[useSavings] fetchGoals failed:", e); }

        let settingsData = null;
        try {
          settingsData = await fetchOrCreateSettings(user.id);
        } catch (e) { console.error("[useSavings] fetchOrCreateSettings failed:", e); }

        if (cancelled) return;
        
        setTransactions(Array.isArray(txData) ? txData : []);
        setGoals(Array.isArray(goalsData) ? goalsData : []);
        setSettings(settingsData);
      } catch (err) {
        if (!cancelled) {
          console.error('[useSavings] Core initialization crash:', err);
          setError(err.message ?? 'Internal state allocation failure.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
  }, [user, authInitialized]);

  // 3. Real-time Supabase subscriptions with strict data arrays verification
  useEffect(() => {
    if (!user) return;

    const txChannel = supabase
      .channel(`rt:transactions:${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          Promise.all([
            fetchTransactions(user.id).catch(() => []),
            fetchGoals(user.id).catch(() => [])
          ])
          .then(([txData, goalsData]) => {
            setTransactions(Array.isArray(txData) ? txData : []);
            setGoals(Array.isArray(goalsData) ? goalsData : []);
          })
          .catch((err) => console.error('[useSavings] Realtime sync error:', err));
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
            .then((goalsData) => setGoals(Array.isArray(goalsData) ? goalsData : []))
            .catch((err) => console.error('[useSavings] Realtime goals sync error:', err));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(goalsChannel);
    };
  }, [user]);

  // 4. Secure Balance & Goals Calculation Pipeline
  const derived = useMemo(() => {

    const fallback = {
      balance: 0,
      goals: [],
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalSavedSum: 0,
      monthNet: 0,
      balanceSeries: []
    };

    if (!user || !Array.isArray(transactions) || !Array.isArray(goals)) {
      return fallback;
    }

    try {
      // ──────────────────────────────────────────────────────
      // MAIN BALANCE
      // Rule: a deposit/withdrawal that is allocated to a goal
      // (goal_id set) is an internal transfer into/out of that
      // goal's vault. It must NOT touch the main balance, since
      // the Goals page explicitly promises this to the user.
      // Only undirected deposits/withdrawals (no goal_id) move
      // the main balance.
      // ──────────────────────────────────────────────────────
      let totalDeposited = 0;
      let totalWithdrawn = 0;
      let baselineBalance = 0;

      transactions.forEach((t) => {
        if (!t) return;
        const amt = Number(t.amount || 0);
        const hasGoal = t.goal_id && t.goal_id !== "";

        if (t.type === 'deposit') {
          if (!hasGoal) {
            // Undirected deposit -> real income into main balance
            totalDeposited += amt;
            baselineBalance += amt;
          }
          // Goal-allocated deposit: money was already in main
          // balance and is just being earmarked -> no balance change.
        } else if (['withdrawal', 'expense', 'withdraw'].includes(t.type)) {
          // Both goal withdrawals and undirected withdrawals reduce
          // main balance. Depositing into a goal never added to main
          // balance, so withdrawing from one is a one-way deduction
          // (per the Goals page's own warning to the user).
          baselineBalance -= amt;
          if (!hasGoal) {
            totalWithdrawn += amt;
          }
        }
      });

      const finalBalance = Math.max(0, baselineBalance);

      // ──────────────────────────────────────────────────────
      // GOAL VAULT BALANCES (unchanged: still driven purely by
      // goal-tagged transactions)
      // ──────────────────────────────────────────────────────
      const rawGoalBalances = {};
      goals.forEach(g => { if (g?.id) rawGoalBalances[g.id] = 0; });

      transactions.forEach((t) => {
        if (!t || !t.goal_id || t.goal_id === "") return;
        const amt = Number(t.amount || 0);
        
        if (t.type === 'deposit') {
          rawGoalBalances[t.goal_id] = (rawGoalBalances[t.goal_id] || 0) + amt;
        } else if (['withdrawal', 'expense', 'withdraw'].includes(t.type)) {
          rawGoalBalances[t.goal_id] = (rawGoalBalances[t.goal_id] || 0) - amt;
        }
      });

      const adjustedGoals = goals.map((g) => {
        if (!g) return null;
        const trueSaved = rawGoalBalances[g.id] || 0;
        const target = Number(g.target_amount || 1);
        
        return {
          ...g,
          saved_amount: trueSaved,
          progress_percent: Math.min(100, Math.max(0, (trueSaved / target) * 100)),
          is_complete: trueSaved >= target,
          raw_saved_amount: trueSaved
        };
      }).filter(Boolean);

      const totalSavedSum = Object.values(rawGoalBalances).reduce((a, b) => a + Math.max(0, b), 0);

      // ──────────────────────────────────────────────────────
      // "SAVED THIS MONTH"
      // Rule: reflects money actually moved INTO savings goals
      // this month - not raw net cash flow.
      //   + goal-allocated deposit  -> saved (money earmarked,
      //     no cost to main balance)
      //   - goal-allocated withdraw -> un-saved (funds pulled
      //     out of the goal AND deducted from main balance -
      //     a one-way exit, same direction as an expense)
      //   undirected deposit/withdrawal (no goal_id) -> ignored,
      //     since that's just income/spending on the main
      //     balance, not progress toward a goal.
      // ──────────────────────────────────────────────────────
      const monthPrefix = currentMonthPrefix();
      const thisMonthTx = transactions.filter((t) => t?.date?.startsWith(monthPrefix));

      const monthNet = thisMonthTx.reduce((sum, t) => {
      if (!t) return sum;
      const hasGoal = t.goal_id && t.goal_id !== "";
      if (!hasGoal) return sum;
      if (t.type === 'deposit') return sum + Number(t.amount || 0);
      return sum; // withdrawals/expenses: skip entirely
    }, 0);

      // ──────────────────────────────────────────────────────
      // BALANCE SERIES (history chart) - kept consistent with
      // the corrected main-balance rule above.
      // ──────────────────────────────────────────────────────
      const sorted = [...transactions]
        .filter(t => t && t.date)
        .sort((a, b) => {
          const dateCmp = (a.date ?? '').localeCompare(b.date ?? '');
          if (dateCmp !== 0) return dateCmp;
          return (a.created_at ?? '').localeCompare(b.created_at ?? '');
        });

      let running = 0;
      const balanceSeries = sorted.map((t) => {
        const amt = Number(t.amount || 0);
        const hasGoal = t.goal_id && t.goal_id !== "";

        if (t.type === 'deposit') {
          if (!hasGoal) running += amt;
        } else if (['withdrawal', 'expense', 'withdraw'].includes(t.type)) {
          running -= amt;
        }
        return { date: t.date, balance: Math.max(0, running) };
      });

      return {
        balance: finalBalance,
        goals: adjustedGoals,
        totalDeposited,
        totalWithdrawn,
        totalSavedSum,
        monthNet,
        balanceSeries,
      };
    } catch (calcError) {
      console.error("[useSavings] Computation engine failed:", calcError);
      return fallback;
    }
  }, [transactions, goals, user]);

  // 5. Secure Transaction Actions (Optimized with Local State Push)
const addTransaction = useCallback(async (txData) => {
  if (!user) throw new Error('User must be logged in.');

  // Prevent withdrawing more than the available main balance.
  // This now applies to BOTH undirected withdrawals (real spending)
  // and goal withdrawals, since a goal withdrawal also deducts from
  // main balance - if the user already spent that money elsewhere,
  // main balance may no longer be able to cover it.
  const hasGoal = txData.goal_id && txData.goal_id !== "";
  if (
    txData.type === 'withdrawal' &&
    Number(txData.amount) > derived.balance
  ) {
    throw new Error(
      `Withdrawal amount exceeds your available balance of ₱${derived.balance.toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}.`
    );
  }

  const formattedGoalId =
    txData.goal_id && txData.goal_id !== "" ? txData.goal_id : null;

  const newTx = {
    ...txData,
    user_id: user.id,
    goal_id: formattedGoalId,
  };

  // 1. Send to Supabase Database
  const savedTx = await insertTransaction(newTx);

  // 2. Immediately update local state
  if (savedTx) {
    setTransactions((prev) => [savedTx, ...prev]);
  }

  return savedTx;
}, [user, derived.balance]);

const removeTransaction = useCallback(async (id) => {
  await dbDeleteTransaction(id);
  // IMMEDIATELY slice it out of local state
  setTransactions(prev => prev.filter(tx => tx.id !== id));
}, []);

// 6. Secure Goal Actions (Optimized with Local State Push)
const addGoal = useCallback(async (goalData) => {
  if (!user) throw new Error('User must be logged in.');
  const newGoal = { ...goalData, user_id: user.id };
  const savedGoal = await insertGoal(newGoal);
  
  if (savedGoal) {
    setGoals(prev => [...prev, savedGoal]);
  }
  return savedGoal;
}, [user]);

const removeGoal = useCallback(async (id) => {
  await dbDeleteGoal(id);
  setGoals(prev => prev.filter(g => g.id !== id));
}, []);

  // 7. Secure Settings Actions
  const updateSettings = useCallback(async (newSettings) => {
    if (!user) throw new Error('User must be logged in.');
    const payload = { ...newSettings, user_id: user.id };
    const savedSettings = await upsertSettings(payload);
    setSettings(savedSettings);
    return savedSettings;
  }, [user]);

  return {
    ...derived,
    transactions,
    settings,
    user,
    loading: loading || !authInitialized,
    error,
    addTransaction,
    removeTransaction,
    addGoal,
    removeGoal,
    updateSettings,
  };
}