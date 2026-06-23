// src/components/Activity.jsx
import { useState } from 'react';
import TransactionHistory from './TransactionHistory';
import Insights from './Insights';
import CalendarView from './CalendarView';

export default function Activity({
  transactions, goals, totalDeposited, totalWithdrawn,
  monthNet, balanceSeries, currencySymbol, removeTransaction,
}) {
  const [tab, setTab] = useState('transactions');

  return (
    <div className="space-y-5">
      {/* Sub-tab switcher */}
      <div className="flex gap-2">
        {[
          { value: 'transactions', label: 'Transactions' },
          { value: 'calendar',     label: 'Calendar'     },
          { value: 'insights',     label: 'Insights'     },
        ].map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all border ${
              tab === value
                ? 'bg-[#1F3D2B] text-[#C7E26E] border-[#1F3D2B]'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <TransactionHistory
          transactions={transactions}
          removeTransaction={removeTransaction}
          currencySymbol={currencySymbol}
        />
      )}

      {tab === 'calendar' && (
        <CalendarView
          transactions={transactions}
          currencySymbol={currencySymbol}
        />
      )}

      {tab === 'insights' && (
        <Insights
          transactions={transactions}
          goals={goals}
          totalDeposited={totalDeposited}
          totalWithdrawn={totalWithdrawn}
          monthNet={monthNet}
          balanceSeries={balanceSeries}
          currencySymbol={currencySymbol}
        />
      )}
    </div>
  );
}