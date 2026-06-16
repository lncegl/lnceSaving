// src/App.jsx
// ─────────────────────────────────────────────────────────────
// Root component.
//   1. Calls useSavings() once — all data + actions live here
//   2. Passes slices down to each child component (no prop-drilling
//      hell because each tab only receives what it needs)
//   3. Renders auth gate if user is not signed in
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import { useSavings }          from './hooks/useSavings';
import Sidebar                 from './components/Sidebar';
import Dashboard               from './components/Dashboard';
import TransactionHistory      from './components/TransactionHistory';
import AIChat                  from './components/AIChat';
import { supabase }            from './lib/supabaseClient';
import { Sprout, Loader2 }     from 'lucide-react';

// ── Lazy-import heavier tabs (reduces initial bundle) ─────────
import { lazy, Suspense } from 'react';
const Goals    = lazy(() => import('./components/Goals'));
const Insights = lazy(() => import('./components/Insights'));

// ── Simple loading spinner ────────────────────────────────────
function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-green-700">
      <Loader2 size={32} className="animate-spin" />
      <p className="text-sm font-semibold text-gray-500">{label}</p>
    </div>
  );
}

// ── Auth gate ─────────────────────────────────────────────────
function AuthScreen() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [mode,     setMode]     = useState('login');   // 'login' | 'signup'
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn = mode === 'login'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password });

      const { error: authError } = await fn;
      if (authError) throw authError;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F8F0] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-[#1F3D2B] flex items-center justify-center">
            <Sprout size={24} className="text-[#C7E26E]" />
          </div>
          <h1 className="font-serif text-2xl text-[#1F3D2B]">Sprout</h1>
          <p className="text-sm text-gray-400">Watch your savings grow</p>
        </div>

        {/* Toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {['login', 'signup'].map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${mode === m ? 'bg-white text-[#1F3D2B] shadow-sm' : 'text-gray-400'}`}
            >
              {m === 'login' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-500 font-semibold">Email</span>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 font-semibold">Password</span>
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
            />
          </label>

          {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full bg-[#1F3D2B] text-[#C7E26E] font-bold py-2.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const {
    user,
    transactions, goals, settings,
    balance, totalDeposited, totalWithdrawn,
    monthNet, balanceSeries, monthlyData, categoryBreakdown,
    loading, error,
    addTransaction, removeTransaction,
    addGoal, removeGoal,
    updateSettings,
  } = useSavings();

  if (!user && !loading) return <AuthScreen />;
  if (loading)           return <Spinner label="Loading your savings…" />;
  if (error)             return (
    <div className="min-h-screen flex items-center justify-center text-red-500 text-sm font-semibold">
      Error: {error}
    </div>
  );

  const currencySymbol = settings?.currency_symbol ?? '₱';

  return (
    <div className="flex min-h-screen bg-[#F5F8F0] font-sans">
      {/* Sidebar (desktop) / bottom nav (mobile) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        balance={balance}
        currencySymbol={currencySymbol}
        userName={user?.email}
      />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Suspense fallback={<Spinner />}>
            {activeTab === 'dashboard' && (
              <Dashboard
                balance={balance}
                totalDeposited={totalDeposited}
                totalWithdrawn={totalWithdrawn}
                monthNet={monthNet}
                balanceSeries={balanceSeries}
                goals={goals}
                transactions={transactions}
                currencySymbol={currencySymbol}
                addTransaction={addTransaction}
              />
            )}
            {activeTab === 'transactions' && (
              <TransactionHistory
                transactions={transactions}
                currencySymbol={currencySymbol}
                removeTransaction={removeTransaction}
              />
            )}
            {activeTab === 'goals' && (
              <Goals
                goals={goals}
                transactions={transactions}
                currencySymbol={currencySymbol}
                addGoal={addGoal}
                removeGoal={removeGoal}
                addTransaction={addTransaction}
              />
            )}
            {activeTab === 'insights' && (
              <Insights
                balanceSeries={balanceSeries}
                monthlyData={monthlyData}
                categoryBreakdown={categoryBreakdown}
                currencySymbol={currencySymbol}
                monthNet={monthNet}
                totalDeposited={totalDeposited}
                totalWithdrawn={totalWithdrawn}
              />
            )}
            {activeTab === 'assistant' && (
              <AIChat
                balance={balance}
                totalDeposited={totalDeposited}
                totalWithdrawn={totalWithdrawn}
                monthNet={monthNet}
                goals={goals}
                transactions={transactions}
                settings={settings}
                currencySymbol={currencySymbol}
                updateSettings={updateSettings}
              />
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
