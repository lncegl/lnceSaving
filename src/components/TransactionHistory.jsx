// src/components/TransactionHistory.jsx
import { useState, useMemo } from 'react';
import { ArrowUpCircle, ArrowDownCircle, Trash2, Search, Filter, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

function fmt(n, symbol = '₱') {
  return symbol + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDate(d) {
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

const TYPE_OPTS = [{ value: '', label: 'All types' }, { value: 'deposit', label: 'Deposits' }, { value: 'withdrawal', label: 'Withdrawals' }];
const SORT_OPTS = [{ value: 'date_desc', label: 'Date (newest)' }, { value: 'date_asc', label: 'Date (oldest)' }, { value: 'amount_desc', label: 'Amount (high→low)' }, { value: 'amount_asc', label: 'Amount (low→high)' }];

export default function TransactionHistory({ transactions, currencySymbol = '₱', removeTransaction }) {
  const [search,     setSearch]     = useState('');
  const [typeFilter, setType]       = useState('');
  const [sortBy,     setSortBy]     = useState('date_desc');
  const [deleting,   setDeleting]   = useState(null);
  const [deleteErr,  setDeleteErr]  = useState('');
  const [page,       setPage]       = useState(1);
  const [pageSize,   setPageSize]   = useState(10);
  const [jumpInput,  setJumpInput]  = useState('');

  const filtered = useMemo(() => {
    let rows = [...transactions];

    if (typeFilter) rows = rows.filter((t) => t.type === typeFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (t) =>
          t.category?.toLowerCase().includes(q) ||
          t.note?.toLowerCase().includes(q) ||
          t.date?.includes(q) ||
          t.goals?.name?.toLowerCase().includes(q)
      );
    }

    rows.sort((a, b) => {
      switch (sortBy) {
        case 'date_desc':   return b.date.localeCompare(a.date) || b.created_at?.localeCompare(a.created_at ?? '');
        case 'date_asc':    return a.date.localeCompare(b.date);
        case 'amount_desc': return Number(b.amount) - Number(a.amount);
        case 'amount_asc':  return Number(a.amount) - Number(b.amount);
        default:            return 0;
      }
    });

    return rows;
  }, [transactions, typeFilter, search, sortBy]);

  // Reset to page 1 whenever filters change
  useMemo(() => { setPage(1); }, [filtered.length, typeFilter, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pageStart  = (safePage - 1) * pageSize;
  const paginated  = filtered.slice(pageStart, pageStart + pageSize);

  function goTo(n) {
    const target = Math.max(1, Math.min(n, totalPages));
    setPage(target);
    setJumpInput('');
  }

  function handleJump(e) {
    e.preventDefault();
    const n = parseInt(jumpInput, 10);
    if (!isNaN(n)) goTo(n);
  }

  // Page number buttons — show at most 5 around current
  function pageButtons() {
    const delta = 2;
    const range = [];
    const left  = Math.max(2, safePage - delta);
    const right = Math.min(totalPages - 1, safePage + delta);

    range.push(1);
    if (left > 2) range.push('...');
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push('...');
    if (totalPages > 1) range.push(totalPages);

    return range;
  }

  async function handleDelete(id) {
    setDeleting(id);
    setDeleteErr('');
    try {
      await removeTransaction(id);
    } catch (err) {
      setDeleteErr(err.message);
    } finally {
      setDeleting(null);
    }
  }

  const filteredDeposits    = filtered.filter((t) => t.type === 'deposit').reduce((s, t) => s + Number(t.amount), 0);
  const filteredWithdrawals = filtered.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-4">

      {/* ── Header + filters ── */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="font-serif text-xl text-[#1F3D2B]">Transaction history</h2>

        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Search by category, note, date…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
            />
          </div>

          {/* Type filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <select
              value={typeFilter} onChange={(e) => setType(e.target.value)}
              className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E] bg-white appearance-none"
            >
              {TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy} onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E] bg-white"
          >
            {SORT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Filtered summary */}
        {filtered.length > 0 && (
          <div className="flex gap-4 text-xs font-semibold text-gray-500">
            <span>{filtered.length} transactions</span>
            <span className="text-green-700">+{fmt(filteredDeposits, currencySymbol)}</span>
            <span className="text-yellow-700">−{fmt(filteredWithdrawals, currencySymbol)}</span>
          </div>
        )}
      </div>

      {deleteErr && (
        <p className="text-sm text-red-500 font-semibold px-1">{deleteErr}</p>
      )}

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-10 text-center text-gray-400 shadow-sm">
          <ArrowRightLeft size={28} className="mx-auto mb-2 text-green-300" />
          <p className="font-semibold">No transactions match your filter.</p>
          <p className="text-sm mt-1">Try adjusting the search or type filter.</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <ul className="divide-y divide-gray-50">
              {paginated.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${t.type === 'deposit' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                    {t.type === 'deposit'
                      ? <ArrowUpCircle size={18} className="text-green-700" />
                      : <ArrowDownCircle size={18} className="text-yellow-700" />
                    }
                  </div>

                  {/* Main text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {t.category}
                      {t.goals?.name && (
                        <span className="ml-1.5 text-xs text-green-700 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded-full font-medium">
                          {t.goals.name}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {formatDate(t.date)}{t.note ? ` — ${t.note}` : ''}
                    </p>
                  </div>

                  {/* Amount */}
                  <p className={`font-mono font-bold text-sm shrink-0 ${t.type === 'deposit' ? 'text-green-700' : 'text-yellow-700'}`}>
                    {t.type === 'deposit' ? '+' : '−'}{fmt(t.amount, currencySymbol)}
                  </p>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deleting === t.id}
                    aria-label="Delete transaction"
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-all disabled:opacity-30 shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Pagination bar ── */}
          {totalPages > 1 && (
            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">

              {/* Left: page info */}
              <p className="text-xs text-gray-400 font-semibold shrink-0">
                Page <span className="text-gray-700">{safePage}</span> of <span className="text-gray-700">{totalPages}</span>
                <span className="ml-2 text-gray-300">·</span>
                <span className="ml-2">rows {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)}</span>
              </p>

              {/* Centre: page buttons */}
              <div className="flex items-center gap-1">
                {/* First */}
                <button
                  onClick={() => goTo(1)} disabled={safePage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronsLeft size={15} />
                </button>
                {/* Prev */}
                <button
                  onClick={() => goTo(safePage - 1)} disabled={safePage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>

                {/* Numbered buttons */}
                {pageButtons().map((p, i) =>
                  p === '...'
                    ? <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-gray-300 select-none">…</span>
                    : (
                      <button
                        key={p}
                        onClick={() => goTo(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors
                          ${p === safePage
                            ? 'bg-[#1F3D2B] text-[#C7E26E]'
                            : 'text-gray-500 hover:bg-gray-100'
                          }`}
                      >
                        {p}
                      </button>
                    )
                )}

                {/* Next */}
                <button
                  onClick={() => goTo(safePage + 1)} disabled={safePage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
                {/* Last */}
                <button
                  onClick={() => goTo(totalPages)} disabled={safePage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                >
                  <ChevronsRight size={15} />
                </button>
              </div>

              {/* Right: jump to page */}
              <form onSubmit={handleJump} className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-gray-400 font-semibold">Go to</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  placeholder="—"
                  className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
                />
                <button
                  type="submit"
                  className="text-xs font-bold bg-[#F0F7EC] text-[#1F3D2B] border border-[#C7E26E]/60 px-3 py-1 rounded-lg hover:bg-[#E3F2D7] transition-colors"
                >
                  Go
                </button>
              </form>

            </div>
          )}
        </>
      )}
    </div>
  );
}

function ArrowRightLeft(props) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7H3M21 7l-4-4M21 7l-4 4M3 17h18M3 17l4-4M3 17l4 4" />
    </svg>
  );
}
