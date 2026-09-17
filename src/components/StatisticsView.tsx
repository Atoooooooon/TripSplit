import React from 'react';
import { Trip, Expense, MemberBalance, CATEGORY_EMOJIS, Category } from '../types';
import { formatMoney } from '../utils/math';

interface StatisticsViewProps {
  trip: Trip;
  expenses: Expense[];
  balances: MemberBalance[];
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  trip,
  expenses,
  balances,
}) => {
  const currency = trip.settlementCurrency;
  const totalExpense = expenses.reduce((sum, e) => sum + (e.settlementAmount || e.amount), 0);

  // 1. Category Breakdown
  const categoryMap: Partial<Record<Category, number>> = {};
  expenses.forEach(e => {
    const amt = e.settlementAmount || e.amount;
    categoryMap[e.category] = (categoryMap[e.category] || 0) + amt;
  });

  const categoryList = Object.entries(categoryMap)
    .map(([cat, amt]) => ({
      category: cat as Category,
      amount: amt,
      percent: totalExpense > 0 ? (amt / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 2. Daily Timeline
  const dailyMap: Record<string, number> = {};
  expenses.forEach(e => {
    const amt = e.settlementAmount || e.amount;
    dailyMap[e.date] = (dailyMap[e.date] || 0) + amt;
  });

  const dailyList = Object.entries(dailyMap)
    .map(([date, amt]) => ({ date, amount: amt }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="space-y-6 pb-28">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-soft">
          <span className="text-xs font-medium text-neutral-500">旅行总消费</span>
          <div className="mt-1">
            <span className="text-xl font-extrabold text-neutral-900 tracking-tight">
              {formatMoney(totalExpense, currency)}
            </span>
            <span className="text-xs text-neutral-400 ml-1">{currency}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-soft">
          <span className="text-xs font-medium text-neutral-500">人均消费</span>
          <div className="mt-1">
            <span className="text-xl font-extrabold text-neutral-900 tracking-tight">
              {formatMoney(trip.members.length > 0 ? totalExpense / trip.members.length : 0, currency)}
            </span>
            <span className="text-xs text-neutral-400 ml-1">{currency}</span>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-soft space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
            消费分类占比
          </h2>
          <span className="text-xs text-neutral-400">共 {categoryList.length} 个分类</span>
        </div>

        {categoryList.length === 0 ? (
          <p className="text-xs text-neutral-400 py-4 text-center">暂无分类统计</p>
        ) : (
          <div className="space-y-3">
            {categoryList.map(cat => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-neutral-800">
                    <span>{CATEGORY_EMOJIS[cat.category] || '📦'}</span>
                    <span>{cat.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400 text-[11px]">
                      {cat.percent.toFixed(1)}%
                    </span>
                    <span className="font-bold text-neutral-900">
                      {formatMoney(cat.amount, currency)}
                    </span>
                  </div>
                </div>

                <div className="h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(cat.percent, 100)}%` }}
                    className="h-full bg-neutral-900 rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member Comparison: Paid vs Consumed */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-soft space-y-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
            成员支出与承担对比
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            对比每位成员的实际付款与应该分摊的金额
          </p>
        </div>

        <div className="space-y-3.5">
          {balances.map(b => (
            <div key={b.memberId} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    style={{ backgroundColor: b.avatarColor }}
                    className="w-4 h-4 rounded-full text-[10px] text-white flex items-center justify-center font-bold"
                  >
                    {b.memberName.slice(0, 1)}
                  </div>
                  <span className="font-semibold text-neutral-900">
                    {b.memberName}{b.isCurrentUser ? '（我）' : ''}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 space-x-2">
                  <span>付款: <strong className="text-neutral-900">{formatMoney(b.totalPaid, currency)}</strong></span>
                  <span>·</span>
                  <span>承担: <strong className="text-neutral-900">{formatMoney(b.totalShare, currency)}</strong></span>
                </div>
              </div>

              {/* Dual mini-progress bar */}
              <div className="grid grid-cols-2 gap-1 h-2">
                <div className="h-full bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${totalExpense > 0 ? (b.totalPaid / totalExpense) * 100 : 0}%` }}
                    className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  />
                </div>
                <div className="h-full bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${totalExpense > 0 ? (b.totalShare / totalExpense) * 100 : 0}%` }}
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-4 text-[11px] text-neutral-500 pt-1">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>实际付款</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>应承担金额</span>
          </div>
        </div>
      </div>

      {/* Daily Timeline Expense */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-soft space-y-3">
        <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
          每日消费走势
        </h2>

        {dailyList.length === 0 ? (
          <p className="text-xs text-neutral-400 py-3 text-center">暂无每日记录</p>
        ) : (
          <div className="space-y-2">
            {dailyList.map(item => (
              <div key={item.date} className="flex items-center justify-between text-xs py-1 border-b border-neutral-100 last:border-none">
                <span className="text-neutral-600 font-medium">{item.date}</span>
                <span className="font-bold text-neutral-900">
                  {formatMoney(item.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
