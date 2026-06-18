// src/components/Bills.jsx
import { useState } from 'react';
import {
  Receipt, Plus, Trash2, CheckCircle2, Clock, AlertCircle,
  AlertTriangle, RotateCcw, CalendarDays, Tag, Banknote,
  Pencil, X, Check,
} from 'lucide-react';

const BILL_CATEGORIES = [
  'Other', 'Rent', 'Electric', 'Water', 'Internet', 'Phone',
  'Netflix', 'Spotify', 'YouTube Premium', 'Insurance',
  'Loan', 'Groceries', 'Transport', 'Gym',
];

function fmt(n, symbol = '₱') {
  return (
    symbol +
    Number(n).toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function StatusPill({ bill }) {
  if (bill.isPaid)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
        <CheckCircle2 size={12} /> Paid
      </span>
    );
  if (bill.isOverdue)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-1">
        <AlertCircle size={12} /> Overdue
      </span>
    );
  if (bill.isUrgent)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-full px-2.5 py-1">
        <Clock size={12} /> Due in {bill.daysUntilDue}d
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
      <CalendarDays size={12} /> Due {ordinal(bill.due_day)}
    </span>
  );
}

// ── Pay Confirmation Modal ──────────────────────────────────────────────────
function PayConfirmModal({ bill, balance, currencySymbol, onConfirm, onCancel }) {
  const amount       = Number(bill.amount);
  const balanceAfter = balance - amount;
  const insufficient = amount > balance;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-green-50 rounded-xl">
            <Banknote size={22} className="text-green-600" />
          </div>
          <h4 className="font-serif font-bold text-gray-900">Confirm Payment</h4>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          You're about to mark{' '}
          <span className="font-bold">"{bill.name}"</span> as paid. This will
          deduct{' '}
          <span className="font-mono font-bold text-[#1F3D2B]">
            {fmt(amount, currencySymbol)}
          </span>{' '}
          from your balance.
        </p>

        <div className="my-4 p-3.5 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>Current balance:</span>
            <span className="font-mono font-semibold">{fmt(balance, currencySymbol)}</span>
          </div>
          <div className="flex justify-between text-gray-500 font-semibold">
            <span>Bill amount:</span>
            <span className="font-mono">− {fmt(amount, currencySymbol)}</span>
          </div>
          <div className="h-px bg-gray-200 my-1" />
          <div className="flex justify-between text-gray-900 font-bold text-sm">
            <span>Balance after:</span>
            <span className={`font-mono ${insufficient ? 'text-red-600' : 'text-[#1F3D2B]'}`}>
              {fmt(balanceAfter, currencySymbol)}
            </span>
          </div>
        </div>

        <p className="text-xs text-red-500 bg-red-50 p-2.5 rounded-xl border border-red-100">
              Warning: This action will deduct funds directly from your main dashboard savings balance card.
        </p>

        {insufficient && (
          <p className="text-xs text-red-500 bg-red-50 p-2.5 rounded-xl border border-red-100 mb-4">
            Insufficient balance to cover this bill.
          </p>
        )}

        <div className="mt-5 flex gap-2.5 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={insufficient}
            className="px-5 py-2 bg-[#1F3D2B] text-[#C7E26E] rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Yes, Mark as Paid
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline Edit Form ────────────────────────────────────────────────────────
function EditForm({ bill, currencySymbol, onSave, onCancel, updateBill }) {
  const [name,     setName]     = useState(bill.name);
  const [amount,   setAmount]   = useState(String(bill.amount));
  const [dueDay,   setDueDay]   = useState(String(bill.due_day));
  const [category, setCategory] = useState(bill.category);
  const [note,     setNote]     = useState(bill.note || '');
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState('');

  async function handleSave() {
    setErr('');
    const n   = parseFloat(amount);
    const day = parseInt(dueDay);
    if (!name.trim())                  { setErr('Bill name is required.');          return; }
    if (!n || n <= 0)                  { setErr('Enter a valid amount.');            return; }
    if (!day || day < 1 || day > 31)   { setErr('Enter a valid due day (1–31).');   return; }

    setSaving(true);
    try {
      await updateBill(bill.id, {
        name:     name.trim(),
        amount:   n,
        due_day:  day,
        category,
        note:     note.trim() || null,
      });
      onSave();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      <p className="text-xs font-bold text-[#1F3D2B] uppercase tracking-widest">Edit bill</p>

      <label className="block">
        <span className="text-xs text-gray-500 font-semibold">Bill name</span>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setErr(''); }}
          className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
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
              value={amount}
              onChange={e => { setAmount(e.target.value); setErr(''); }}
              className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-xs text-gray-500 font-semibold">Due day</span>
          <input
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={e => { setDueDay(e.target.value); setErr(''); }}
            className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-gray-500 font-semibold">Category</span>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
        >
          {BILL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-gray-500 font-semibold">Note (optional)</span>
        <input
          type="text"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="e.g. Auto-debit on BDO"
          className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
        />
      </label>

      {err && (
        <p className="text-xs text-red-500 font-semibold flex items-center gap-1">
          <AlertCircle size={12} /> {err}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-xl text-sm font-bold bg-[#1F3D2B] text-[#C7E26E] disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Check size={14} /> {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Bill Card ───────────────────────────────────────────────────────────────
function BillCard({ bill, balance, currencySymbol, payBill, unpayBill, removeBill, updateBill }) {
  const [confirming,       setConfirming]       = useState(false);
  const [deleting,         setDeleting]         = useState(false);
  const [paying,           setPaying]           = useState(false);
  const [showPayConfirm,   setShowPayConfirm]   = useState(false);
  const [showUnpayConfirm, setShowUnpayConfirm] = useState(false);
  const [editing,          setEditing]          = useState(false);
  const [err,              setErr]              = useState('');

  async function handlePay() {
    setShowPayConfirm(false);
    setPaying(true);
    setErr('');
    try {
      await payBill(bill.id, Number(bill.amount));
    } catch (e) {
      setErr(e.message);
    } finally {
      setPaying(false);
    }
  }

  async function handleUnpay() {
    setShowUnpayConfirm(false);
    setPaying(true);
    setErr('');
    try {
      await unpayBill(bill.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setPaying(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try { await removeBill(bill.id); }
    catch { setDeleting(false); setConfirming(false); }
  }

  return (
    <div className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${
      bill.isPaid
        ? 'border-green-200 bg-green-50/30'
        : bill.isOverdue
          ? 'border-red-200'
          : bill.isUrgent
            ? 'border-yellow-200'
            : 'border-gray-100'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-serif text-lg leading-snug truncate ${bill.isPaid ? 'text-gray-400 line-through' : 'text-[#1F3D2B]'}`}>
            {bill.name}
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Tag size={10} /> {bill.category}
            </span>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <CalendarDays size={10} /> Due every {ordinal(bill.due_day)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatusPill bill={bill} />

          {/* Edit button — hidden when confirming delete or already editing */}
          {!confirming && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-gray-300 hover:text-[#4F7E5B] transition-colors p-1"
              aria-label="Edit bill"
            >
              <Pencil size={15} />
            </button>
          )}

          {/* Delete button */}
          {!confirming && !editing && (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="text-gray-300 hover:text-red-400 transition-colors p-1"
              aria-label="Delete bill"
            >
              <Trash2 size={15} />
            </button>
          )}

          {/* Close edit button */}
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-gray-300 hover:text-gray-500 transition-colors p-1"
              aria-label="Cancel edit"
            >
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Delete confirm */}
      {confirming && (
        <div className="mt-3 flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
          <p className="text-xs text-red-700 font-semibold flex-1">Delete "{bill.name}"? This can't be undone.</p>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs font-bold text-white bg-red-500 px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {deleting ? '…' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-xs font-bold text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Amount + note */}
      {!editing && (
        <div className="mt-3 flex items-baseline justify-between">
          <span className="font-mono font-bold text-[#1F3D2B] text-xl">
            {fmt(bill.amount, currencySymbol)}
          </span>
          {bill.note && (
            <span className="text-xs text-gray-400 italic truncate max-w-[55%]">{bill.note}</span>
          )}
        </div>
      )}

      {/* Inline edit form */}
      {editing && (
        <EditForm
          bill={bill}
          currencySymbol={currencySymbol}
          updateBill={updateBill}
          onSave={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Pay / Unpay — hidden while editing */}
      {!editing && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {bill.isPaid ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-green-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={14} />
                Paid on {new Date(bill.payment?.paid_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })}
              </p>
              <button
                type="button"
                onClick={() => setShowUnpayConfirm(true)}
                className="text-xs font-semibold text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                Undo
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (Number(bill.amount) > balance) return;
                setShowPayConfirm(true);
              }}
              disabled={paying || Number(bill.amount) > balance}
              className="w-full py-2.5 rounded-xl text-sm font-bold bg-[#1F3D2B] text-[#C7E26E] disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Banknote size={15} />
              {paying
                ? 'Processing…'
                : Number(bill.amount) > balance
                  ? 'Insufficient balance'
                  : `Mark as Paid — ${fmt(bill.amount, currencySymbol)}`}
            </button>
          )}

          {err && <p className="text-xs text-red-500 font-semibold mt-2">{err}</p>}
        </div>
      )}

      {/* Pay confirmation modal */}
      {showPayConfirm && (
        <PayConfirmModal
          bill={bill}
          balance={balance}
          currencySymbol={currencySymbol}
          onConfirm={handlePay}
          onCancel={() => setShowPayConfirm(false)}
        />
      )}

      {/* Undo pay modal */}
      {showUnpayConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-50 rounded-xl">
                <AlertTriangle size={22} className="text-yellow-500" />
              </div>
              <h4 className="font-serif font-bold text-gray-900">Undo Payment?</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              This will mark <span className="font-bold">"{bill.name}"</span> as unpaid for this month.
              Note: the balance deduction from the original payment will <span className="font-bold">NOT</span> be reversed automatically — delete the transaction manually if needed.
            </p>
            <div className="mt-5 flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowUnpayConfirm(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnpay}
                className="px-5 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600"
              >
                Yes, Undo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Bills Component ────────────────────────────────────────────────────
export default function Bills({
  balance = 0,
  billsWithStatus = [],
  currencySymbol = '₱',
  addBill,
  removeBill,
  updateBill,
  payBill,
  unpayBill,
  resetMonthlyBills,
}) {
  const [name,       setName]       = useState('');
  const [amount,     setAmount]     = useState('');
  const [dueDay,     setDueDay]     = useState('');
  const [category,   setCategory]   = useState(BILL_CATEGORIES[0]);
  const [note,       setNote]       = useState('');
  const [saving,     setSaving]     = useState(false);
  const [formErr,    setFormErr]    = useState('');
  const [filter,     setFilter]     = useState('all');
  const [showReset,  setShowReset]  = useState(false);
  const [resetting,  setResetting]  = useState(false);

  const filtered = billsWithStatus.filter(b => {
    if (filter === 'unpaid') return !b.isPaid;
    if (filter === 'paid')   return b.isPaid;
    return true;
  });

  const totalMonthly = billsWithStatus.reduce((s, b) => s + Number(b.amount), 0);
  const totalPaid    = billsWithStatus.filter(b => b.isPaid).reduce((s, b) => s + Number(b.amount), 0);
  const totalUnpaid  = totalMonthly - totalPaid;
  const paidCount    = billsWithStatus.filter(b => b.isPaid).length;
  const urgentCount  = billsWithStatus.filter(b => b.isUrgent || b.isOverdue).length;

  const now       = new Date();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  async function handleAddBill(e) {
    e.preventDefault();
    setFormErr('');
    const n   = parseFloat(amount);
    const day = parseInt(dueDay);
    if (!name.trim())                  { setFormErr('Give your bill a name.');            return; }
    if (!n || n <= 0)                  { setFormErr('Enter a valid amount.');              return; }
    if (!day || day < 1 || day > 31)   { setFormErr('Enter a valid due day (1–31).'); return; }

    setSaving(true);
    try {
      await addBill({
        name:     name.trim(),
        amount:   n,
        due_day:  day,
        category,
        note:     note.trim() || null,
      });
      setName(''); setAmount(''); setDueDay(''); setNote('');
      setCategory(BILL_CATEGORIES[0]);
    } catch (err) {
      setFormErr(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    try {
      await resetMonthlyBills();
      setShowReset(false);
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Summary cards ── */}
      {billsWithStatus.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total monthly', value: fmt(totalMonthly, currencySymbol) },
              { label: 'Paid',          value: fmt(totalPaid,    currencySymbol) },
              { label: 'Remaining',     value: fmt(totalUnpaid,  currencySymbol) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-gray-100 rounded-2xl p-4 text-center shadow-sm">
                <p className="font-mono font-bold text-[#1F3D2B] text-base leading-tight">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Month header + reset */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#1F3D2B]">{monthLabel}</p>
              <p className="text-xs text-gray-400">
                {paidCount} of {billsWithStatus.length} bills paid
                {urgentCount > 0 && (
                  <span className="ml-2 text-yellow-600 font-semibold">
                    · {urgentCount} need attention
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#1F3D2B] border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-xl transition-colors"
            >
              <RotateCcw size={12} /> Reset month
            </button>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2">
            {[
              { value: 'all',    label: `All (${billsWithStatus.length})` },
              { value: 'unpaid', label: `Unpaid (${billsWithStatus.length - paidCount})` },
              { value: 'paid',   label: `Paid (${paidCount})` },
            ].map(({ value, label }) => (
              <button
                key={value}
                type="button"
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

          {/* Bill cards */}
          <div className="space-y-4">
            {filtered.map(b => (
              <BillCard
                key={b.id}
                bill={b}
                balance={balance}
                currencySymbol={currencySymbol}
                payBill={payBill}
                unpayBill={unpayBill}
                removeBill={removeBill}
                updateBill={updateBill}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {billsWithStatus.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
            <Receipt size={26} className="text-green-400" />
          </div>
          <p className="font-serif text-lg text-[#1F3D2B]">No bills tracked yet</p>
          <p className="text-sm text-gray-400 mt-1 max-w-xs mx-auto">
            Add your monthly bills below and mark them paid when you've settled them.
          </p>
        </div>
      )}

      {/* ── Add bill form ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <h2 className="font-serif text-xl text-[#1F3D2B] mb-4 flex items-center gap-2">
          <Plus size={18} className="text-[#4F7E5B]" /> Add a bill
        </h2>
        <form onSubmit={handleAddBill} className="space-y-3">
          <label className="block">
            <span className="text-xs text-gray-500 font-semibold">Bill name</span>
            <input
              type="text"
              placeholder="e.g. Netflix, Meralco, Rent"
              value={name}
              onChange={e => { setName(e.target.value); setFormErr(''); }}
              required
              className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
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
                  onChange={e => { setAmount(e.target.value); setFormErr(''); }}
                  required
                  className="w-full border border-gray-300 rounded-xl pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs text-gray-500 font-semibold">Due day of month</span>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="e.g. 15"
                value={dueDay}
                onChange={e => { setDueDay(e.target.value); setFormErr(''); }}
                required
                className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-gray-500 font-semibold">Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
            >
              {BILL_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-gray-500 font-semibold">Note (optional)</span>
            <input
              type="text"
              placeholder="e.g. Auto-debit on BDO"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
            />
          </label>

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
            <Receipt size={15} />
            {saving ? 'Adding bill…' : '+ Add bill'}
          </button>
        </form>
      </div>

      {/* Reset month modal */}
      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-sm w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-yellow-50 rounded-xl">
                <RotateCcw size={22} className="text-yellow-500" />
              </div>
              <h4 className="font-serif font-bold text-gray-900">Reset {monthLabel}?</h4>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              This will mark all <span className="font-bold">{paidCount} paid bills</span> as unpaid for this month. Use this at the start of a new billing cycle. Balance deductions already made will not be reversed.
            </p>
            <div className="mt-5 flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowReset(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReset}
                disabled={resetting}
                className="px-5 py-2 bg-[#1F3D2B] text-[#C7E26E] rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
              >
                {resetting ? 'Resetting…' : 'Yes, Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}