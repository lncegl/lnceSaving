// src/components/Goals.jsx
// ─────────────────────────────────────────────────────────────
// Props (from App.jsx):
//   goals           – Array  – rows from goal_progress DB view
//   transactions    – Array  – all user transactions
//   currencySymbol  – string
//   addGoal         – async (payload) => savedGoal
//   removeGoal      – async (id) => void
//   addTransaction  – async (payload) => savedTx
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  Target, Plus, Trash2, Leaf, Sun, CalendarDays,
  TrendingUp, AlertCircle, CheckCircle2, Clock,
} from 'lucide-react';

// ── Formatting helpers ───────────────────────────────────────
function fmt(n, symbol = '₱') {
  return (
    symbol +
    Number(n).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function formatDate(d) {
  if (!d) return null;
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  } catch { return d; }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  const now    = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target - now) / 86_400_000);
}

// How much the user needs to save per day to hit the goal in time
function dailySavingsNeeded(remaining, dateStr) {
  const days = daysUntil(dateStr);
  if (!days || days <= 0 || remaining <= 0) return null;
  return remaining / days;
}

// ── VineProgress ─────────────────────────────────────────────
function VineProgress({ percent }) {
  const p         = Math.min(100, Math.max(0, Number(percent) || 0));
  const leafStops = [12, 28, 46, 64, 82].filter((s) => s <= p);
  return (
    <div className="relative h-3.5 rounded-full bg-green-100 overflow-visible my-3">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#2D5640] via-[#4F7E5B] to-[#C7E26E] transition-all duration-700 ease-out"
        style={{ width: `${p}%` }}
      />
      {leafStops.map((s, i) => (
        <Leaf
          key={i}
          size={13}
          className="absolute -top-0.5 text-[#1F3D2B] drop-shadow-sm"
          style={{ left: `${s}%`, transform: 'translateX(-50%) rotate(-12deg)' }}
        />
      ))}
      {p >= 100 && (
        <Sun
          size={17}
          className="absolute -top-1 right-0 text-yellow-400 drop-shadow"
          title="Goal reached! 🎉"
        />
      )}
    </div>
  );
}

// ── StatusPill ───────────────────────────────────────────────
function StatusPill({ days, percent }) {
  if (percent >= 100)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
        <CheckCircle2 size={12} /> Completed
      </span>
    );
  if (days === null)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
        No deadline
      </span>
    );
  if (days < 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
        <AlertCircle size={12} /> {Math.abs(days)}d overdue
      </span>
    );
  if (days <= 14)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2.5 py-1">
        <Clock size={12} /> {days}d left
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
      <CalendarDays size={12} /> {days}d left
    </span>
  );
}

