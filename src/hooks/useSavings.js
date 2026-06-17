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
      let totalDeposited = 0;
      let totalWithdrawn = 0;
      let baselineBalance = 0;

      transactions.forEach((t) => {
        if (!t) return;
        const amt = Number(t.amount || 0);
        // Normalize empty strings or missing IDs safely
        const hasGoal = t.goal_id && t.goal_id !== "";
        
        if (t.type === 'deposit') {
          totalDeposited += amt;
          baselineBalance += amt;
        } else if (['withdrawal', 'expense', 'withdraw'].includes(t.type)) {
          baselineBalance -= amt;
          if (!hasGoal) {
            totalWithdrawn += amt;
          }
        }
      });

      const finalBalance = Math.max(0, baselineBalance);

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

      const monthPrefix = currentMonthPrefix();
      const thisMonthTx = transactions.filter((t) => t?.date?.startsWith(monthPrefix));
      const monthNet = thisMonthTx.reduce((sum, t) => {
        const amt = Number(t.amount || 0);
        if (t.type === 'deposit') {
          return sum + amt;
        } else {
          return sum - amt;
        }
      }, 0);

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
        if (t.type === 'deposit') {
          running += amt;
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
  
  const formattedGoalId = txData.goal_id && txData.goal_id !== "" ? txData.goal_id : null;
  const newTx = { 
    ...txData, 
    user_id: user.id,
    goal_id: formattedGoalId 
  };
  
  // 1. Send to Supabase Database
  const savedTx = await insertTransaction(newTx);
  
  // 2. IMMEDIATELY update local state so balance re-calculates without a refresh!
  if (savedTx) {
    setTransactions(prev => [savedTx, ...prev]);
  }
  
  return savedTx;
}, [user]);

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