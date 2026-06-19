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
    fetchBills,
    insertBill,
    deleteBill as dbDeleteBill,
    fetchBillPayments,
    insertBillPayment,
    deleteBillPayment as dbDeleteBillPayment,
    resetBillPayments as dbResetBillPayments,
  } from '../lib/supabaseClient';

  function currentMonthPrefix() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  export function useSavings() {
    const [transactions, setTransactions] = useState([]);
    const [goals,        setGoals]        = useState([]);
    const [bills,        setBills]        = useState([]);
    const [billPayments, setBillPayments] = useState([]);
    const [settings,     setSettings]     = useState(null);
    const [user,         setUser]         = useState(null);
    const [error,        setError]        = useState(null);

    const [authInitialized, setAuthInitialized] = useState(false);
    const [loading,         setLoading]         = useState(true);

    // 1. Auth state listener
    useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setAuthInitialized(true);
      }).catch(err => {
        console.error("[useSavings] Session discovery crash:", err);
        setAuthInitialized(true);
      });

      const { data: { subscription: authSubscription } } =
        supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
          setAuthInitialized(true);
        });

      return () => authSubscription.unsubscribe();
    }, []);

    // 2. Initial data load
    useEffect(() => {
      if (!authInitialized) return;

      if (!user) {
        setTransactions([]);
        setGoals([]);
        setBills([]);
        setBillPayments([]);
        setSettings(null);
        setLoading(false);
        return;
      }

      let cancelled = false;

      async function loadAll() {
        setLoading(true);
        setError(null);

        try {
          const monthKey = currentMonthPrefix();

          let txData = [];
          try { txData = await fetchTransactions(user.id); }
          catch (e) { console.error("[useSavings] fetchTransactions failed:", e); }

          let goalsData = [];
          try { goalsData = await fetchGoals(user.id); }
          catch (e) { console.error("[useSavings] fetchGoals failed:", e); }

          let settingsData = null;
          try { settingsData = await fetchOrCreateSettings(user.id); }
          catch (e) { console.error("[useSavings] fetchOrCreateSettings failed:", e); }

          let billsData = [];
          try { billsData = await fetchBills(user.id); }
          catch (e) { console.error("[useSavings] fetchBills failed:", e); }

          let billPaymentsData = [];
          try { billPaymentsData = await fetchBillPayments(user.id, monthKey); }
          catch (e) { console.error("[useSavings] fetchBillPayments failed:", e); }

          if (cancelled) return;

          setTransactions(Array.isArray(txData) ? txData : []);
          setGoals(Array.isArray(goalsData) ? goalsData : []);
          setSettings(settingsData);
          setBills(Array.isArray(billsData) ? billsData : []);
          setBillPayments(Array.isArray(billPaymentsData) ? billPaymentsData : []);
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

    // 3. Realtime subscriptions
    useEffect(() => {
      if (!user) return;

      const txChannel = supabase
        .channel(`rt:transactions:${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          Promise.all([
            fetchTransactions(user.id).catch(() => []),
            fetchGoals(user.id).catch(() => []),
          ]).then(([txData, goalsData]) => {
            setTransactions(Array.isArray(txData) ? txData : []);
            setGoals(Array.isArray(goalsData) ? goalsData : []);
          }).catch(err => console.error('[useSavings] Realtime tx sync error:', err));
        })
        .subscribe();

      const goalsChannel = supabase
        .channel(`rt:goals:${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'goals',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          fetchGoals(user.id)
            .then(d => setGoals(Array.isArray(d) ? d : []))
            .catch(err => console.error('[useSavings] Realtime goals sync error:', err));
        })
        .subscribe();

      const billsChannel = supabase
        .channel(`rt:bills:${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'bills',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          fetchBills(user.id)
            .then(d => setBills(Array.isArray(d) ? d : []))
            .catch(err => console.error('[useSavings] Realtime bills sync error:', err));
        })
        .subscribe();

      const billPaymentsChannel = supabase
        .channel(`rt:bill_payments:${user.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'bill_payments',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          fetchBillPayments(user.id, currentMonthPrefix())
            .then(d => setBillPayments(Array.isArray(d) ? d : []))
            .catch(err => console.error('[useSavings] Realtime bill_payments sync error:', err));
        })
        .subscribe();

      return () => {
        supabase.removeChannel(txChannel);
        supabase.removeChannel(goalsChannel);
        supabase.removeChannel(billsChannel);
        supabase.removeChannel(billPaymentsChannel);
      };
    }, [user]);

    // 4. Derived calculations
    const derived = useMemo(() => {
      const fallback = {
        balance: 0,
        goals: [],
        totalDeposited: 0,
        totalWithdrawn: 0,
        totalSavedSum: 0,
        monthNet: 0,
        balanceSeries: [],
        billsWithStatus: [],
        unpaidUrgentBills: [],
      };

      if (!user || !Array.isArray(transactions) || !Array.isArray(goals)) {
        return fallback;
      }

      try {
        // ── Main balance ──
        let totalDeposited = 0;
        let totalWithdrawn = 0;
        let baselineBalance = 0;

        transactions.forEach((t) => {
          if (!t) return;
          const amt = Number(t.amount || 0);
          const hasGoal = t.goal_id && t.goal_id !== "";

          if (t.type === 'deposit') {
            if (!hasGoal) {
              totalDeposited += amt;
              baselineBalance += amt;
            }
          } else if (['withdrawal', 'expense', 'withdraw'].includes(t.type)) {
            baselineBalance -= amt;
            if (!hasGoal) totalWithdrawn += amt;
          }
        });

        const finalBalance = Math.max(0, baselineBalance);

        // ── Goal vault balances ──
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
            raw_saved_amount: trueSaved,
          };
        }).filter(Boolean);

        const totalSavedSum = Object.values(rawGoalBalances)
          .reduce((a, b) => a + Math.max(0, b), 0);

        // ── Saved this month ──
        const monthPrefix = currentMonthPrefix();
        const thisMonthTx = transactions.filter(t => t?.date?.startsWith(monthPrefix));

        const monthNet = thisMonthTx.reduce((sum, t) => {
          if (!t) return sum;
          const hasGoal = t.goal_id && t.goal_id !== "";
          if (!hasGoal) return sum;
          if (t.type === 'deposit') return sum + Number(t.amount || 0);
          return sum;
        }, 0);

        // ── Balance series ──
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

        // ── Bills with paid status ──
        const paidBillIds = new Set(billPayments.map(p => p.bill_id));
        const today = new Date();
        const currentDay = today.getDate();

        const billsWithStatus = (Array.isArray(bills) ? bills : []).map(b => {
          const isPaid = paidBillIds.has(b.id);
          const daysUntilDue = b.due_day - currentDay;
          const isOverdue = !isPaid && daysUntilDue < 0;
          const isUrgent = !isPaid && daysUntilDue >= 0 && daysUntilDue <= 3;
          const payment = billPayments.find(p => p.bill_id === b.id) ?? null;
          return {
            ...b,
            isPaid,
            isOverdue,
            isUrgent,
            daysUntilDue,
            payment,
          };
        });

        // Bills that need attention for the dashboard warning
        const unpaidUrgentBills = billsWithStatus.filter(b => b.isUrgent || b.isOverdue);

        return {
          balance: finalBalance,
          goals: adjustedGoals,
          totalDeposited,
          totalWithdrawn,
          totalSavedSum,
          monthNet,
          balanceSeries,
          billsWithStatus,
          unpaidUrgentBills,
        };
      } catch (calcError) {
        console.error("[useSavings] Computation engine failed:", calcError);
        return {
          balance: 0, goals: [], totalDeposited: 0, totalWithdrawn: 0,
          totalSavedSum: 0, monthNet: 0, balanceSeries: [],
          billsWithStatus: [], unpaidUrgentBills: [],
        };
      }
    }, [transactions, goals, bills, billPayments, user]);

    // 5. Transaction actions
    const addTransaction = useCallback(async (txData) => {
      if (!user) throw new Error('User must be logged in.');

      if (
        txData.type === 'withdrawal' &&
        Number(txData.amount) > derived.balance
      ) {
        throw new Error(
          `Withdrawal amount exceeds your available balance of ₱${derived.balance.toLocaleString('en-PH', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          })}.`
        );
      }

      const formattedGoalId =
        txData.goal_id && txData.goal_id !== "" ? txData.goal_id : null;

      const newTx = { ...txData, user_id: user.id, goal_id: formattedGoalId };
      const savedTx = await insertTransaction(newTx);
      if (savedTx) setTransactions(prev => [savedTx, ...prev]);
      return savedTx;
    }, [user, derived.balance]);

    const removeTransaction = useCallback(async (id) => {
      await dbDeleteTransaction(id);
      setTransactions(prev => prev.filter(tx => tx.id !== id));
    }, []);

    // 6. Goal actions
    const addGoal = useCallback(async (goalData) => {
      if (!user) throw new Error('User must be logged in.');
      const newGoal = { ...goalData, user_id: user.id };
      const savedGoal = await insertGoal(newGoal);
      if (savedGoal) setGoals(prev => [...prev, savedGoal]);
      return savedGoal;
    }, [user]);

    const removeGoal = useCallback(async (id) => {
      await dbDeleteGoal(id);
      setGoals(prev => prev.filter(g => g.id !== id));
    }, []);

    // 7. Settings actions
    const updateSettings = useCallback(async (newSettings) => {
      if (!user) throw new Error('User must be logged in.');
      const payload = { ...newSettings, user_id: user.id };
      const savedSettings = await upsertSettings(payload);
      setSettings(savedSettings);
      return savedSettings;
    }, [user]);

    // 8. Bill actions
    const addBill = useCallback(async (billData) => {
      if (!user) throw new Error('User must be logged in.');
      const payload = { ...billData, user_id: user.id };
      const saved = await insertBill(payload);
      if (saved) setBills(prev => [...prev, saved]);
      return saved;
    }, [user]);

    const removeBill = useCallback(async (id) => {
      await dbDeleteBill(id);
      setBills(prev => prev.filter(b => b.id !== id));
      setBillPayments(prev => prev.filter(p => p.bill_id !== id));
    }, []);

    const updateBill = useCallback(async (id, fields) => {
    if (!user) throw new Error('User must be logged in.');
    const { data, error } = await supabase
      .from('bills')
      .update(fields)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    setBills(prev => prev.map(b => b.id === id ? { ...b, ...data } : b));
    return data;
    }, [user]);

    const payBill = useCallback(async (billId, amount) => {
      if (!user) throw new Error('User must be logged in.');

      if (amount > derived.balance) {
        throw new Error(
          `Insufficient balance. You need ₱${amount.toLocaleString('en-PH', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          })} but only have ₱${derived.balance.toLocaleString('en-PH', {
            minimumFractionDigits: 2, maximumFractionDigits: 2,
          })}.`
        );
      }

      const monthKey = currentMonthPrefix();
      const bill = bills.find(b => b.id === billId);

      // 1. Record the transaction (deducts from balance)
      const tx = await insertTransaction({
        user_id:  user.id,
        type:     'withdrawal',
        amount,
        category: bill?.category ?? 'Bills',
        note:     `Bill payment: ${bill?.name ?? 'Unknown'}`,
        date:     new Date().toISOString().slice(0, 10),
        goal_id:  null,
      });

      // 2. Record the payment marker
      const payment = await insertBillPayment({
        user_id:   user.id,
        bill_id:   billId,
        month_key: monthKey,
      });

      if (tx)      setTransactions(prev => [tx, ...prev]);
      if (payment) setBillPayments(prev => [...prev, payment]);

      return { tx, payment };
    }, [user, derived.balance, bills]);

    const unpayBill = useCallback(async (billId) => {
      const payment = billPayments.find(p => p.bill_id === billId);
      if (!payment) return;
      await dbDeleteBillPayment(payment.id);
      setBillPayments(prev => prev.filter(p => p.id !== payment.id));
    }, [billPayments]);

    const resetMonthlyBills = useCallback(async () => {
      if (!user) throw new Error('User must be logged in.');
      const monthKey = currentMonthPrefix();
      await dbResetBillPayments(user.id, monthKey);
      setBillPayments([]);
    }, [user]);

    return {
      ...derived,
      transactions,
      bills,
      billPayments,
      settings,
      user,
      loading: loading || !authInitialized,
      error,
      addTransaction,
      removeTransaction,
      addGoal,
      removeGoal,
      updateSettings,
      addBill,
      removeBill,
      updateBill,
      payBill,
      unpayBill,
      resetMonthlyBills,
    };
  }