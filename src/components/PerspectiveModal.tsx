import React, { useState } from 'react';
import { TripMember } from '../types';
import { X, Check, User, Edit2, Sparkles } from 'lucide-react';

interface PerspectiveModalProps {
  members: TripMember[];
  currentMemberId: string;
  onSelectMember: (memberId: string) => void;
  onRenameMember: (memberId: string, newName: string) => Promise<void>;
  onClose: () => void;
}

export const PerspectiveModal: React.FC<PerspectiveModalProps> = ({
  members,
  currentMemberId,
  onSelectMember,
  onRenameMember,
  onClose,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const startRename = (member: TripMember, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(member.id);
    setEditingName(member.name);
  };

  const saveRename = async (memberId: string) => {
    if (editingName.trim()) {
      await onRenameMember(memberId, editingName.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-float border border-neutral-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-neutral-900" />
            <h3 className="font-bold text-base text-neutral-900">我是谁 / 切换使用者</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          <div className="bg-neutral-50 p-2.5 rounded-xl border border-neutral-100 text-xs text-neutral-600 leading-relaxed space-y-1">
            <div className="flex items-center gap-1 font-semibold text-neutral-800">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>每个人在自己手机上选自己的名字：</span>
            </div>
            <p className="text-[11px] text-neutral-500 pl-4.5">
              · 首页会自动显示<strong>你的专属收支与待还账目</strong>；<br />
              · 记账时说“我付的”，就会直接<strong>记在你的名下</strong>。
            </p>
          </div>

          <div className="space-y-2 pt-1">
            {members.map(m => {
              const isSelected = m.id === currentMemberId;
              const isEditingThis = editingId === m.id;

              return (
                <div
                  key={m.id}
                  onClick={() => {
                    if (!isEditingThis) {
                      onSelectMember(m.id);
                      onClose();
                    }
                  }}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                      : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100/70 text-neutral-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      style={{ backgroundColor: m.avatarColor }}
                      className="w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0 ring-2 ring-white/30"
                    >
                      {m.name.slice(0, 1)}
                    </div>

                    {isEditingThis ? (
                      <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveRename(m.id);
                          }}
                          autoFocus
                          className="w-full bg-white text-neutral-900 px-2 py-1 rounded text-xs border border-neutral-300 focus:outline-none"
                        />
                        <button
                          onClick={() => saveRename(m.id)}
                          className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] font-bold flex-shrink-0"
                        >
                          保存
                        </button>
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <span className="font-bold text-sm block truncate">{m.name}</span>
                        {isSelected && (
                          <span className={`text-[10px] ${isSelected ? 'text-emerald-300' : 'text-neutral-500'}`}>
                            当前正在使用
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {!isEditingThis && (
                      <button
                        onClick={e => startRename(m, e)}
                        title="改名"
                        className={`p-1 rounded hover:bg-white/20 transition-colors ${
                          isSelected ? 'text-neutral-300 hover:text-white' : 'text-neutral-400 hover:text-neutral-700'
                        }`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
