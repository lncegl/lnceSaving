// src/components/Insights.jsx
// ─────────────────────────────────────────────────────────────
// Props (from App.jsx):
//   balanceSeries     – Array<{ date, balance }>
//   monthlyData       – Array<{ month, deposits, withdrawals }>
//   categoryBreakdown – Array<{ name, value }>
//   currencySymbol    – string
//   monthNet          – number  (positive = saved, negative = spent)
//   totalDeposited    – number
//   totalWithdrawn    – number
// ─────────────────────────────────────────────────────────────

import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, BarChart3, PieChart as PieIcon,
} from 'lucide-react';

// ── Palette ───────────────────────────────────────────────────
const PIE_COLORS = [
  '#1F3D2B', '#4F7E5B', '#8FBF6F', '#C7E26E',
  '#F2C063', '#E0A458', '#B5C99A', '#2D5640',
];

// ── Formatting ────────────────────────────────────────────────
function fmt(n, symbol = '₱') {
  return (
    symbol +
    Number(n).toLocaleString('en-PH', {
      minimumFractionDigits:  2,
      maximumFractionDigits:  2,
    })
  );
}

function fmtShort(n, symbol = '₱') {
  const abs = Math.abs(Number(n));
  if (abs >= 1_000_000) return symbol + (abs / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000)     return symbol + (abs / 1_000).toFixed(1)     + 'K';
  return symbol + abs.toFixed(0);
}

function labelMonth(m) {
  // m = 'YYYY-MM'
  try {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  } catch { return m; }
}

function labelDate(d) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return d; }
}

// ── Custom tooltip ────────────────────────────────────────────
function ChartTooltip({ active, payload, label, symbol, labelFn }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-gray-500 mb-1">{labelFn ? labelFn(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-mono font-bold">
          {p.name}: {fmt(p.value, symbol)}
        </p>
      ))}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ title, icon: Icon, children, isEmpty, emptyMsg }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <h2 className="font-serif text-lg text-[#1F3D2B] mb-5 flex items-center gap-2">
        <Icon size={18} className="text-[#4F7E5B]" /> {title}
      </h2>
      {isEmpty ? (
        <div className="flex flex-col items-center py-10 text-gray-300 text-sm gap-2">
          <Icon size={28} />
          <p>{emptyMsg}</p>
        </div>
      ) : children}
    </div>
  );
}

// ── Custom pie label ──────────────────────────────────────────
function PieLabel({ cx, cy, midAngle, outerRadius, name, percent }) {
  if (percent < 0.04) return null; // skip tiny slices
  const RADIAN = Math.PI / 180;
  const r  = outerRadius + 20;
  const x  = cx + r * Math.cos(-midAngle * RADIAN);
  const y  = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x} y={y}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      className="text-xs fill-gray-600 font-medium"
      style={{ fontSize: 11 }}
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

