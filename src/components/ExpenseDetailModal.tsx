import React, { useState } from 'react';
import { Expense, TripMember, Category, Currency, SplitType, CATEGORY_EMOJIS, CURRENCY_NAMES } from '../types';
import { splitEqually, convertCurrency, formatMoney } from '../utils/math';
import { X, Check, Trash2 } from 'lucide-react';

interface ExpenseDetailModalProps {
  expense: Expense;
  members: TripMember[];
  currentMemberId?: string;
  settlementCurrency: Currency;
  onSave: (updated: Partial<Expense>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
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

export const ExpenseDetailModal: React.FC<ExpenseDetailModalProps> = ({
  expense,
  members,
  currentMemberId,
  settlementCurrency,
  onSave,
  onDelete,
  onClose,
}) => {
  const isMe = (m: TripMember) => (currentMemberId ? m.id === currentMemberId : !!m.isCurrentUser);
  const [title, setTitle] = useState(expense.title);
  const [category, setCategory] = useState<Category>(expense.category);
  const [amount, setAmount] = useState(expense.amount);
  const [currency, setCurrency] = useState<Currency>(expense.currency);
  const [customRate, setCustomRate] = useState<number | undefined>(expense.exchangeRate);
  const [date, setDate] = useState(expense.date);
  const [notes, setNotes] = useState(expense.notes || '');

  // Payers state
  const [selectedPayerId, setSelectedPayerId] = useState<string>(() => {
    return expense.payers[0]?.memberId || members[0]?.id || '';
  });

  // Participants state
  const [selectedParticipants, setSelectedParticipants] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    members.forEach(m => {
      map[m.id] = expense.participants.some(p => p.memberId === m.id);
    });
    if (!Object.values(map).some(Boolean)) {
      members.forEach(m => { map[m.id] = true; });
    }
    return map;
  });

  const { settlementAmount, exchangeRate } = convertCurrency(amount, currency, settlementCurrency, customRate);
  const activeMembers = members.filter(m => selectedParticipants[m.id]);
  const shares = splitEqually(amount, activeMembers.length, currency);

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants(prev => {
      const next = { ...prev, [memberId]: !prev[memberId] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  const handleSave = async () => {
    const payers = [{ memberId: selectedPayerId, amount: Number(amount) }];
    const participants = activeMembers.map((m, idx) => ({
      memberId: m.id,
      share: shares[idx] || 0,
    }));

    await onSave({
      id: expense.id,
      title: title.trim(),
      category,
      amount: Number(amount),
      currency,
      settlementAmount,
      exchangeRate,
      date,
      splitType: 'equal',
      notes,
      payers,
      participants,
    });
    onClose();
  };

  const isForeign = currency !== settlementCurrency;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="font-bold text-base text-neutral-900">编辑消费账单</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Title & Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">消费项目</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">消费金额</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as Currency)}
                  className="bg-neutral-50 border border-neutral-200 rounded-xl px-2 py-2 text-xs text-neutral-700"
                >
                  {Object.keys(CURRENCY_NAMES).map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {isForeign && (
            <div className="text-xs text-neutral-500 bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 flex items-center justify-between">
              <span>折合结算币种：<strong>{formatMoney(settlementAmount, settlementCurrency)}</strong></span>
              <div className="flex items-center gap-1">
                <span>汇率 1:</span>
                <input
                  type="number"
                  step="any"
                  value={customRate || ''}
                  onChange={e => setCustomRate(parseFloat(e.target.value) || undefined)}
                  placeholder={exchangeRate.toString()}
                  className="w-16 bg-white border border-neutral-300 rounded px-1 py-0.5 text-xs text-neutral-800"
                />
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">分类</label>
            <div className="grid grid-cols-5 gap-1.5">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`p-1.5 rounded-xl text-center text-xs transition-all flex flex-col items-center gap-0.5 ${
                    category === cat
                      ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                      : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-700 border border-neutral-200/50'
                  }`}
                >
                  <span className="text-base">{CATEGORY_EMOJIS[cat]}</span>
                  <span className="text-[10px] truncate w-full">{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1">消费日期</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900"
            />
          </div>

          {/* Payer */}
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">付款人</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {members.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedPayerId(m.id)}
                  className={`flex items-center gap-2 p-2 rounded-xl text-xs font-medium border transition-all ${
                    selectedPayerId === m.id
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 text-neutral-700'
                  }`}
                >
                  <span
                    style={{ backgroundColor: m.avatarColor }}
                    className="w-4 h-4 rounded-full text-[10px] text-white flex items-center justify-center"
                  >
                    {m.name.slice(0, 1)}
                  </span>
                  <span className="truncate">{m.name}{isMe(m) ? ' (我)' : ''}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Participants */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-neutral-600">参与平摊人员</span>
              <span className="text-neutral-400">
                每人: {formatMoney(shares[0] || 0, currency)}
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
                        ? 'border-neutral-900/50 bg-neutral-50 text-neutral-900 font-medium'
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

        {/* Footer */}
        <div className="bg-neutral-50 px-5 py-3.5 border-t border-neutral-200/80 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (window.confirm('确定删除该笔账单吗？')) {
                onDelete(expense.id);
                onClose();
              }
            }}
            className="flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-800 px-3 py-2 rounded-xl hover:bg-neutral-200/50 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>保存修改</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
