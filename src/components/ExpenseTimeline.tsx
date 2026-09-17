import React from 'react';
import { Expense, Settlement, TripMember, CATEGORY_EMOJIS, Currency } from '../types';
import { formatMoney } from '../utils/math';
import { getExpenseDebtorBreakdown } from '../utils/debtSimplifier';
import { Trash2, Edit3, ArrowLeftRight, Zap, CheckCircle2 } from 'lucide-react';

interface ExpenseTimelineProps {
  expenses: Expense[];
  settlements?: Settlement[];
  members: TripMember[];
  settlementCurrency: Currency;
  currentMemberId?: string;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
  onDeleteSettlement?: (settlementId: string) => void;
  onQuickSettleExpense?: (expense: Expense, payerId: string, myShare: number) => void;
}

type TimelineItem =
  | { type: 'expense'; id: string; date: string; time: string; expense: Expense }
  | { type: 'settlement'; id: string; date: string; time: string; settlement: Settlement };

export const ExpenseTimeline: React.FC<ExpenseTimelineProps> = ({
  expenses,
  settlements = [],
  members,
  settlementCurrency,
  currentMemberId,
  onEditExpense,
  onDeleteExpense,
  onDeleteSettlement,
  onQuickSettleExpense,
}) => {
  const memberMap = new Map(members.map(m => [m.id, m]));
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];

  // Combine expenses and settlements into unified timeline items
  const items: TimelineItem[] = [
    ...expenses.map(exp => ({
      type: 'expense' as const,
      id: exp.id,
      date: exp.date || (exp.createdAt ? exp.createdAt.split('T')[0] : todayStr),
      time: exp.createdAt || exp.date,
      expense: exp,
    })),
    ...settlements.map(s => {
      const date = s.settledAt ? s.settledAt.split('T')[0] : todayStr;
      return {
        type: 'settlement' as const,
        id: s.id,
        date,
        time: s.settledAt || date,
        settlement: s,
      };
    }),
  ];

  if (items.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="text-4xl">✈️</div>
        <p className="text-sm text-neutral-500 font-medium">还没有任何记账记录</p>
        <p className="text-xs text-neutral-400">
          点击底部输入框，直接说一句“晚饭 480，我付，大家 AA”，体验 AI 秒级记账！
        </p>
      </div>
    );
  }

  // Group items by date
  const grouped = items.reduce((acc, item) => {
    const d = item.date;
    if (!acc[d]) acc[d] = [];
    acc[d].push(item);
    return acc;
  }, {} as Record<string, TimelineItem[]>);

  // Sort dates descending
  const sortedDates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

  const formatDateLabel = (dateStr: string) => {
    if (dateStr === todayStr) return '今天';
    if (dateStr === yesterdayStr) return '昨天';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
    }
    return dateStr;
  };

  return (
    <div className="space-y-6 pb-28">
      {sortedDates.map(date => {
        const dayItems = grouped[date];
        // Sort items within day: newest timestamp first
        dayItems.sort((a, b) => (a.time < b.time ? 1 : -1));

        // Calculate day total: expenses only (settlements are debt repayments, not consumption)
        const dayExpenseTotal = dayItems.reduce((sum, it) => {
          if (it.type === 'expense') {
            return sum + (it.expense.settlementAmount || it.expense.amount);
          }
          return sum;
        }, 0);

        const settlementCount = dayItems.filter(it => it.type === 'settlement').length;

        return (
          <div key={date} className="space-y-2.5">
            {/* Date section header */}
            <div className="flex items-center justify-between px-1 text-xs font-semibold text-neutral-500 tracking-wide">
              <div className="flex items-center gap-1.5">
                <span>{formatDateLabel(date)}</span>
                {settlementCount > 0 && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-normal border border-emerald-200/60">
                    含 {settlementCount} 笔还款转账
                  </span>
                )}
              </div>
              <span>{formatMoney(dayExpenseTotal, settlementCurrency)}</span>
            </div>

            {/* Timeline Items List */}
            <div className="space-y-2">
              {dayItems.map(item => {
                // ================= Settlement Transfer Card =================
                if (item.type === 'settlement') {
                  const s = item.settlement;
                  const fromM = memberMap.get(s.fromMemberId);
                  const toM = memberMap.get(s.toMemberId);
                  const fromName = fromM ? (fromM.id === currentMemberId ? '我' : fromM.name) : '成员';
                  const toName = toM ? (toM.id === currentMemberId ? '我' : toM.name) : '成员';

                  return (
                    <div
                      key={s.id}
                      className="bg-gradient-to-r from-emerald-50/50 via-white to-white rounded-2xl p-3.5 border border-emerald-200/80 shadow-soft hover:border-emerald-300 transition-all flex items-center justify-between gap-3 group"
                    >
                      {/* Left: Icon & Transfer info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
                          <ArrowLeftRight className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-sm text-neutral-900">
                              {fromName}
                            </span>
                            <span className="text-xs text-neutral-400">转账给</span>
                            <span className="font-bold text-sm text-neutral-900">
                              {toName}
                            </span>
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-1.5 py-0.5 rounded ml-1">
                              已还清
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5 flex-wrap">
                            <span className="truncate max-w-[180px] sm:max-w-none text-[11px] text-neutral-600">
                              {s.note || '转账还钱'}
                            </span>
                            <span className="text-neutral-300">·</span>
                            <span className="text-[11px] text-emerald-600 font-medium">
                              私下转账 · 不算旅游花费
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Delete button */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="font-bold text-sm sm:text-base text-emerald-600 tracking-tight">
                            + {formatMoney(s.amount, s.currency)}
                          </div>
                          <div className="text-[10px] text-emerald-600/80 font-medium">
                            已记账
                          </div>
                        </div>

                        {onDeleteSettlement && (
                          <div className="flex items-center opacity-70 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                if (window.confirm(`确定撤销「${fromName} 直还给 ${toName} ¥${s.amount}」吗？撤销后欠款将恢复。`)) {
                                  onDeleteSettlement(s.id);
                                }
                              }}
                              title="撤销这笔转账"
                              className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // ================= Expense Card =================
                const exp = item.expense;
                const emoji = CATEGORY_EMOJIS[exp.category] || '📦';
                const isForeign = exp.currency !== settlementCurrency;

                // Payers summary
                let payerText = '';
                let solePayerId: string | null = null;
                let solePayerName = '';

                if (exp.payers.length === 1) {
                  const p = memberMap.get(exp.payers[0].memberId);
                  solePayerId = exp.payers[0].memberId;
                  solePayerName = p ? (p.id === currentMemberId ? '我' : p.name) : '某人';
                  payerText = `${solePayerName}付款`;
                } else if (exp.payers.length > 1) {
                  payerText = `${exp.payers.length}人共同付款`;
                }

                // Participants summary
                let participantText = '';
                if (exp.participants.length === members.length) {
                  participantText = `${members.length} 人 AA`;
                } else {
                  const names = exp.participants
                    .map(pt => {
                      const m = memberMap.get(pt.memberId);
                      return m ? (m.id === currentMemberId ? '我' : m.name) : '';
                    })
                    .filter(Boolean);
                  participantText = names.join('、');
                }

                // Compute per-bill debtor breakdown
                const breakdown = getExpenseDebtorBreakdown(exp, settlements, members, currentMemberId);
                const myDebtor = breakdown.debtors.find(d => d.isCurrentUser);
                const canQuickSettle = breakdown.canQuickSettle && !!onQuickSettleExpense;

                return (
                  <div
                    key={exp.id}
                    className="bg-white rounded-2xl p-3.5 border border-neutral-200/70 shadow-soft hover:border-neutral-300 transition-all flex flex-col gap-2.5 group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Icon & Details */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-neutral-100 flex items-center justify-center text-xl flex-shrink-0">
                          {emoji}
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-neutral-900 truncate">
                            {exp.title}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5 flex-wrap">
                            <span className="bg-neutral-100 text-neutral-700 px-1.5 py-0.5 rounded font-medium text-[11px]">
                              {payerText}
                            </span>
                            <span className="text-neutral-400">·</span>
                            <span className="truncate max-w-[140px] sm:max-w-none text-[11px]">
                              {participantText}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Actions */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <div className="text-right">
                          <div className="font-bold text-sm sm:text-base text-neutral-900 tracking-tight">
                            {formatMoney(exp.amount, exp.currency)}
                          </div>
                          {isForeign && (
                            <div className="text-[11px] text-neutral-400">
                              ≈ {formatMoney(exp.settlementAmount, settlementCurrency)}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => onEditExpense(exp)}
                            title="修改账单"
                            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`确定删除这笔「${exp.title}」账单吗？`)) {
                                onDeleteExpense(exp.id);
                              }
                            }}
                            title="删除账单"
                            className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Quick Action: 1-Click Settle This Bill */}
                    {canQuickSettle && (
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100/90 text-xs">
                        <span className="text-neutral-500 text-[11px]">
                          {myDebtor && !myDebtor.isSettled ? (
                            <>
                              这单我该出：<strong className="text-neutral-800">{formatMoney(myDebtor.remainingOwed, exp.currency)}</strong>
                            </>
                          ) : (
                            <>
                              本单待结清：<strong className="text-amber-700 font-semibold">{breakdown.unsettledCount} 人</strong>
                            </>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const defaultAmount = myDebtor && !myDebtor.isSettled
                              ? myDebtor.remainingOwed
                              : (breakdown.debtors.find(d => !d.isSettled)?.remainingOwed || 0);
                            onQuickSettleExpense(exp, breakdown.payerId || solePayerId || '', defaultAmount);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold border border-emerald-200/80 transition-all active:scale-95 shadow-2xs"
                          title={
                            myDebtor && !myDebtor.isSettled
                              ? `结清这笔账单，转给 ${breakdown.payerName} ¥${myDebtor.remainingOwed}`
                              : `结清这笔账单款项 (${breakdown.unsettledCount}人待还)`
                          }
                        >
                          <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                          <span>
                            {myDebtor && !myDebtor.isSettled
                              ? `结清此单: 转给 ${breakdown.payerName} ${formatMoney(myDebtor.remainingOwed, exp.currency)}`
                              : `结清此单 (${breakdown.unsettledCount}人待结清)`}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