// ── Main ─────────────────────────────────────────────────────
export default function Insights({
  balanceSeries    = [],
  monthlyData      = [],
  categoryBreakdown = [],
  currencySymbol   = '₱',
  monthNet         = 0,
  totalDeposited   = 0,
  totalWithdrawn   = 0,
}) {
  const netUp        = monthNet >= 0;
  const savingsRate  = totalDeposited > 0
    ? ((totalDeposited - totalWithdrawn) / totalDeposited * 100).toFixed(1)
    : '0.0';

  const topCategory  = [...categoryBreakdown]
    .sort((a, b) => b.value - a.value)[0];

  const bestMonth    = [...monthlyData]
    .sort((a, b) => (b.deposits - b.withdrawals) - (a.deposits - a.withdrawals))[0];

  return (
    <div className="space-y-6">

      {/* ── Snapshot cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: 'This month',
            value: (netUp ? '+' : '−') + fmtShort(Math.abs(monthNet), currencySymbol),
            sub:   netUp ? 'net saved' : 'net spent',
            color: netUp ? 'text-green-700' : 'text-yellow-700',
            bg:    netUp ? 'bg-green-50'    : 'bg-yellow-50',
          },
          {
            label: 'Savings rate',
            value: savingsRate + '%',
            sub:   'of all deposits kept',
            color: 'text-[#1F3D2B]',
            bg:    'bg-[#F0F7EC]',
          },
          {
            label: 'Top spend',
            value: topCategory?.name ?? '—',
            sub:   topCategory ? fmt(topCategory.value, currencySymbol) : 'no withdrawals yet',
            color: 'text-gray-700',
            bg:    'bg-gray-50',
          },
          {
            label: 'Best month',
            value: bestMonth ? labelMonth(bestMonth.month) : '—',
            sub:   bestMonth
              ? '+' + fmtShort(bestMonth.deposits - bestMonth.withdrawals, currencySymbol) + ' net'
              : 'no data yet',
            color: 'text-[#1F3D2B]',
            bg:    'bg-[#F0F7EC]',
          },
        ].map(({ label, value, sub, color, bg }) => (
          <div key={label} className={`${bg} rounded-2xl p-4 border border-gray-100`}>
            <p className="text-xs text-gray-400 font-semibold mb-1">{label}</p>
            <p className={`font-mono font-bold text-base leading-tight ${color}`}>{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Balance over time ── */}
      <Section
        title="Balance over time"
        icon={TrendingUp}
        isEmpty={balanceSeries.length < 2}
        emptyMsg="Log at least two transactions to see your growth curve."
      >
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={balanceSeries} margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%"   stopColor="#2D5640" />
                <stop offset="100%" stopColor="#C7E26E" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E7EEDD" strokeDasharray="4 4" />
            <XAxis
              dataKey="date"
              tickFormatter={labelDate}
              tick={{ fontSize: 11, fill: '#8A9E85' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#8A9E85' }}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(v) => fmtShort(v, currencySymbol)}
            />
            <Tooltip
              content={<ChartTooltip symbol={currencySymbol} labelFn={labelDate} />}
            />
            <Line
              type="monotone"
              dataKey="balance"
              name="Balance"
              stroke="url(#lineGrad)"
              strokeWidth={2.5}
              dot={balanceSeries.length <= 30 ? { r: 3, fill: '#4F7E5B', strokeWidth: 0 } : false}
              activeDot={{ r: 5, fill: '#1F3D2B' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </Section>

      {/* ── Monthly deposits vs withdrawals ── */}
      <Section
        title="Monthly deposits vs. withdrawals"
        icon={BarChart3}
        isEmpty={monthlyData.length === 0}
        emptyMsg="Log transactions across multiple dates to see your monthly pattern."
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={monthlyData} margin={{ top: 4, right: 12, bottom: 0, left: 8 }} barCategoryGap="30%">
            <CartesianGrid stroke="#E7EEDD" strokeDasharray="4 4" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={labelMonth}
              tick={{ fontSize: 11, fill: '#8A9E85' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#8A9E85' }}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(v) => fmtShort(v, currencySymbol)}
            />
            <Tooltip content={<ChartTooltip symbol={currencySymbol} labelFn={labelMonth} />} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              formatter={(value) => (
                <span className="capitalize text-gray-500 font-semibold">{value}</span>
              )}
            />
            <Bar dataKey="deposits"    name="Deposits"    fill="#4F7E5B" radius={[5, 5, 0, 0]} />
            <Bar dataKey="withdrawals" name="Withdrawals" fill="#F2C063" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {/* Net-per-month table */}
        {monthlyData.length > 0 && (
          <div className="mt-4 border-t border-gray-50 pt-4">
            <p className="text-xs font-semibold text-gray-400 mb-2">Monthly net change</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {[...monthlyData]
                .sort((a, b) => b.month.localeCompare(a.month))
                .map((m) => {
                  const net   = m.deposits - m.withdrawals;
                  const up    = net >= 0;
                  return (
                    <div key={m.month} className="flex items-center gap-3 text-xs">
                      <span className="text-gray-500 w-16 shrink-0">{labelMonth(m.month)}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${up ? 'bg-green-400' : 'bg-yellow-400'}`}
                          style={{
                            width: Math.min(100, Math.abs(net) / Math.max(...monthlyData.map((x) => Math.max(x.deposits, x.withdrawals, 1))) * 100) + '%',
                          }}
                        />
                      </div>
                      <span className={`font-mono font-bold w-20 text-right ${up ? 'text-green-700' : 'text-yellow-700'}`}>
                        {up ? '+' : '−'}{fmtShort(Math.abs(net), currencySymbol)}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </Section>

      {/* ── Category breakdown ── */}
      <Section
        title="Spending by category"
        icon={PieIcon}
        isEmpty={categoryBreakdown.length === 0}
        emptyMsg="Log some withdrawals to see where your money is going."
      >
        <div className="flex flex-col sm:flex-row gap-6 items-center">
          <ResponsiveContainer width={220} height={220} className="shrink-0">
            <PieChart>
              <Pie
                data={categoryBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={86}
                paddingAngle={2}
                labelLine={false}
              >
                {categoryBreakdown.map((entry, i) => (
                  <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v, name) => [fmt(v, currencySymbol), name]}
                contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Legend table */}
          <div className="flex-1 space-y-2 w-full">
            {[...categoryBreakdown]
              .sort((a, b) => b.value - a.value)
              .map((entry, i) => {
                const total = categoryBreakdown.reduce((s, c) => s + c.value, 0);
                const pct   = total > 0 ? (entry.value / total * 100).toFixed(1) : 0;
                return (
                  <div key={entry.name} className="flex items-center gap-2.5">
                    <div
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-xs text-gray-600 flex-1 truncate font-medium">{entry.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{pct}%</span>
                    <span className="text-xs font-mono font-bold text-gray-700 w-20 text-right">
                      {fmt(entry.value, currencySymbol)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </Section>

    </div>
  );
}