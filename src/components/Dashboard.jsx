// src/components/Dashboard.jsx
import { useState } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Target, Plus, Leaf, Sun, AlertTriangle, Receipt, ArrowDownLeft, ArrowUpRight, X, Clock } from 'lucide-react';

const TX_CATEGORIES = [
  'Other','Salary','Allowance','Gift','Freelance',
  'Groceries','Bills','Transport','Entertainment',
  'Health','Savings Transfer',
];

function fmt(n, symbol = '₱') {
  return symbol + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(dateStr) {
  if (!dateStr) return '';
  // Parse as local date to avoid UTC timezone shifting
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const diff = Math.round((todayMidnight - date) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff}d ago`;
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
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
        <Leaf key={i} size={14} className="absolute -top-0.5 text-green-800"
          style={{ left: `${s}%`, transform: 'translateX(-50%) rotate(-15deg)' }} />
      ))}
      {p >= 100 && <Sun size={16} className="absolute -top-1 right-0 text-yellow-500" />}
    </div>
  );
}

// ── Category colour chips ──────────────────────────────────────────────────
const CATEGORY_COLORS = {
  Salary:           'bg-green-100 text-green-800',
  Allowance:        'bg-teal-100 text-teal-800',
  Gift:             'bg-pink-100 text-pink-800',
  Freelance:        'bg-indigo-100 text-indigo-800',
  Groceries:        'bg-yellow-100 text-yellow-800',
  Bills:            'bg-red-100 text-red-800',
  Transport:        'bg-sky-100 text-sky-800',
  Entertainment:    'bg-purple-100 text-purple-800',
  Health:           'bg-rose-100 text-rose-800',
  'Savings Transfer':'bg-lime-100 text-lime-800',
  Other:            'bg-gray-100 text-gray-600',
};

export default function Dashboard({
  balance, monthNet, balanceSeries, goals,
  unpaidUrgentBills = [],
  transactions = [],
  currencySymbol = '₱', addTransaction, setActiveTab,
}) {
  const [type,     setType]     = useState('deposit');
  const [amount,   setAmount]   = useState('');
  const [category, setCategory] = useState(TX_CATEGORIES[0]);
  const [note,     setNote]     = useState('');
  const [goalId,   setGoalId]   = useState('');
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState('');
  const [modal,    setModal]    = useState(null);

  function openModal(t) {
    setType(t);
    setAmount('');
    setNote('');
    setGoalId('');
    setFormErr('');
    setCategory(TX_CATEGORIES[0]);
    setModal(t);
  }

  function closeModal() {
    setModal(null);
    setFormErr('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormErr('');
    const n = parseFloat(amount);
    if (!n || n <= 0) { setFormErr('Enter a valid amount.'); return; }
    if (type === 'withdrawal' && n > balance) {
      setFormErr(`Withdrawal amount exceeds your available balance of ${fmt(balance, currencySymbol)}.`);
      return;
    }
    setSaving(true);
    try {
      await addTransaction({
        type, amount: n, category,
        note: note.trim() || null,
        date: today(),
        goal_id: type === 'deposit' ? (goalId || null) : null,
      });
      setAmount(''); setNote(''); setGoalId('');
      closeModal();
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  const netUp = monthNet >= 0;
  const overdueBills = unpaidUrgentBills.filter(b => b.isOverdue);
  const dueSoonBills = unpaidUrgentBills.filter(b => b.isUrgent);

  // Show 5 most-recent transactions on the dashboard
  const recentTx = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className="space-y-4">

      {/* ── Hero balance card ── */}
      <div className="bg-[#1F3D2B] text-white rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-40 h-40 bg-[#C7E26E]/10 rounded-full" />

        <p className="text-xs font-mono uppercase tracking-widest text-[#C7E26E] mb-1">Total balance</p>

        {/* Balance row — buttons hidden on mobile, shown on desktop */}
        <div className="flex items-center gap-4">
          <p className="text-4xl font-serif font-semibold">{fmt(balance, currencySymbol)}</p>
          <div className="hidden md:flex gap-2">
            <button
              type="button"
              onClick={() => openModal('deposit')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#C7E26E]/20 text-[#C7E26E] hover:bg-[#C7E26E]/30 border border-[#C7E26E]/30 transition-all"
            >
              + Deposit
            </button>
            <button
              type="button"
              onClick={() => openModal('withdrawal')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/20 border border-white/20 transition-all"
            >
              - Withdraw
            </button>
          </div>
        </div>

        {/* Month net */}
        <div className={`flex items-center gap-1.5 mt-3 text-sm font-semibold ${netUp ? 'text-[#C7E26E]' : 'text-yellow-300'}`}>
          {netUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          {fmt(Math.abs(monthNet), currencySymbol)} {netUp ? 'saved' : 'spent'} this month
        </div>

        {balanceSeries.length > 1 && (
          <div className="mt-4 -mx-2">
            <ResponsiveContainer width="100%" height={64}>
              <AreaChart data={balanceSeries}>
                <defs>
                  <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#C7E26E" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#C7E26E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="balance" stroke="#C7E26E" strokeWidth={2} fill="url(#hg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Mobile action banner — deposit & withdraw ── */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openModal('deposit')}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#1F3D2B] text-[#C7E26E] font-bold text-sm shadow-sm active:scale-95 transition-transform"
        >
          + Deposit
        </button>
        <button
          type="button"
          onClick={() => openModal('withdrawal')}
          className="flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 font-bold text-sm shadow-sm active:scale-95 transition-transform"
        >
          - Withdraw
        </button>
      </div>

      {/* ── Bills banner ── */}
      {(() => {
        const hasOverdue = overdueBills.length > 0;
        const hasUrgent  = dueSoonBills.length > 0;
        const isAlert    = hasOverdue || hasUrgent;

        return (
          <div className={`border rounded-2xl p-4 space-y-2 transition-colors ${
            hasOverdue
              ? 'bg-red-50 border-red-200'
              : hasUrgent
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-white border-gray-100'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className={`shrink-0 ${
                  hasOverdue ? 'text-red-500' : hasUrgent ? 'text-yellow-600' : 'text-gray-300'
                }`} />
                <p className={`text-sm font-bold ${
                  hasOverdue ? 'text-red-700' : hasUrgent ? 'text-yellow-800' : 'text-gray-400'
                }`}>
                  {hasOverdue && hasUrgent
                    ? 'Bills overdue & due soon'
                    : hasOverdue
                      ? `${overdueBills.length} bill${overdueBills.length > 1 ? 's' : ''} overdue`
                      : hasUrgent
                        ? `${dueSoonBills.length} bill${dueSoonBills.length > 1 ? 's' : ''} due soon`
                        : 'All bills are on track'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('bills')}
                className={`text-xs font-bold underline underline-offset-2 transition-colors ${
                  hasOverdue ? 'text-red-600 hover:text-red-800' : hasUrgent ? 'text-yellow-700 hover:text-yellow-900' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                View bills →
              </button>
            </div>

            {isAlert && (
              <ul className="space-y-1">
                {unpaidUrgentBills.map(b => (
                  <li key={b.id} className="flex items-center justify-between text-xs text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <Receipt size={11} className="shrink-0" />
                      <span className="font-semibold">{b.name}</span>
                      {b.isOverdue
                        ? <span className="text-red-600 font-bold">· Overdue</span>
                        : <span className="text-yellow-600">· Due in {b.daysUntilDue}d</span>}
                    </span>
                    <span className="font-mono font-bold">{fmt(b.amount, currencySymbol)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* ── Goals at a glance ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-lg text-[#1F3D2B]">Goals at a glance</h2>
          <button
            onClick={() => setActiveTab('goals')}
            className="text-xs text-gray-400 hover:text-[#1F3D2B] font-semibold transition-colors"
          >
            View all →
          </button>
        </div>
        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center text-gray-400">
            <Target size={28} className="mb-2 text-green-300" />
            <p className="text-sm font-semibold">No goals yet</p>
            <button
              onClick={() => setActiveTab('goals')}
              className="text-xs text-gray-400 hover:text-[#1F3D2B] font-semibold mt-1 transition-colors"
            >
              Create one in Goals →
            </button>
          </div>
        ) : (
          <ul className="space-y-4">
            {goals.slice(0, 4).map((g) => {
              const pct   = Number(g.progress_percent ?? 0);
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

      {/* ── Recent Activity ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[#1F3D2B]" />
            <h2 className="font-serif text-lg text-[#1F3D2B]">Recent activity</h2>
          </div>
          <button
            onClick={() => setActiveTab('activity')}
            className="text-xs text-gray-400 hover:text-[#1F3D2B] font-semibold transition-colors"
          >
            View all →
          </button>
        </div>

        {recentTx.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center text-gray-400">
            <ArrowDownLeft size={24} className="mb-2 text-gray-200" />
            <p className="text-sm font-semibold">No transactions yet</p>
            <p className="text-xs mt-0.5">Your deposits and withdrawals will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {recentTx.map((tx) => {
              const isDeposit = tx.type === 'deposit';
              const chipColor = CATEGORY_COLORS[tx.category] ?? CATEGORY_COLORS.Other;
              return (
                <li key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {/* Icon bubble */}
                  <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${
                    isDeposit ? 'bg-green-50' : 'bg-red-50'
                  }`}>
                    {isDeposit
                      ? <ArrowDownLeft size={16} className="text-green-600" />
                      : <ArrowUpRight  size={16} className="text-red-400" />}
                  </div>

                  {/* Label + category */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {tx.note || tx.category || (isDeposit ? 'Deposit' : 'Withdrawal')}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${chipColor}`}>
                        {tx.category || 'Other'}
                      </span>
                      <span className="text-[10px] text-gray-400">{fmtDate(tx.date)}</span>
                    </div>
                  </div>

                  {/* Amount */}
                  <p className={`text-sm font-mono font-bold shrink-0 ${
                    isDeposit ? 'text-green-700' : 'text-red-500'
                  }`}>
                    {isDeposit ? '+' : '-'}{fmt(tx.amount, currencySymbol)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Transaction modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className={`flex items-center justify-between px-5 py-4 ${
              modal === 'deposit' ? 'bg-green-50 border-b border-green-100' : 'bg-yellow-50 border-b border-yellow-100'
            }`}>
              <div className="flex items-center gap-2">
                {modal === 'deposit'
                  ? <ArrowDownLeft size={17} className="text-green-700" />
                  : <ArrowUpRight size={17} className="text-yellow-700" />}
                <p className={`text-sm font-bold ${modal === 'deposit' ? 'text-green-800' : 'text-yellow-800'}`}>
                  {modal === 'deposit' ? 'Add a deposit' : 'Record a withdrawal'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-black/5"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <label className="block">
                <span className="text-xs text-gray-500 font-semibold">Amount</span>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setFormErr(''); }}
                    autoFocus
                    required
                    className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
                  />
                </div>
              </label>

              <div className={`grid gap-3 ${modal === 'deposit' && goals.length > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <label className="block">
                  <span className="text-xs text-gray-500 font-semibold">Category</span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
                  >
                    {TX_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                {modal === 'deposit' && goals.length > 0 && (
                  <label className="block">
                    <span className="text-xs text-gray-500 font-semibold">Allocate to goal</span>
                    <select
                      value={goalId}
                      onChange={(e) => setGoalId(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
                    >
                      <option value="">None</option>
                      {goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <label className="block">
                <span className="text-xs text-gray-500 font-semibold">Note (optional)</span>
                <input
                  type="text"
                  placeholder={modal === 'deposit' ? 'e.g. Monthly salary' : 'e.g. Grocery run'}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
                />
              </label>

              {formErr && <p className="text-xs text-red-500 font-semibold">{formErr}</p>}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className={`flex-1 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity ${
                    modal === 'deposit'
                      ? 'bg-[#1F3D2B] text-[#C7E26E]'
                      : 'bg-yellow-500 text-white'
                  }`}
                >
                  <Plus size={15} />
                  {saving ? 'Saving…' : modal === 'deposit' ? 'Add deposit' : 'Record withdrawal'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}