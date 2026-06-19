// src/components/Sidebar.jsx
import { Sprout, LayoutDashboard, Target, BarChart3, MessageCircle, Settings, Receipt, ChevronLeft } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'goals',      label: 'Goals',        icon: Target          },
  { id: 'bills',      label: 'Bills',        icon: Receipt         },
  { id: 'assistant',  label: 'AI Assistant', icon: MessageCircle   },
  { id: 'activity',   label: 'Activity',     icon: BarChart3       },
];

const PAGE_TITLES = {
  dashboard:  'Dashboard',
  goals:      'Goals',
  bills:      'Bills',
  assistant:  'AI Assistant',
  activity:   'Activity',
  settings:   'Settings',
};

export default function Sidebar({ activeTab, setActiveTab, balance, currencySymbol = '₱', userName, scrolled = false }) {
  const fmtBalance = (n) =>
    currencySymbol +
    Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const isSettings = activeTab === 'settings';

  return (
    <>
      {/* ── Desktop fixed sidebar ── */}
      <div className="hidden md:flex flex-col w-64 h-screen bg-[#1F3D2B] text-white px-4 py-6 overflow-hidden">

        {/* Logo */}
        <div
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 mb-8 px-2 cursor-pointer group select-none"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab('dashboard'); }}
        >
          <div className="w-9 h-9 rounded-xl bg-[#C7E26E] flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
            <Sprout size={20} className="text-[#1F3D2B]" />
          </div>
          <div>
            <p className="font-serif text-lg font-semibold leading-none group-hover:text-[#C7E26E] transition-colors">Sprout</p>
            <p className="text-xs text-[#8FBF6F] mt-0.5">Savings Tracker</p>
          </div>
        </div>

        {/* Balance pill */}
        <div className="bg-[#2D5640] rounded-2xl p-4 mb-6 shrink-0">
          <p className="text-xs text-[#C7E26E] font-mono uppercase tracking-widest mb-1">Balance</p>
          <p className="text-2xl font-mono font-bold text-white">{fmtBalance(balance)}</p>
          {userName && (
            <p className="text-xs text-[#8FBF6F] mt-2 truncate">
              {userName.split('@')[0]}
            </p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-1 overflow-hidden">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
                transition-all duration-150 text-left w-full shrink-0
                ${activeTab === id
                  ? 'bg-[#C7E26E] text-[#1F3D2B]'
                  : 'text-[#A5C9A0] hover:bg-[#2D5640] hover:text-white'
                }
              `}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 pt-4 border-t border-[#2D5640] flex flex-col gap-1">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all
              ${activeTab === 'settings'
                ? 'bg-[#C7E26E] text-[#1F3D2B]'
                : 'text-[#A5C9A0] hover:bg-[#2D5640] hover:text-white'
              }`}
          >
            <Settings size={16} /> Settings
          </button>
        </div>
      </div>

      {/* ── Mobile: floating back button for settings only ── */}
      {isSettings && (
        <button
          onClick={() => setActiveTab('dashboard')}
          aria-label="Go back"
          className="md:hidden fixed left-4 z-50 flex items-center justify-center w-9 h-9 rounded-full active:scale-95 select-none"
          style={{
            top: scrolled ? '12px' : '32px',
            transition: 'top 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, transform 0.3s ease',
            opacity: scrolled ? 0.7 : 1,
            transform: scrolled ? 'scale(0.85)' : 'scale(1)',
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          }}
        >
          <ChevronLeft size={18} className="text-[#1F3D2B]" />
        </button>
      )}

      {/* ── Mobile top nav bar — hidden on settings ── */}
      {!isSettings && (
        <div
          className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#1F3D2B]"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.12)' }}
        >
          {/* Top row */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div
              onClick={() => setActiveTab('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <div className="w-8 h-8 rounded-xl bg-[#C7E26E] flex items-center justify-center shrink-0">
                <Sprout size={17} className="text-[#1F3D2B]" />
              </div>
              <div className="flex flex-col justify-center">
                <span className="font-serif text-white font-semibold text-base leading-none tracking-tight">
                  Sprout
                </span>
                <span className="text-[#8FBF6F] text-[11px] font-medium leading-none mt-0.5 tracking-wide">
                  {activeTab === 'dashboard' ? 'Savings Tracker' : PAGE_TITLES[activeTab]}
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('settings')}
              className="w-8 h-8 rounded-full bg-[#2D5640] flex items-center justify-center transition-colors active:bg-[#C7E26E]"
            >
              <Settings size={15} className="text-[#A5C9A0]" />
            </button>
          </div>

          {/* Icon tabs */}
          <nav className="flex border-t border-[#2D5640]/60">
            {NAV_ITEMS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className="flex-1 flex flex-col items-center py-3 relative"
              >
                <Icon
                  size={22}
                  className={`transition-colors duration-150 ${activeTab === id ? 'text-[#C7E26E]' : 'text-[#5A8A54]'}`}
                />
                {activeTab === id && (
                  <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-[#C7E26E]" />
                )}
              </button>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}