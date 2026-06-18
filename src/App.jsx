// src/App.jsx
import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Goals from './components/Goals';
import TransactionHistory from './components/TransactionHistory';
import Insights from './components/Insights';
import AIChat from './components/AIChat';
import Settings from './components/Settings';
import { useSavings } from './hooks/useSavings';

export default function App() {
  const {
    user, loading, error, transactions,
    goals: computedGoals, settings,
    balance, totalDeposited, totalWithdrawn,
    monthNet, balanceSeries,
    addTransaction, removeTransaction,
    addGoal, removeGoal, updateSettings,
  } = useSavings();

  const [activeTab, setActiveTab] = useState('dashboard');

  console.log('📊 [App.jsx Monitor] — User State:', {
    isAuthenticated: !!user,
    currentUserId: user?.id || 'None',
    appIsLoading: loading,
    globalError: error,
    loadedTransactions: transactions?.length || 0,
    loadedGoals: computedGoals?.length || 0,
    currentTab: activeTab,
  });

  useEffect(() => {
    const handleBeforeUnload = () => {
      console.warn('⚠️ CRITICAL ALERT: A script or component just tried to automatically refresh or close the browser tab!');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#F5F8F0' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #1F3D2B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: '#1F3D2B', fontWeight: 'bold' }}>Synchronizing Secure Ledgers...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    console.log('🔒 [App.jsx Routing] No active session found. Rendering Auth Gateway.');
    return <Auth />;
  }

  console.log('🔓 [App.jsx Routing] Session confirmed! Mounting App Framework.');

  const activeCurrency = settings?.currency_symbol || '₱';

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            balance={balance}
            monthNet={monthNet}
            balanceSeries={balanceSeries}
            goals={computedGoals}
            addTransaction={addTransaction}
            currencySymbol={activeCurrency}
            setActiveTab={setActiveTab}
          />
        );
      case 'transactions':
        return (
          <TransactionHistory
            transactions={transactions}
            removeTransaction={removeTransaction}
            currencySymbol={activeCurrency}
          />
        );
      case 'goals':
        return (
          <Goals
            goals={computedGoals}
            addGoal={addGoal}
            removeGoal={removeGoal}
            addTransaction={addTransaction}
            balance={balance}
            currencySymbol={activeCurrency}
          />
        );
      case 'insights':
        return (
          <Insights
            transactions={transactions}
            goals={computedGoals}
            totalDeposited={totalDeposited}
            totalWithdrawn={totalWithdrawn}
            monthNet={monthNet}
            balanceSeries={balanceSeries}
            currencySymbol={activeCurrency}
          />
        );
      case 'assistant':
        return (
          <AIChat
            transactions={transactions}
            goals={computedGoals}
            currencySymbol={activeCurrency}
            settings={settings}
            updateSettings={updateSettings}
          />
        );
      case 'settings':
        return (
          <Settings
            user={user}
            settings={settings}
            updateSettings={updateSettings}
          />
        );
      default:
        return <div className="text-gray-500 font-medium p-4">Workspace not found.</div>;
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8F0]">
      <aside className="hidden md:block fixed top-0 left-0 h-screen w-64 z-40">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          balance={balance ?? 0}
          currencySymbol={activeCurrency}
          userName={user?.email || 'User Workspace'}
        />
      </aside>
      <main className="md:ml-64 min-h-screen overflow-y-auto pb-16 md:pb-0">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8">
          {renderActiveContent()}
        </div>
      </main>
      <div className="md:hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          balance={balance ?? 0}
          currencySymbol={activeCurrency}
          userName={user?.email || 'User Workspace'}
        />
      </div>
    </div>
  );
}