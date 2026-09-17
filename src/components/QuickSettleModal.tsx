import React, { useState } from 'react';
import { Expense, TripMember, Currency } from '../types';
import { formatMoney } from '../utils/math';
import { Check, X, ArrowRight, Zap, Info } from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuickSettleModalProps {
  expense: Expense;
  payer: TripMember;
  currentMember?: TripMember;
  amount: number;
  settlementCurrency: Currency;
  onConfirm: (data: {
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    currency: Currency;
    note: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const QuickSettleModal: React.FC<QuickSettleModalProps> = ({
  expense,
  payer,
  currentMember,
  amount,
  settlementCurrency,
  onConfirm,
  onClose,
}) => {
  const [settleAmount, setSettleAmount] = useState<number>(amount);
  const [note, setNote] = useState<string>(`结清此单: ${expense.title}`);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currency: Currency = expense.currency || settlementCurrency;

  const handleConfirm = async () => {
    if (!currentMember) {
      alert('请先选择或认领您的当前身份');
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
      } catch (e) {
        // Ignore confetti error if any
      }

      await onConfirm({
        fromMemberId: currentMember.id,
        toMemberId: payer.id,
        amount: Number(settleAmount),
        currency,
        note: note.trim() || `结清此单: ${expense.title}`,
      });
      onClose();
    } catch (err: any) {
      alert(`结清失败: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-neutral-900 to-neutral-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Zap className="w-4 h-4 fill-emerald-400 text-emerald-400" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-wide">结清此单账目</span>
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                结算快捷入口
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Bill preview banner */}
          <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200/70 flex items-center justify-between text-xs">
            <div>
              <span className="text-neutral-400 block text-[11px]">对应消费账单</span>
              <strong className="text-neutral-800 text-sm font-semibold">{expense.title}</strong>
            </div>
            <div className="text-right">
              <span className="text-neutral-400 block text-[11px]">该单总额</span>
              <span className="text-neutral-700 font-medium">{formatMoney(expense.amount, expense.currency)}</span>
            </div>
          </div>

          {/* Visual Transfer Banner */}
          <div className="bg-gradient-to-br from-neutral-50 to-emerald-50/40 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between gap-3">
            {/* From (Current User) */}
            <div className="flex flex-col items-center gap-1 min-w-[70px]">
              <div
                style={{ backgroundColor: currentMember?.avatarColor || '#3b82f6' }}
                className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center text-sm shadow-xs"
              >
                {currentMember?.name.slice(0, 1) || '我'}
              </div>
              <span className="text-xs font-semibold text-neutral-900 truncate max-w-[80px]">
                {currentMember?.name || '我'} (我)
              </span>
              <span className="text-[10px] text-neutral-400">还款人</span>
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
              <span className="text-[10px] text-emerald-600 font-medium">直结还款</span>
            </div>

            {/* To (Payer) */}
            <div className="flex flex-col items-center gap-1 min-w-[70px]">
              <div
                style={{ backgroundColor: payer?.avatarColor || '#10b981' }}
                className="w-11 h-11 rounded-full text-white font-bold flex items-center justify-center text-sm shadow-xs"
              >
                {payer?.name.slice(0, 1)}
              </div>
              <span className="text-xs font-semibold text-neutral-900 truncate max-w-[80px]">
                {payer?.name}
              </span>
              <span className="text-[10px] text-neutral-400">收款人(垫付方)</span>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-600">还款结清金额</label>
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
            <label className="block text-xs font-semibold text-neutral-600 mb-1">转账说明备注</label>
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
              💡 结清后将作为一笔还款记录记入<strong>结算模块</strong>，抵消你欠 {payer?.name} 的债务，不会重复计入团内总消费。
            </p>
          </div>
        </div>

        {/* Action Footer */}
        <div className="bg-neutral-50 px-5 py-3.5 border-t border-neutral-200/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800 px-3 py-2 rounded-xl hover:bg-neutral-200/50 transition-colors"
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
            <span>{isSubmitting ? '正在结清...' : '确认结清转账'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
