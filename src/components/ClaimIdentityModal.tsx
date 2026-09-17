import React, { useState } from 'react';
import { Trip, TripMember } from '../types';
import { UserCheck, UserPlus, Check, X, Sparkles } from 'lucide-react';

interface ClaimIdentityModalProps {
  trip: Trip;
  onClaim: (memberId: string) => void;
  onAddAndClaim: (name: string) => Promise<void>;
  onClose?: () => void;
}

export const ClaimIdentityModal: React.FC<ClaimIdentityModalProps> = ({
  trip,
  onClaim,
  onAddAndClaim,
  onClose,
}) => {
  const [newMemberName, setNewMemberName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemberName.trim();
    if (!trimmed || isAdding) return;

    try {
      setIsAdding(true);
      await onAddAndClaim(trimmed);
    } catch (err: any) {
      alert(`加入失败: ${err.message}`);
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">你是哪一位？</h3>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                  初次进入
                </span>
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                欢迎来到「{trip.name}」
              </p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-xs text-neutral-600 leading-relaxed">
            选一下你的名字，首页就会自动显示<strong>你花了多少钱、该找谁结账、谁该给你转钱</strong>：
          </p>

          {/* Members List */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold text-neutral-500">
              我是群里的：
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {trip.members.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onClaim(m.id)}
                  className="p-3 rounded-2xl border border-neutral-200 hover:border-neutral-900 bg-neutral-50 hover:bg-neutral-900 hover:text-white group transition-all flex items-center justify-between text-left active:scale-98 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      style={{ backgroundColor: m.avatarColor }}
                      className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 shadow-xs"
                    >
                      {m.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">
                        {m.name}
                      </div>
                      {idx === 0 && (
                        <div className="text-[10px] text-neutral-400 group-hover:text-neutral-300">
                          发起人
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-lg bg-white group-hover:bg-neutral-800 text-neutral-700 group-hover:text-emerald-400 shadow-2xs border border-neutral-200/60 group-hover:border-neutral-700 transition-all flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>是我</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Add New Member Section */}
          <div className="pt-2 border-t border-neutral-100">
            <label className="block text-[11px] font-bold text-neutral-500 mb-2 flex items-center gap-1">
              <UserPlus className="w-3.5 h-3.5 text-neutral-400" />
              <span>名单里没有我？新加一个名字：</span>
            </label>

            <form onSubmit={handleAddNew} className="flex gap-2">
              <input
                type="text"
                value={newMemberName}
                onChange={e => setNewMemberName(e.target.value)}
                placeholder="输入你的名字或昵称..."
                className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
              <button
                type="submit"
                disabled={!newMemberName.trim() || isAdding}
                className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1 active:scale-95 flex-shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isAdding ? '加入中...' : '加入'}</span>
              </button>
            </form>
          </div>

          <div className="p-2.5 bg-neutral-50 rounded-xl text-[11px] text-neutral-400 leading-relaxed flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>选错不用担心，随时在右上角点击名字即可换人。每个人在自己手机上选自己的名字，互不影响。</span>
          </div>
        </div>

        {/* Footer */}
        {onClose && (
          <div className="px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-neutral-400 hover:text-neutral-700 py-1 px-3"
            >
              先随便看看
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
