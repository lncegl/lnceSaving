// src/components/Dashboard.jsx
// ─────────────────────────────────────────────────────────────
// Main landing view.  Receives pre-computed data from useSavings
// via props — no Supabase calls happen here.
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  AreaChart, Area,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, TrendingDown, ArrowUpCircle, ArrowDownCircle,
  Target, Plus, Leaf, Sun,
} from 'lucide-react';

const TX_CATEGORIES = [
  'Salary','Allowance','Gift','Freelance',
  'Groceries','Bills','Transport','Entertainment',
  'Health','Savings Transfer','Other',
];

// ─── tiny helpers ───────────────────────────────────────────
function fmt(n, symbol = '₱') {
  return symbol + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() { return new Date().toISOString().slice(0, 10); }

// ─── sub-components ─────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent }) {
  const iconBg = { green: 'bg-green-100 text-green-700', gold: 'bg-yellow-100 text-yellow-700', forest: 'bg-emerald-100 text-emerald-800' }[accent];
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center gap-4 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
        <p className="text-xl font-mono font-bold text-gray-800">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function VineProgress({ percent }) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0));
  const leafStops = [15, 35, 55, 75, 95].filter((s) => s <= p);
  return (
    <div className="relative h-3 rounded-full bg-green-100 overflow-visible my-3">
      <div
        className="absolute top-0 left-0 h-3 rounded-full bg-gradient-to-r from-green-600 to-[#C7E26E] transition-all duration-500"
        style={{ width: `${p}%` }}
      />
      {leafStops.map((s, i) => (
        <Leaf
          key={i}
          size={14}
          className="absolute -top-0.5 text-green-800"
          style={{ left: `${s}%`, transform: 'translateX(-50%) rotate(-15deg)' }}
        />
      ))}
      {p >= 100 && (
        <Sun size={16} className="absolute -top-1 right-0 text-yellow-500" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

/**
 * @param {{
 *   balance: number, totalDeposited: number, totalWithdrawn: number,
 *   monthNet: number, balanceSeries: Array, goals: Array,
 *   currencySymbol: string, addTransaction: Function
 * }} props
 */
export default function Dashboard({
  balance, totalDeposited, totalWithdrawn,
  monthNet, balanceSeries, goals,
  currencySymbol = '₱', addTransaction,
}) {
  const [type,     setType]     = useState('deposit');
  const [amount,   setAmount]   = useState('');
  const [category, setCategory] = useState(TX_CATEGORIES[0]);
  const [note,     setNote]     = useState('');
  const [goalId,   setGoalId]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setFormErr('');
    const n = parseFloat(amount);
    if (!n || n <= 0) { setFormErr('Enter a valid amount.'); return; }

    setSaving(true);
    try {
      await addTransaction({
        type,
        amount:   n,
        category,
        note:     note.trim() || null,
        date:     today(),
        goal_id:  type === 'deposit' ? (goalId || null) : null,
      });
      setAmount('');
      setNote('');
      setGoalId('');
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  const netUp = monthNet >= 0;

  return (
    <div className="space-y-6">

      {/* ── Hero balance card ── */}
      <div className="bg-[#1F3D2B] text-white rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-40 h-40 bg-[#C7E26E]/10 rounded-full" />
        <p className="text-xs font-mono uppercase tracking-widest text-[#C7E26E] mb-1">Total balance</p>
        <p className="text-4xl font-serif font-semibold">{fmt(balance, currencySymbol)}</p>
        <div className={`flex items-center gap-1.5 mt-3 text-sm font-semibold ${netUp ? 'text-[#C7E26E]' : 'text-yellow-300'}`}>
          {netUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {fmt(Math.abs(monthNet), currencySymbol)} {netUp ? 'saved' : 'spent'} this month
        </div>

        {/* Sparkline */}
        {balanceSeries.length > 1 && (
          <div className="mt-4 -mx-2">
            <ResponsiveContainer width="100%" height={64}>
              <AreaChart data={balanceSeries}>
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#C7E26E" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#C7E26E" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="balance" stroke="#C7E26E" strokeWidth={2} fill="url(#hg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={ArrowUpCircle}  label="Total deposited"  value={fmt(totalDeposited,  currencySymbol)} accent="green"  />
        <StatCard icon={ArrowDownCircle} label="Total withdrawn" value={fmt(totalWithdrawn,  currencySymbol)} accent="gold"   />
        <StatCard icon={Target}          label="Active goals"    value={goals.length}                         accent="forest" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Quick-add transaction form ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="font-serif text-lg text-[#1F3D2B] mb-4">Log a transaction</h2>

          {/* Type toggle */}
          <div className="flex gap-2 mb-4">
            {['deposit', 'withdrawal'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold capitalize transition-all
                  ${type === t
                    ? t === 'deposit'
                      ? 'bg-green-100 text-green-800 border-2 border-green-400'
                      : 'bg-yellow-100 text-yellow-800 border-2 border-yellow-400'
                    : 'bg-gray-50 text-gray-400 border-2 border-transparent'
                  }`}
              >
                {t === 'deposit' ? '↑ ' : '↓ '}{t}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block">
              <span className="text-xs text-gray-500 font-semibold">Amount</span>
              <input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={amount} onChange={(e) => setAmount(e.target.value)} required
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
              />
            </label>

            <label className="block">
              <span className="text-xs text-gray-500 font-semibold">Category</span>
              <select
                value={category} onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
              >
                {TX_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>

            {type === 'deposit' && goals.length > 0 && (
              <label className="block">
                <span className="text-xs text-gray-500 font-semibold">Allocate to goal (optional)</span>
                <select
                  value={goalId} onChange={(e) => setGoalId(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
                >
                  <option value="">None</option>
                  {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-xs text-gray-500 font-semibold">Note (optional)</span>
              <input
                type="text" placeholder="e.g. Monthly salary" value={note} onChange={(e) => setNote(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
              />
            </label>

            {formErr && <p className="text-xs text-red-500 font-semibold">{formErr}</p>}

            <button
              type="submit" disabled={saving}
              className="w-full bg-[#1F3D2B] text-[#C7E26E] font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Plus size={16} /> {saving ? 'Saving…' : `Add ${type}`}
            </button>
          </form>
        </div>

        {/* ── Goals progress ── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <h2 className="font-serif text-lg text-[#1F3D2B] mb-4">Goals at a glance</h2>
          {goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center text-gray-400">
              <Target size={28} className="mb-2 text-green-300" />
              <p className="text-sm font-semibold">No goals yet</p>
              <p className="text-xs mt-1">Create a goal from the Goals tab.</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {goals.slice(0, 4).map((g) => {
                const pct  = Number(g.progress_percent ?? 0);
                const saved = Number(g.saved_amount ?? 0);
                return (
                  <li key={g.id}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-gray-700">{g.name}</span>
                      <span className="font-mono text-gray-500 text-xs">
                        {fmt(saved, currencySymbol)} / {fmt(g.target_amount, currencySymbol)}
                      </span>
                    </div>
                    <VineProgress percent={pct} />
                    <p className="text-xs text-gray-400">{Math.min(100, pct).toFixed(1)}% complete</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}