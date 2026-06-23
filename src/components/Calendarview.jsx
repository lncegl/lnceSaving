// src/components/CalendarView.jsx
import { useState, useMemo } from 'react';

const TYPE_CONFIG = {
  deposit: {
    label: 'Deposit',
    dot: 'bg-[#C7E26E]',
    badge: 'bg-[#C7E26E]/20 text-[#1F3D2B]',
    icon: '↑',
    iconColor: 'text-[#3a7d44]',
  },
  withdrawal: {
    label: 'Withdrawal',
    dot: 'bg-orange-400',
    badge: 'bg-orange-50 text-orange-700',
    icon: '↓',
    iconColor: 'text-orange-500',
  },
  bill: {
    label: 'Bill',
    dot: 'bg-rose-400',
    badge: 'bg-rose-50 text-rose-700',
    icon: '⚡',
    iconColor: 'text-rose-500',
  },
};

function classifyTransaction(tx) {
  const note = (tx.note || tx.description || tx.category || '').toLowerCase();
  const type = (tx.type || '').toLowerCase();

  if (type === 'deposit' || type === 'income' || tx.amount > 0) return 'deposit';
  if (
    type === 'bill' ||
    note.includes('bill') ||
    note.includes('electric') ||
    note.includes('water') ||
    note.includes('internet') ||
    note.includes('rent') ||
    note.includes('utility') ||
    note.includes('subscription')
  )
    return 'bill';
  return 'withdrawal';
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function CalendarView({ transactions = [], currencySymbol = '₱' }) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  // Build a map: "YYYY-MM-DD" → array of classified transactions
  const txByDay = useMemo(() => {
    const map = {};
    transactions.forEach((tx) => {
      if (!tx.date) return;
      const d = new Date(tx.date);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push({ ...tx, _kind: classifyTransaction(tx) });
    });
    return map;
  }, [transactions]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  }

  // Monthly summary for this view month
  const monthlySummary = useMemo(() => {
    let deposits = 0, withdrawals = 0, bills = 0;
    Object.entries(txByDay).forEach(([key, txs]) => {
      const [y, m] = key.split('-').map(Number);
      if (y !== viewYear || m !== viewMonth + 1) return;
      txs.forEach((tx) => {
        const amt = Math.abs(tx.amount || 0);
        if (tx._kind === 'deposit') deposits += amt;
        else if (tx._kind === 'withdrawal') withdrawals += amt;
        else if (tx._kind === 'bill') bills += amt;
      });
    });
    return { deposits, withdrawals, bills };
  }, [txByDay, viewYear, viewMonth]);

  // Selected day transactions
  const selectedKey = selectedDay
    ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`
    : null;
  const selectedTxs = selectedKey ? txByDay[selectedKey] || [] : [];

  const isToday = (day) =>
    day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear();

  // Build grid cells (leading blanks + days)
  const cells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full 6-row grid so layout doesn't shift
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-4">
      {/* ── Monthly Summary Pills ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { kind: 'deposit',    label: 'Saved',     value: monthlySummary.deposits },
          { kind: 'withdrawal', label: 'Withdrawn',  value: monthlySummary.withdrawals },
          { kind: 'bill',       label: 'Bills Paid', value: monthlySummary.bills },
        ].map(({ kind, label, value }) => (
          <div key={kind} className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`inline-block w-2 h-2 rounded-full ${TYPE_CONFIG[kind].dot}`} />
              <span className="text-xs text-gray-400 font-medium">{label}</span>
            </div>
            <p className="text-base font-bold text-[#1F3D2B] tracking-tight">
              {currencySymbol}{value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      {/* ── Calendar Card ── */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <button
            type="button"
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Previous month"
          >
            ‹
          </button>
          <h3 className="text-sm font-semibold text-[#1F3D2B]">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
          <button
            type="button"
            onClick={nextMonth}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        {/* Day-of-week labels */}
        <div className="grid grid-cols-7 border-b border-gray-50">
          {DAY_LABELS.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold text-gray-400 tracking-wide uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={`blank-${idx}`} className="h-12 border-b border-r border-gray-50 last:border-r-0" />;

            const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayTxs = txByDay[key] || [];
            const kinds = [...new Set(dayTxs.map((t) => t._kind))];
            const isSelected = selectedDay === day;
            const _isToday = isToday(day);

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`relative h-12 flex flex-col items-center justify-start pt-1.5 border-b border-r border-gray-50 last:border-r-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C7E26E] ${
                  isSelected
                    ? 'bg-[#1F3D2B]'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span
                  className={`text-xs font-semibold leading-none ${
                    isSelected
                      ? 'text-[#C7E26E]'
                      : _isToday
                      ? 'text-[#1F3D2B] underline underline-offset-2'
                      : 'text-gray-700'
                  }`}
                >
                  {day}
                </span>

                {/* Activity dots */}
                {kinds.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {kinds.map((k) => (
                      <span
                        key={k}
                        className={`inline-block w-1.5 h-1.5 rounded-full ${TYPE_CONFIG[k].dot} ${isSelected ? 'opacity-90' : ''}`}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="flex gap-4 px-1">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-gray-400">{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* ── Day Detail Panel ── */}
      {selectedDay && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#1F3D2B]">
              {MONTH_NAMES[viewMonth]} {selectedDay}, {viewYear}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {selectedTxs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">
              No activity on this day.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {selectedTxs.map((tx, i) => {
                const cfg = TYPE_CONFIG[tx._kind];
                const amt = Math.abs(tx.amount || 0);
                const label = tx.note || tx.description || tx.category || cfg.label;
                return (
                  <li key={i} className="flex items-center gap-3 px-5 py-3">
                    {/* Icon bubble */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${cfg.badge}`}>
                      <span className={cfg.iconColor}>{cfg.icon}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
                      <p className="text-xs text-gray-400 capitalize">{cfg.label}</p>
                    </div>

                    <span className={`text-sm font-semibold ${
                      tx._kind === 'deposit' ? 'text-[#3a7d44]' : tx._kind === 'bill' ? 'text-rose-600' : 'text-orange-600'
                    }`}>
                      {tx._kind === 'deposit' ? '+' : '-'}{currencySymbol}
                      {amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Day total */}
          {selectedTxs.length > 0 && (() => {
            const net = selectedTxs.reduce((sum, tx) => {
              const amt = Math.abs(tx.amount || 0);
              return tx._kind === 'deposit' ? sum + amt : sum - amt;
            }, 0);
            return (
              <div className="px-5 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50/60">
                <span className="text-xs text-gray-400 font-medium">Day net</span>
                <span className={`text-sm font-bold ${net >= 0 ? 'text-[#3a7d44]' : 'text-rose-600'}`}>
                  {net >= 0 ? '+' : ''}{currencySymbol}
                  {Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}