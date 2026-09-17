import React, { useState } from 'react';
import { Trip, Settlement, DebtTransfer, MemberBalance } from '../types';
import { formatMoney } from '../utils/math';
import confetti from 'canvas-confetti';
import {
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Split,
  Layers,
  Info,
} from 'lucide-react';

interface SettlementViewProps {
  trip: Trip;
  balances: MemberBalance[];
  suggestedTransfers: DebtTransfer[];
  rawTransfers: DebtTransfer[];
  settlements: Settlement[];
  onSettleTransfer: (transfer: DebtTransfer) => Promise<void>;
  onDeleteSettlement: (settlementId: string) => Promise<void>;
}

export const SettlementView: React.FC<SettlementViewProps> = ({
  trip,
  balances,
  suggestedTransfers,
  rawTransfers,
  settlements,
  onSettleTransfer,
  onDeleteSettlement,
}) => {
  const [settleMode, setSettleMode] = useState<'simplified' | 'raw'>('simplified');
  const [showExplanationDetail, setShowExplanationDetail] = useState(false);

  const currency = trip.settlementCurrency;
  const memberMap = new Map(trip.members.map(m => [m.id, m]));

  const currentTransfers = settleMode === 'simplified' ? suggestedTransfers : rawTransfers;
  const isAllSettled = currentTransfers.length === 0;

  const handleSettle = async (transfer: DebtTransfer) => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // Ignore
    }

    await onSettleTransfer(transfer);
  };

  return (
    <div className="space-y-6 pb-28">
      {/* 1. Header with Mode Switcher */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-neutral-200/80 shadow-soft space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 tracking-tight flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>结账还款方案</span>
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {settleMode === 'simplified'
                ? '【聪明结账】：多方互相抵消，大家转账次数最少。'
                : '【按单直接还】：谁垫付就直接转给谁，一笔笔对照更直观。'}
            </p>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-neutral-100 p-1 rounded-xl self-start sm:self-auto text-xs font-medium">
            <button
              onClick={() => setSettleMode('simplified')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                settleMode === 'simplified'
                  ? 'bg-white text-neutral-900 font-bold shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>聪明结账 ({suggestedTransfers.length}笔)</span>
            </button>
            <button
              onClick={() => setSettleMode('raw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                settleMode === 'raw'
                  ? 'bg-white text-neutral-900 font-bold shadow-xs'
                  : 'text-neutral-500 hover:text-neutral-900'
              }`}
            >
              <Split className="w-3.5 h-3.5 text-blue-600" />
              <span>按单直接还 ({rawTransfers.length}笔)</span>
            </button>
          </div>
        </div>

        {/* Explain Card when in simplified mode */}
        {settleMode === 'simplified' && (
          <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200/60 text-xs text-neutral-600 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-800 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>为什么金额可能跟单笔账单不同？</span>
              </span>
              <button
                onClick={() => setShowExplanationDetail(!showExplanationDetail)}
                className="text-[11px] text-neutral-500 hover:text-neutral-900 font-medium underline underline-offset-2"
              >
                {showExplanationDetail ? '收起说明' : '展开看看'}
              </button>
            </div>

            {showExplanationDetail && (
              <p className="text-[11px] text-neutral-500 leading-relaxed pt-1">
                举个例子：如果 A 欠 B 515 元，而 B 欠 C 20 元，系统会让 A 直接把这 20 元转给 C，同时 A 转给 B 的钱减少为 495 元。这样每个人最终进出账完全分文不差，还帮 B 省去了一次转账的麻烦！
              </p>
            )}
          </div>
        )}
      </div>

      {/* 2. Transfer Cards List */}
      <div className="space-y-2.5">
        {isAllSettled ? (
          <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-6 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-xl">
              🎉
            </div>
            <h3 className="font-bold text-neutral-900 text-base">所有账目均已结清！</h3>
            <p className="text-xs text-neutral-600">
              当前旅行没有任何人欠款，账目清爽。
            </p>
          </div>
        ) : (
          currentTransfers.map((tf, idx) => (
            <div
              key={`${tf.fromMemberId}-${tf.toMemberId}-${idx}`}
              className="bg-white rounded-2xl p-4 border border-neutral-200/80 shadow-soft hover:border-neutral-300 transition-all space-y-2.5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Transfer Info */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-900">
                      {tf.fromMemberName}
                    </span>
                    <div className="px-2 py-0.5 bg-neutral-100 rounded-full text-neutral-500 flex items-center gap-1 text-xs">
                      <span>支付给</span>
                      <ArrowRight className="w-3 h-3 text-neutral-400" />
                    </div>
                    <span className="font-bold text-sm text-neutral-900">
                      {tf.toMemberName}
                    </span>
                  </div>
                </div>

                {/* Amount & Mark Settled Button */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                  <span className="text-base font-extrabold text-neutral-900 tracking-tight">
                    {formatMoney(tf.amount, tf.currency)}
                  </span>

                  <button
                    onClick={() => handleSettle(tf)}
                    className="flex items-center gap-1 px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>标记已结清</span>
                  </button>
                </div>
              </div>

              {/* Offset Explanation Note (if any) */}
              {tf.explanation && (
                <div className="bg-amber-50/70 border border-amber-200/50 rounded-xl px-3 py-1.5 text-[11px] text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>{tf.explanation}</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 3. Member Net Balance Breakdown */}
      <div className="space-y-3 pt-2">
        <div className="px-1">
          <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
            每人应收 / 应付明细
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            绿色代表他人该转钱给你，橙色代表你该转钱给他人
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-soft divide-y divide-neutral-100 overflow-hidden">
          {balances.map(b => {
            const isSurplus = b.netBalance > 0.01;
            const isDeficit = b.netBalance < -0.01;

            return (
              <div key={b.memberId} className="p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    style={{ backgroundColor: b.avatarColor }}
                    className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center ring-2 ring-neutral-100"
                  >
                    {b.memberName.slice(0, 1)}
                  </div>
                  <div>
                    <div className="font-semibold text-xs sm:text-sm text-neutral-900">
                      {b.memberName}
                      {b.isCurrentUser && (
                        <span className="ml-1 text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.2 rounded-full">
                          我
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      垫付: {formatMoney(b.totalPaid, currency)} · 应承担: {formatMoney(b.totalShare, currency)}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-0.8 rounded-full text-xs font-bold ${
                      isSurplus
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : isDeficit
                        ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}
                  >
                    {isSurplus
                      ? `应收款 +${formatMoney(b.netBalance, currency)}`
                      : isDeficit
                      ? `应付款 -${formatMoney(Math.abs(b.netBalance), currency)}`
                      : '已结清'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Settlement History */}
      {settlements.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="px-1">
            <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
              结清历史明细
            </h2>
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-soft divide-y divide-neutral-100 overflow-hidden">
            {settlements.map(st => {
              const fromName = memberMap.get(st.fromMemberId)?.name || '未知';
              const toName = memberMap.get(st.toMemberId)?.name || '未知';

              return (
                <div key={st.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-800">
                      {fromName} 已转账给 {toName}
                    </span>
                    <span className="text-neutral-400 text-[11px] block mt-0.5">
                      {st.settledAt ? new Date(st.settledAt).toLocaleString('zh-CN', { hour12: false }) : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-neutral-900">
                      {formatMoney(st.amount, st.currency)}
                    </span>
                    <button
                      onClick={() => {
                        if (window.confirm('确定撤销该笔结算记录吗？')) {
                          onDeleteSettlement(st.id);
                        }
                      }}
                      title="撤销结算"
                      className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
