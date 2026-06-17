// src/App.jsx
// ─────────────────────────────────────────────────────────────
// Root component — updated from the original scaffold.
//
// Changes from the original version:
//   1. Removed the inline `AuthScreen` function →
//      replaced with `import Auth from './components/Auth'`
//   2. Added lazy import for `Settings`
//   3. Added `activeTab === 'settings'` render branch so the
//      Sidebar's Settings footer button actually works
//   4. Passed `user` to Settings (needed for profile display
//      and password-change re-authentication)
// ─────────────────────────────────────────────────────────────

import { useState, lazy, Suspense } from 'react';
import { Loader2 }           from 'lucide-react';
import { useSavings }        from './hooks/useSavings';
import Auth                  from './components/Auth';
import Sidebar               from './components/Sidebar';
import Dashboard             from './components/Dashboard';
import TransactionHistory    from './components/TransactionHistory';
import AIChat                from './components/AIChat';

// ── Lazy imports — loaded only when the user navigates there ──
// This keeps the initial JS bundle small.
const Goals    = lazy(() => import('./components/Goals'));
const Insights = lazy(() => import('./components/Insights'));
const Settings = lazy(() => import('./components/Settings'));

// ─────────────────────────────────────────────────────────────
// Shared loading spinner
// Used both as the Suspense fallback and the full-page data
// loading state while useSavings fetches from Supabase.
// ─────────────────────────────────────────────────────────────
function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <div className="w-12 h-12 rounded-2xl bg-[#1F3D2B] flex items-center justify-center">
        <Loader2 size={22} className="text-[#C7E26E] animate-spin" />
      </div>
      <p className="text-sm font-semibold text-gray-400">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Root App
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  // ── All data and actions come from one hook ──
  const {
    user,
    transactions,
    goals,
    settings,
    balance,
    totalDeposited,
    totalWithdrawn,
    monthNet,
    balanceSeries,
    monthlyData,
    categoryBreakdown,
    loading,
    error,
    addTransaction,
    removeTransaction,
    addGoal,
    removeGoal,
    updateSettings,
  } = useSavings();

  // ── Auth gate ──
  // While loading we show a spinner (not the auth screen) to avoid
  // a flash of the login form on every hard refresh.
  if (loading)          return <Spinner label="Loading your savings…" />;
  if (!user)            return <Auth />;

  // ── Unrecoverable error ──
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-serif text-[#1F3D2B]">Something went wrong</p>
        <p className="text-sm text-red-500 font-semibold max-w-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-secondary mt-2"
        >
          Reload page
        </button>
      </div>
    );
  }

  // Derive the currency symbol from settings; fall back to ₱
  const currencySymbol = settings?.currency_symbol ?? '₱';

  // ─────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-[#F5F8F0] font-sans">

      {/* Sidebar — desktop left rail + mobile bottom bar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        balance={balance}
        currencySymbol={currencySymbol}
        userName={user.email}
      />

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 py-6">

          {/*
            Suspense wraps ALL tabs because Goals, Insights, and Settings
            are lazy. Dashboard, Transactions, and AIChat are eagerly
            imported, so Suspense has zero cost when they're active.
          */}
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

            {/*
              ── Settings tab ──
              Routed to by Sidebar's footer "Settings" button.
              Receives `user` for profile display + password re-auth,
              `settings` for the current values, and `updateSettings`
              to write changes back to Supabase.
            */}
            {activeTab === 'settings' && (
              <Settings
                user={user}
                settings={settings}
                updateSettings={updateSettings}
              />
            )}

          </Suspense>
        </div>
      </main>
    </div>
  );
}