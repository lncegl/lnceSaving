// src/App.jsx
import { useState, useEffect, useRef } from 'react';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Goals from './components/Goals';
import Bills from './components/Bills';
import Activity from './components/Activity';
import AIChat from './components/AIChat';
import Settings from './components/Settings';
import ResetPassword from './components/ResetPassword'; // Added ResetPassword component
import { useSavings } from './hooks/useSavings';

export default function App() {
  const {
    user, loading, error, transactions,
    goals: computedGoals, settings,
    balance, totalDeposited, totalWithdrawn,
    monthNet, balanceSeries,
    billsWithStatus, unpaidUrgentBills,
    addTransaction, removeTransaction,
    addGoal, removeGoal, updateSettings,
    addBill, removeBill, updateBill, payBill, unpayBill, resetMonthlyBills,
  } = useSavings();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [scrolled, setScrolled] = useState(false);
  const mainRef = useRef(null);

  // Reset scroll + scrolled flag on tab change
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0;
    setScrolled(false);
  }, [activeTab]);

  // Track scroll position for back button animation
  useEffect(() => {
    const el = mainRef.current;
    if (!el || activeTab !== 'settings') return;
    const handleScroll = () => setScrolled(el.scrollTop > 40);
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

  console.log('📊 [App.jsx Monitor] — User State:', {
    isAuthenticated: !!user,
    currentUserId: user?.id || 'None',
    appIsLoading: loading,
    globalError: error,
    loadedTransactions: transactions?.length || 0,
    loadedGoals: computedGoals?.length || 0,
    loadedBills: billsWithStatus?.length || 0,
    currentTab: activeTab,
  });

  useEffect(() => {
    const handleBeforeUnload = () => {
      console.warn('⚠️ CRITICAL ALERT: A script or component just tried to automatically refresh or close the browser tab!');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // INTERCEPT RECOVERY FLOW: Renders the reset password layout before the authentication wall checks block it
  const isResetFlow = window.location.pathname === '/reset-password' || 
                      window.location.hash.includes('type=recovery');

  if (isResetFlow) {
    console.log('🔑 [App.jsx Routing] Recovery parameter caught. Mounting Reset Form.');
    return <ResetPassword />;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#F5F8F0' }}>
        <img src="/alden.jpg" alt="Logo" style={{ width: '132px', height: '132px', borderRadius: '16px', marginBottom: '16px' }} />
        <div style={{ width: '32px', height: '32px', border: '3px solid #1F3D2B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: '#1F3D2B', fontWeight: 'bold' }}>loading..  &gt;_&lt;</p>
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
            unpaidUrgentBills={unpaidUrgentBills}
            transactions={transactions}
            addTransaction={addTransaction}
            currencySymbol={activeCurrency}
            setActiveTab={setActiveTab}
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
      case 'bills':
        return (
          <Bills
            balance={balance}
            billsWithStatus={billsWithStatus}
            currencySymbol={activeCurrency}
            addBill={addBill}
            removeBill={removeBill}
            updateBill={updateBill}
            payBill={payBill}
            unpayBill={unpayBill}
            resetMonthlyBills={resetMonthlyBills}
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
      case 'activity':
        return (
          <Activity
            transactions={transactions}
            goals={computedGoals}
            totalDeposited={totalDeposited}
            totalWithdrawn={totalWithdrawn}
            monthNet={monthNet}
            balanceSeries={balanceSeries}
            currencySymbol={activeCurrency}
            removeTransaction={removeTransaction}
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
    <div className="h-screen overflow-hidden bg-[#F5F8F0] flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 h-screen shrink-0 z-40">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          balance={balance ?? 0}
          currencySymbol={activeCurrency}
          userName={user?.email || 'User Workspace'}
          scrolled={scrolled}
        />
      </aside>

      {/* Mobile top nav */}
      <div className="md:hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          balance={balance ?? 0}
          currencySymbol={activeCurrency}
          userName={user?.email || 'User Workspace'}
          scrolled={scrolled}
        />
      </div>

      {/* Main content area */}
      <main
        ref={mainRef}
        className={`flex-1 ${activeTab === 'assistant' ? 'overflow-hidden' : 'overflow-y-auto'}`}
        style={{ height: '100vh' }}
      >
        {activeTab === 'assistant' ? (
          <div
            className="flex flex-col h-full px-4 sm:px-6 md:px-8 md:py-8 md:max-w-5xl md:mx-auto"
            style={{ paddingTop: 'calc(108px + 1rem)' }}
          >
            <AIChat
              transactions={transactions}
              goals={computedGoals}
              currencySymbol={activeCurrency}
              settings={settings}
              updateSettings={updateSettings}
            />
          </div>
        ) : (
          <div
            className={`max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 ${
              activeTab === 'settings'
                ? 'pt-14'
                : 'pt-[124px]'
            } md:pt-6`}
          >
            {renderActiveContent()}
          </div>
        )}
      </main>

    </div>
  );
}