// ── QuickDeposit ─────────────────────────────────────────────
function QuickDeposit({ goalId, goalName, addTransaction, currencySymbol }) {
  const [amount,  setAmount]  = useState('');
  const [note,    setNote]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [err,     setErr]     = useState('');

  async function handleAdd() {
    const n = parseFloat(amount);
    if (!n || n <= 0) { setErr('Enter a valid amount.'); return; }
    setSaving(true);
    setErr('');
    try {
      await addTransaction({
        type:     'deposit',
        amount:   n,
        category: 'Savings Transfer',
        note:     note.trim() || null,
        date:     today(),
        goal_id:  goalId,
      });
      setAmount('');
      setNote('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 mb-2">Add savings toward this goal</p>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Amount"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setErr(''); }}
          className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
        />
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
        />
        <button
          onClick={handleAdd}
          disabled={saving}
          className="bg-[#1F3D2B] text-[#C7E26E] px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
        >
          {saving ? '…' : 'Add'}
        </button>
      </div>
      {err     && <p className="text-xs text-red-500 font-semibold mt-1.5">{err}</p>}
      {success && (
        <p className="text-xs text-green-700 font-semibold mt-1.5 flex items-center gap-1">
          <CheckCircle2 size={12} /> Saved! Great work 🌱
        </p>
      )}
    </div>
  );
}

// ── GoalCard ──────────────────────────────────────────────────
function GoalCard({ g, currencySymbol, removeGoal, addTransaction }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [expanded,   setExpanded]   = useState(false);

  const saved     = Number(g.saved_amount   ?? 0);
  const target    = Number(g.target_amount  ?? 0);
  const percent   = Number(g.progress_percent ?? 0);
  const remaining = Math.max(0, target - saved);
  const days      = daysUntil(g.target_date);
  const daily     = dailySavingsNeeded(remaining, g.target_date);

  async function handleDelete() {
    setDeleting(true);
    try { await removeGoal(g.id); }
    catch { setDeleting(false); setConfirming(false); }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg text-[#1F3D2B] leading-snug truncate">{g.name}</h3>
          {g.target_date && (
            <p className="text-xs text-gray-400 mt-0.5">
              Target date: {formatDate(g.target_date)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill days={days} percent={percent} />
          {!confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="text-gray-300 hover:text-red-400 transition-colors p-1"
              aria-label="Delete goal"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {confirming && (
        <div className="mt-3 flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <p className="text-xs text-red-700 font-semibold flex-1">Delete "{g.name}"? This can't be undone.</p>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-bold text-white bg-red-500 px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? '…' : 'Delete'}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-xs font-bold text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Progress */}
      <div className="mt-3">
        <div className="flex justify-between items-baseline mb-0.5">
          <span className="font-mono font-bold text-[#1F3D2B] text-sm">{fmt(saved, currencySymbol)}</span>
          <span className="text-xs text-gray-400 font-mono">of {fmt(target, currencySymbol)}</span>
        </div>
        <VineProgress percent={percent} />
        <div className="flex justify-between text-xs text-gray-400">
          <span>{Math.min(100, percent).toFixed(1)}% complete</span>
          {remaining > 0 && <span>{fmt(remaining, currencySymbol)} to go</span>}
        </div>
      </div>

      {/* Insight strip */}
      {daily && remaining > 0 && (
        <div className="mt-3 flex items-center gap-2 bg-[#F0F7EC] border border-[#C7E26E]/40 rounded-xl px-3 py-2">
          <TrendingUp size={14} className="text-green-700 shrink-0" />
          <p className="text-xs text-green-800 font-semibold">
            Save {fmt(daily, currencySymbol)}/day to hit your target on time.
          </p>
        </div>
      )}
      {percent >= 100 && (
        <div className="mt-3 flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
          <Sun size={14} className="text-yellow-500 shrink-0" />
          <p className="text-xs text-yellow-800 font-semibold">
            Goal reached! You can keep adding or create a new challenge.
          </p>
        </div>
      )}

      {/* Quick deposit */}
      {percent < 100 && (
        <QuickDeposit
          goalId={g.id}
          goalName={g.name}
          addTransaction={addTransaction}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
}

// ── Main Goals Component ──────────────────────────────────────
export default function Goals({
  goals,
  transactions,
  currencySymbol = '₱',
  addGoal,
  removeGoal,
  addTransaction,
}) {
  // Form state
  const [name,       setName]       = useState('');
  const [targetAmt,  setTargetAmt]  = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [formErr,    setFormErr]    = useState('');

  // Filter
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed'

  const filtered = goals.filter((g) => {
    const pct = Number(g.progress_percent ?? 0);
    if (filter === 'active')    return pct < 100;
    if (filter === 'completed') return pct >= 100;
    return true;
  });

  // Aggregate stats
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount ?? 0), 0);
  const totalSaved  = goals.reduce((s, g) => s + Number(g.saved_amount  ?? 0), 0);
  const completedCount = goals.filter((g) => Number(g.progress_percent ?? 0) >= 100).length;

  async function handleCreateGoal(e) {
    e.preventDefault();
    setFormErr('');
    const n = parseFloat(targetAmt);
    if (!name.trim()) { setFormErr('Give your goal a name.');      return; }
    if (!n || n <= 0) { setFormErr('Enter a valid target amount.'); return; }

    setSaving(true);
    try {
      await addGoal({
        name:          name.trim(),
        target_amount: n,
        target_date:   targetDate || null,
      });
      setName('');
      setTargetAmt('');
      setTargetDate('');
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Summary bar ── */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total goals',  value: goals.length },
            { label: 'Completed',    value: completedCount },
            { label: 'Total saved',  value: fmt(totalSaved, currencySymbol) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
              <p className="font-mono font-bold text-[#1F3D2B] text-lg">{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Create goal form ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h2 className="font-serif text-xl text-[#1F3D2B] mb-4 flex items-center gap-2">
          <Plus size={18} className="text-[#4F7E5B]" /> New savings goal
        </h2>
        <form onSubmit={handleCreateGoal} className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-500 font-semibold">Goal name</span>
            <input
              type="text"
              placeholder="e.g. Emergency fund, Japan trip, New laptop"
              value={name}
              onChange={(e) => { setName(e.target.value); setFormErr(''); }}
              required
              className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 font-semibold">Target amount</span>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={targetAmt}
                  onChange={(e) => { setTargetAmt(e.target.value); setFormErr(''); }}
                  required
                  className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs text-gray-500 font-semibold">Target date (optional)</span>
              <input
                type="date"
                min={today()}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
              />
            </label>
          </div>

          {formErr && (
            <p className="text-xs text-red-500 font-semibold flex items-center gap-1">
              <AlertCircle size={12} /> {formErr}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#1F3D2B] text-[#C7E26E] font-bold py-2.5 rounded-xl text-sm hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            <Leaf size={15} />
            {saving ? 'Planting goal…' : 'Plant this goal'}
          </button>
        </form>
      </div>

      {/* ── Goal list ── */}
      {goals.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
            <Target size={26} className="text-green-400" />
          </div>
          <p className="font-serif text-lg text-[#1F3D2B]">No goals planted yet</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
            Set a target and a date above, then water it with deposits to watch it grow.
          </p>
        </div>
      ) : (
        <>
          {/* Filter tabs */}
          <div className="flex gap-2">
            {[
              { value: 'all',       label: `All (${goals.length})` },
              { value: 'active',    label: 'In progress' },
              { value: 'completed', label: `Done (${completedCount})` },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  filter === value
                    ? 'bg-[#1F3D2B] text-[#C7E26E] border-[#1F3D2B]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-8">
              No {filter} goals found.
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((g) => (
                <GoalCard
                  key={g.id}
                  g={g}
                  currencySymbol={currencySymbol}
                  removeGoal={removeGoal}
                  addTransaction={addTransaction}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}