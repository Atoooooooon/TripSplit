import React, { useState, useEffect } from 'react';
import {
  AiExpenseDraft,
  TripMember,
  Category,
  Currency,
  SplitType,
  CATEGORY_EMOJIS,
  CURRENCY_NAMES,
} from '../types';
import { splitEqually, convertCurrency, formatMoney, roundCurrency } from '../utils/math';
import { Sparkles, Check, Edit2, X, AlertCircle } from 'lucide-react';

interface AiConfirmCardProps {
  draft: AiExpenseDraft;
  members: TripMember[];
  currentMemberId?: string;
  settlementCurrency: Currency;
  onConfirm: (finalData: any) => void;
  onCancel: () => void;
}

const CATEGORIES: Category[] = [
  '餐饮',
  '交通',
  '住宿',
  '门票',
  '购物',
  '娱乐',
  '机票',
  '咖啡',
  '超市',
  '其他',
];

export const AiConfirmCard: React.FC<AiConfirmCardProps> = ({
  draft,
  members,
  currentMemberId,
  settlementCurrency,
  onConfirm,
  onCancel,
}) => {
  const isMe = (m: TripMember) => (currentMemberId ? m.id === currentMemberId : !!m.isCurrentUser);

  // ================= Expense State =================
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(draft.title || '消费');
  const [category, setCategory] = useState<Category>(draft.category || '其他');
  const [amount, setAmount] = useState(draft.amount || 0);
  const [currency, setCurrency] = useState<Currency>(draft.currency || settlementCurrency);
  const [customRate, setCustomRate] = useState<number | undefined>(draft.exchangeRate);
  const [date, setDate] = useState(draft.date || new Date().toISOString().split('T')[0]);
  const [splitType, setSplitType] = useState<SplitType>(draft.splitType || 'equal');

  // Payer state (single or multi)
  const [selectedPayerId, setSelectedPayerId] = useState<string>(() => {
    if (draft.payers && draft.payers.length > 0 && draft.payers[0].memberId) {
      return draft.payers[0].memberId;
    }
    if (currentMemberId) {
      const match = members.find(m => m.id === currentMemberId);
      if (match) return match.id;
    }
    const current = members.find(m => isMe(m));
    return current ? current.id : members[0]?.id || '';
  });

  // Participants selection state (boolean map of memberId -> selected)
  const [selectedParticipants, setSelectedParticipants] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    if (draft.participants && draft.participants.length > 0) {
      members.forEach(m => {
        const inDraft = draft.participants.some(
          p => p.memberId === m.id || p.memberName === m.name || (isMe(m) && (p.memberName === '我' || p.memberName === '自己'))
        );
        map[m.id] = inDraft;
      });
    } else {
      members.forEach(m => {
        map[m.id] = true;
      });
    }
    // Ensure at least one is selected
    if (!Object.values(map).some(Boolean)) {
      members.forEach(m => {
        map[m.id] = true;
      });
    }
    return map;
  });

  // Calculate currency conversion
  const { settlementAmount: expSettlementAmount, exchangeRate } = convertCurrency(
    amount,
    currency,
    settlementCurrency,
    customRate
  );

  // Calculate shares based on selected participants
  const activeMembers = members.filter(m => selectedParticipants[m.id]);
  const shares = splitEqually(amount, activeMembers.length, currency);

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants(prev => {
      const next = { ...prev, [memberId]: !prev[memberId] };
      // Prevent unchecking all
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  const handleExpenseConfirm = () => {
    const payers = [
      {
        memberId: selectedPayerId,
        amount: Number(amount),
      },
    ];

    const participants = activeMembers.map((m, idx) => ({
      memberId: m.id,
      share: shares[idx] || 0,
    }));

    onConfirm({
      title: title.trim(),
      category,
      amount: Number(amount),
      currency,
      settlementAmount: expSettlementAmount,
      exchangeRate,
      date,
      splitType,
      payers,
      participants,
    });
  };

  const isForeign = currency !== settlementCurrency;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Badge */}
        <div className="bg-neutral-900 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm tracking-wide">AI 账单识别结果</span>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content area */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Top Info Banner: Emoji, Title, Amount */}
          <div className="flex items-start justify-between gap-3 bg-neutral-50 p-4 rounded-2xl border border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="text-3xl p-2 bg-white rounded-xl shadow-xs border border-neutral-200/50">
                {CATEGORY_EMOJIS[category] || '📦'}
              </div>
              <div>
                {isEditing ? (
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="font-bold text-base text-neutral-900 bg-white border border-neutral-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                ) : (
                  <h3 className="font-bold text-base text-neutral-900">{title}</h3>
                )}
                <span className="text-xs text-neutral-500 font-medium">{category}</span>
              </div>
            </div>

            <div className="text-right">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                    className="font-bold text-lg text-right w-24 bg-white border border-neutral-300 rounded px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value as Currency)}
                    className="text-xs bg-white border border-neutral-300 rounded px-1 py-1"
                  >
                    {Object.keys(CURRENCY_NAMES).map(c => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="font-extrabold text-xl text-neutral-900 tracking-tight">
                  {formatMoney(amount, currency)}
                </div>
              )}

              {isForeign && (
                <div className="text-xs text-neutral-400 mt-0.5 font-medium">
                  ≈ {formatMoney(settlementAmount, settlementCurrency)}
                  <span className="text-[10px] text-neutral-400 ml-1">
                    (汇率 1:{exchangeRate})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Edit Fields when isEditing */}
          {isEditing && (
            <div className="space-y-3 bg-neutral-50/70 p-3.5 rounded-2xl border border-neutral-200/70 text-xs">
              <div>
                <label className="block text-neutral-500 font-medium mb-1">选择分类</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(cat)}
                      className={`p-1.5 rounded-lg text-center transition-all flex flex-col items-center gap-0.5 ${
                        category === cat
                          ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                          : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-200/60'
                      }`}
                    >
                      <span>{CATEGORY_EMOJIS[cat]}</span>
                      <span className="text-[10px] truncate w-full">{cat}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-neutral-500 font-medium mb-1">消费日期</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-xs text-neutral-800"
                  />
                </div>
                {isForeign && (
                  <div>
                    <label className="block text-neutral-500 font-medium mb-1">
                      自定义汇率 (1 {settlementCurrency} = X {currency})
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder={exchangeRate.toString()}
                      value={customRate || ''}
                      onChange={e => setCustomRate(parseFloat(e.target.value) || undefined)}
                      className="w-full bg-white border border-neutral-300 rounded-lg px-2 py-1.5 text-xs text-neutral-800"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payer Section */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-neutral-600 block">谁付的款</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {members.map(m => {
                const isSelected = selectedPayerId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedPayerId(m.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
                        ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                        : 'border-neutral-200/80 bg-white hover:bg-neutral-50 text-neutral-700'
                    }`}
                  >
                    <span
                      style={{ backgroundColor: m.avatarColor }}
                      className="w-4 h-4 rounded-full text-[10px] text-white flex items-center justify-center flex-shrink-0"
                    >
                      {m.name.slice(0, 1)}
                    </span>
                    <span className="truncate">{m.name}{isMe(m) ? ' (我)' : ''}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Participants & Share Section */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-600">参与平摊成员</span>
              <span className="text-neutral-500 font-medium">
                平均每人：<strong className="text-neutral-900">{formatMoney(shares[0] || 0, currency)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {members.map((m, idx) => {
                const isSelected = !!selectedParticipants[m.id];
                const memberShareIndex = activeMembers.findIndex(am => am.id === m.id);
                const shareAmount = memberShareIndex >= 0 ? shares[memberShareIndex] : 0;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleParticipant(m.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs border transition-all ${
                      isSelected
                        ? 'border-neutral-900/40 bg-neutral-50 text-neutral-900 font-medium'
                        : 'border-dashed border-neutral-300 text-neutral-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center text-[10px] ${
                          isSelected ? 'bg-neutral-900 text-white' : 'border border-neutral-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <span className="truncate">{m.name}{isMe(m) ? ' (我)' : ''}</span>
                    </div>

                    {isSelected && (
                      <span className="text-neutral-600 font-semibold ml-1 flex-shrink-0">
                        {formatMoney(shareAmount, currency)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="bg-neutral-50 px-5 py-3.5 border-t border-neutral-200/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1 text-xs font-medium text-neutral-600 hover:text-neutral-900 px-3 py-2 rounded-xl hover:bg-neutral-200/60 transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{isEditing ? '收起编辑' : '修改明细'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-800 px-3 py-2 rounded-xl hover:bg-neutral-200/50 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleExpenseConfirm}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>确认记账</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
