import React, { useState, useMemo } from 'react';
import { Expense, TripMember, Settlement, Currency } from '../types';
import { formatMoney } from '../utils/math';
import { getExpenseDebtorBreakdown } from '../utils/debtSimplifier';
import { Check, X, ArrowRight, Zap, Info, Users } from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuickSettleModalProps {
  expense: Expense;
  payer: TripMember;
  members: TripMember[];
  currentMember?: TripMember | null;
  settlements?: Settlement[];
  amount?: number;
  settlementCurrency: Currency;
  onConfirm: (data: {
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    currency: Currency;
    note: string;
    expenseId?: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const QuickSettleModal: React.FC<QuickSettleModalProps> = ({
  expense,
  payer,
  members,
  currentMember,
  settlements = [],
  amount,
  settlementCurrency,
  onConfirm,
  onClose,
}) => {
  const currency: Currency = expense.currency || settlementCurrency;

  // Calculate per-debtor breakdown for this specific bill
  const breakdown = useMemo(() => {
    return getExpenseDebtorBreakdown(expense, settlements, members, currentMember?.id);
  }, [expense, settlements, members, currentMember]);

  // Fallback if no specific debtors found
  const displayDebtors = useMemo(() => {
    if (breakdown.debtors.length > 0) {
      return breakdown.debtors;
    }
    // Fallback: list all participants other than payer
    return members
      .filter(m => m.id !== (breakdown.payerId || payer.id))
      .map(m => ({
        memberId: m.id,
        memberName: m.name,
        avatarColor: m.avatarColor,
        isCurrentUser: m.id === currentMember?.id,
        initialOwed: expense.amount,
        settledAmount: 0,
        remainingOwed: expense.amount,
        isSettled: false,
      }));
  }, [breakdown, members, payer, expense.amount, currentMember]);

  // Determine initial selected debtor:
  // Default to current user if present, otherwise first unsettled debtor, or first debtor
  const initialDebtorId = useMemo(() => {
    if (currentMember && displayDebtors.some(d => d.memberId === currentMember.id)) {
      return currentMember.id;
    }
    const firstUnsettled = displayDebtors.find(d => !d.isSettled);
    return firstUnsettled ? firstUnsettled.memberId : (displayDebtors[0]?.memberId || '');
  }, [currentMember, displayDebtors]);

  const [selectedDebtorId, setSelectedDebtorId] = useState<string>(initialDebtorId);

  const selectedDebtor = useMemo(() => {
    return displayDebtors.find(d => d.memberId === selectedDebtorId) || displayDebtors[0];
  }, [displayDebtors, selectedDebtorId]);

  const [settleAmount, setSettleAmount] = useState<number>(() => {
    if (selectedDebtor) {
      return selectedDebtor.remainingOwed > 0 ? selectedDebtor.remainingOwed : selectedDebtor.initialOwed;
    }
    return amount || 0;
  });

  const [note, setNote] = useState<string>(() => {
    return `结清此单: ${expense.title}${selectedDebtor ? ` (${selectedDebtor.memberName})` : ''}`;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Switch debtor selection
  const handleSelectDebtor = (debtorId: string) => {
    setSelectedDebtorId(debtorId);
    const target = displayDebtors.find(d => d.memberId === debtorId);
    if (target) {
      const targetAmount = target.remainingOwed > 0 ? target.remainingOwed : target.initialOwed;
      setSettleAmount(targetAmount);
      setNote(`结清此单: ${expense.title} (${target.memberName})`);
    }
  };

  const actualPayer = breakdown.payerMember || payer;

  const handleConfirm = async () => {
    if (!selectedDebtorId) {
      alert('请选择要结清的还款成员');
      return;
    }
    if (settleAmount <= 0) {
      alert('请输入有效的还款金额');
      return;
    }

    setIsSubmitting(true);
    try {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch (e) {}

      await onConfirm({
        fromMemberId: selectedDebtorId,
        toMemberId: actualPayer.id,
        amount: Number(settleAmount),
        currency,
        note: note.trim() || `结清此单: ${expense.title} (${selectedDebtor?.memberName || ''})`,
        expenseId: expense.id,
      });
      onClose();
    } catch (err: any) {
      alert(`结清失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh] pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom-6 duration-200">
        {/* Mobile Pull Handle */}
        <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-neutral-900 to-neutral-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Zap className="w-4 h-4 fill-emerald-400 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm sm:text-base tracking-wide">结清此单账目</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
                  每人独立还款
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                「{expense.title}」· 垫付人：{actualPayer.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Bill summary card */}
          <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-neutral-400 block text-[11px]">对应账单明细</span>
              <strong className="text-neutral-900 text-sm font-semibold">{expense.title}</strong>
            </div>
            <div className="text-right">
              <span className="text-neutral-400 block text-[11px]">该单总额</span>
              <span className="text-neutral-900 font-bold text-sm">
                {formatMoney(expense.amount, expense.currency)}
              </span>
            </div>
          </div>

          {/* Section: Per-Person Debtor Breakdown (单条账目每个人单独开的关系) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-neutral-600 font-semibold px-0.5">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-neutral-500" />
                <span>本单成员还款关系 (点击卡片切换还款人)</span>
              </div>
              <span className="text-[11px] text-neutral-500 font-normal">
                {breakdown.unsettledCount === 0 ? (
                  <span className="text-emerald-700 font-semibold">✓ 全单已还清</span>
                ) : (
                  <span>待结清 {breakdown.unsettledCount} 人</span>
                )}
              </span>
            </div>

            <div className="space-y-2">
              {displayDebtors.map(d => {
                const isSelected = d.memberId === selectedDebtorId;
                return (
                  <div
                    key={d.memberId}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectDebtor(d.memberId)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 active:scale-98 ${
                      isSelected
                        ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/25 shadow-xs'
                        : 'bg-neutral-50 hover:bg-neutral-100/90 border-neutral-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        style={{ backgroundColor: d.avatarColor }}
                        className="w-9 h-9 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-2xs"
                      >
                        {d.memberName.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-neutral-900 truncate">
                            {d.memberName}
                          </span>
                          {d.isCurrentUser && (
                            <span className="text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded font-medium">
                              我
                            </span>
                          )}
                          {isSelected && (
                            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded font-medium">
                              当前结清
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">
                          应出 {formatMoney(d.initialOwed, currency)} · 已还 {formatMoney(d.settledAmount, currency)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {d.isSettled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200/70 px-2.5 py-1 rounded-xl">
                          <Check className="w-3 h-3 text-emerald-600" /> 已还清
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/70 border border-amber-200/70 px-2.5 py-1 rounded-xl">
                          待还 {formatMoney(d.remainingOwed, currency)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Visual Transfer Banner for Selected Debtor */}
          <div className="bg-gradient-to-br from-neutral-50 to-emerald-50/40 p-4 rounded-2xl border border-emerald-100/90 flex items-center justify-between gap-2.5">
            {/* From (Selected Debtor) */}
            <div className="flex flex-col items-center gap-1 min-w-[70px]">
              <div
                style={{ backgroundColor: selectedDebtor?.avatarColor || '#3b82f6' }}
                className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center text-sm shadow-xs"
              >
                {selectedDebtor?.memberName.slice(0, 1) || '还'}
              </div>
              <span className="text-xs font-semibold text-neutral-900 truncate max-w-[80px]">
                {selectedDebtor?.memberName}
                {selectedDebtor?.isCurrentUser ? ' (我)' : ''}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">还款人</span>
            </div>

            {/* Transfer Amount Indicator */}
            <div className="flex-1 flex flex-col items-center justify-center px-2">
              <div className="font-extrabold text-2xl text-emerald-700 tracking-tight flex items-baseline gap-0.5">
                <span className="text-base font-bold">{formatMoney(settleAmount, currency).slice(0, 1)}</span>
                <span>{settleAmount}</span>
              </div>
              <div className="flex items-center gap-1 text-emerald-600 my-0.5">
                <div className="h-[2px] w-6 bg-emerald-200" />
                <ArrowRight className="w-4 h-4" />
                <div className="h-[2px] w-6 bg-emerald-200" />
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">还款转账</span>
            </div>

            {/* To (Payer) */}
            <div className="flex flex-col items-center gap-1 min-w-[70px]">
              <div
                style={{ backgroundColor: actualPayer.avatarColor || '#10b981' }}
                className="w-10 h-10 rounded-full text-white font-bold flex items-center justify-center text-sm shadow-xs"
              >
                {actualPayer.name.slice(0, 1)}
              </div>
              <span className="text-xs font-semibold text-neutral-900 truncate max-w-[80px]">
                {actualPayer.name}
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">收款人(垫付方)</span>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-neutral-700">还款结清金额</label>
              {selectedDebtor && selectedDebtor.remainingOwed > 0 && (
                <button
                  type="button"
                  onClick={() => setSettleAmount(selectedDebtor.remainingOwed)}
                  className="text-[11px] text-emerald-700 font-semibold hover:underline"
                >
                  填入待还全额 ({formatMoney(selectedDebtor.remainingOwed, currency)})
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                step="any"
                value={settleAmount || ''}
                onChange={e => setSettleAmount(parseFloat(e.target.value) || 0)}
                placeholder="输入金额"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-400">
                {currency}
              </span>
            </div>
          </div>

          {/* Note input */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">转账说明备注</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="例如：微信转账还清此单"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          {/* Informational callout */}
          <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-100 flex items-start gap-2.5 text-xs text-emerald-800">
            <Info className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              💡 结清后将记入<strong>结算模块</strong>，抵消该成员欠 {actualPayer.name} 的债务。当本单所有成员还清后，首页该账单上的结清按钮将自动隐藏。
            </p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="bg-neutral-50 px-5 py-3.5 border-t border-neutral-200/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800 px-4 py-2.5 rounded-xl hover:bg-neutral-200/50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmitting ? '正在结清...' : `确认结清 (${selectedDebtor?.memberName || ''}还款)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
