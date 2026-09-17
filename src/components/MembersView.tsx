import React, { useState } from 'react';
import { Trip, TripMember, MemberBalance } from '../types';
import { formatMoney } from '../utils/math';
import { UserPlus, Trash2, Edit2, Check } from 'lucide-react';

interface MembersViewProps {
  trip: Trip;
  balances: MemberBalance[];
  onRenameMember: (memberId: string, name: string) => Promise<void>;
  onAddMember: (name: string) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
}

export const MembersView: React.FC<MembersViewProps> = ({
  trip,
  balances,
  onRenameMember,
  onAddMember,
  onRemoveMember,
}) => {
  const [newMemberName, setNewMemberName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const currency = trip.settlementCurrency;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed || isAdding) return;

    if (['我', '自己', '本人', 'me', 'i'].includes(trimmed.toLowerCase())) {
      alert('请填写具体成员名字或昵称（如：小张、Amy），不能添加“我”。');
      return;
    }

    try {
      setIsAdding(true);
      await onAddMember(trimmed);
      setNewMemberName('');
    } finally {
      setIsAdding(false);
    }
  };

  const startRename = (member: TripMember) => {
    setEditingMemberId(member.id);
    setEditingName(member.name);
  };

  const handleSaveRename = async (memberId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingMemberId(null);
      return;
    }
    if (['我', '自己', '本人', 'me', 'i'].includes(trimmed.toLowerCase())) {
      alert('不能将成员改名为“我”，请填写具体的名字或昵称。');
      return;
    }
    await onRenameMember(memberId, trimmed);
    setEditingMemberId(null);
  };

  const balanceMap = new Map(balances.map(b => [b.memberId, b]));

  return (
    <div className="space-y-6 pb-28">
      {/* Member Management Header & Add form */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200/80 shadow-soft space-y-4">
        <div>
          <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
            旅行成员（共 {trip.members.length} 人）
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            管理本行程的同行成员，支持添加新成员与修改姓名。
          </p>
        </div>

        {/* Add Member Input */}
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newMemberName}
            onChange={e => setNewMemberName(e.target.value)}
            placeholder="输入成员名字，例如：小张、Bob"
            className="flex-1 bg-neutral-50 border border-neutral-200/90 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={isAdding || !newMemberName.trim()}
            className="flex items-center gap-1 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold transition-all shadow-xs active:scale-95"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>添加</span>
          </button>
        </form>
      </div>

      {/* Members List */}
      <div className="space-y-2.5">
        {trip.members.map(member => {
          const bal = balanceMap.get(member.id);
          const isEditing = editingMemberId === member.id;

          return (
            <div
              key={member.id}
              className="bg-white p-4 rounded-2xl border border-neutral-200/80 shadow-soft transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  style={{ backgroundColor: member.avatarColor }}
                  className="w-10 h-10 rounded-full text-white text-sm font-bold flex items-center justify-center ring-2 ring-neutral-100 shadow-xs flex-shrink-0"
                >
                  {member.name.slice(0, 1)}
                </div>

                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 py-0.5">
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveRename(member.id);
                        }}
                        autoFocus
                        className="bg-neutral-50 border border-neutral-300 rounded px-2 py-1 text-xs font-bold text-neutral-900 focus:outline-none"
                      />
                      <button
                        onClick={() => handleSaveRename(member.id)}
                        className="px-2.5 py-1 bg-neutral-900 text-white rounded text-[11px] font-bold"
                      >
                        保存
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 font-bold text-sm text-neutral-900">
                      <span className="truncate">{member.name}</span>
                    </div>
                  )}

                  <div className="text-xs text-neutral-400 mt-0.5 truncate">
                    已付: {formatMoney(bal?.totalPaid || 0, currency)} · 承担: {formatMoney(bal?.totalShare || 0, currency)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                {!isEditing && (
                  <button
                    onClick={() => startRename(member)}
                    title="修改名字"
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}

                {trip.members.length > 1 && (
                  <button
                    onClick={() => {
                      if (window.confirm(`确定要将「${member.name}」移出当前旅行吗？`)) {
                        onRemoveMember(member.id);
                      }
                    }}
                    title="删除成员"
                    className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
