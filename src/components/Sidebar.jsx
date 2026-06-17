// src/components/Sidebar.jsx
// ─────────────────────────────────────────────────────────────
// Persistent left-side navigation.
// On mobile it collapses to a bottom tab bar (Tailwind md: prefix).
// ─────────────────────────────────────────────────────────────

import { Sprout, LayoutDashboard, ArrowRightLeft, Target, BarChart3, MessageCircle, LogOut, Settings } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',    icon: LayoutDashboard },
  { id: 'goals',        label: 'Goals',        icon: Target          },
  { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft  },
  { id: 'insights',     label: 'Insights',     icon: BarChart3       },
  { id: 'assistant',    label: 'AI Assistant', icon: MessageCircle   },
];

/**
 * @param {{ activeTab: string, setActiveTab: Function, balance: number, currencySymbol: string, userName: string }} props
 */
export default function Sidebar({ activeTab, setActiveTab, balance, currencySymbol = '₱', userName }) {
  const fmtBalance = (n) =>
    currencySymbol +
    Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen bg-[#1F3D2B] text-white px-4 py-6 shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-9 h-9 rounded-xl bg-[#C7E26E] flex items-center justify-center shrink-0">
            <Sprout size={20} className="text-[#1F3D2B]" />
          </div>
          <div>
            <p className="font-serif text-lg font-semibold leading-none">Sprout</p>
            <p className="text-xs text-[#8FBF6F] mt-0.5">Savings Tracker</p>
          </div>
        </div>

        {/* Balance pill */}
        <div className="bg-[#2D5640] rounded-2xl p-4 mb-6">
          <p className="text-xs text-[#C7E26E] font-mono uppercase tracking-widest mb-1">Balance</p>
          <p className="text-2xl font-mono font-bold text-white">{fmtBalance(balance)}</p>
          {userName && (
            <p className="text-xs text-[#8FBF6F] mt-2 truncate">
              {userName.split('@')[0]}
            </p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 flex flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
                transition-all duration-150 text-left w-full
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
        <div className="mt-auto pt-4 border-t border-[#2D5640] flex flex-col gap-1">
          <button
            onClick={() => setActiveTab('settings')}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#A5C9A0] hover:bg-[#2D5640] hover:text-white transition-all"
          >
            <Settings size={16} /> Settings
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-[#A5C9A0] hover:bg-red-900/40 hover:text-red-300 transition-all"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1F3D2B] border-t border-[#2D5640] flex">
        {NAV_ITEMS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              flex-1 flex flex-col items-center py-3 text-xs font-semibold gap-1
              ${activeTab === id ? 'text-[#C7E26E]' : 'text-[#6B9A66]'}
            `}
          >
            <Icon size={20} />
          </button>
        ))}
      </nav>
    </>
  );
}
