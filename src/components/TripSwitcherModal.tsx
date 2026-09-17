import React, { useState } from 'react';
import { Trip } from '../types';
import { formatMoney } from '../utils/math';
import {
  Compass,
  X,
  Plus,
  KeyRound,
  Check,
  Calendar,
  Users,
  Copy,
  ArrowRight,
  Share2,
  Trash2,
} from 'lucide-react';
import { copyText, getTripShareUrl } from '../utils/clipboard';

interface TripSwitcherModalProps {
  trips: Trip[];
  activeTripId: string;
  onSelectTrip: (id: string) => void;
  onJoinByCode: (code: string) => Promise<void>;
  onOpenCreateTrip: () => void;
  onDeleteTrip: (tripId: string, accessCode: string) => Promise<void>;
  onOpenShare: (trip: Trip) => void;
  onClose: () => void;
}

export const TripSwitcherModal: React.FC<TripSwitcherModalProps> = ({
  trips,
  activeTripId,
  onSelectTrip,
  onJoinByCode,
  onOpenCreateTrip,
  onDeleteTrip,
  onOpenShare,
  onClose,
}) => {
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode || isJoining) return;

    try {
      setIsJoining(true);
      setJoinError('');
      await onJoinByCode(cleanCode);
      setCode('');
      onClose();
    } catch (err: any) {
      setJoinError(err.message || '加入失败，请检查口令');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    const inviteUrl = getTripShareUrl(trip.accessCode);
    const success = await copyText(inviteUrl);
    if (success) {
      setCopiedCode(trip.id);
      setTimeout(() => setCopiedCode(null), 2000);
    } else {
      alert('复制失败，请手动长按复制');
    }
  };

  const handleDelete = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    const confirmDelete = window.confirm(
      `确定要删除账本「${trip.name}」吗？\n\n该账本及其所有消费账单、结账记录都将被永久删除，无法撤销。`
    );
    if (!confirmDelete) return;

    try {
      setDeletingId(trip.id);
      await onDeleteTrip(trip.id, trip.accessCode);
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-neutral-900" />
            <div>
              <h3 className="font-bold text-base text-neutral-900 leading-tight">切换旅行账本</h3>
              <p className="text-[11px] text-neutral-400">已加入的旅行记录，可随时切换查看或删除</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Join by Access Code Section */}
        <div className="p-4 bg-neutral-50/80 border-b border-neutral-200/60">
          <form onSubmit={handleJoin} className="space-y-2">
            <label className="block text-xs font-semibold text-neutral-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
                <span>输入口令加入新旅行</span>
              </span>
              <span className="text-[10px] text-neutral-400 font-normal">找朋友要 6 位房间口令</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={e => {
                  setCode(e.target.value.toUpperCase());
                  setJoinError('');
                }}
                placeholder="输入 6 位口令..."
                className="flex-1 bg-white border border-neutral-300 rounded-xl px-3 py-1.5 text-xs font-mono font-bold tracking-wider text-neutral-900 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-neutral-900 uppercase"
              />
              <button
                type="submit"
                disabled={!code.trim() || isJoining}
                className="px-4 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 transition-all"
              >
                <span>{isJoining ? '加入中...' : '加入'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {joinError && (
              <p className="text-[11px] text-rose-500 font-medium">{joinError}</p>
            )}
          </form>
        </div>

        {/* Trips list */}
        <div className="p-4 space-y-2.5 overflow-y-auto flex-1">
          {trips.length === 0 ? (
            <div className="text-center py-8 text-neutral-400 space-y-1">
              <p className="text-xs">暂无已加入的旅行</p>
              <p className="text-[11px]">可输入好友分享的口令，或直接新建旅行</p>
            </div>
          ) : (
            trips.map(trip => {
              const isActive = trip.id === activeTripId;
              const isCopied = copiedCode === trip.id;
              const isDeleting = deletingId === trip.id;

              return (
                <div
                  key={trip.id}
                  onClick={() => {
                    onSelectTrip(trip.id);
                    onClose();
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isActive
                      ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                      : 'border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/70 text-neutral-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm">{trip.name}</h4>
                        {isActive && (
                          <span className="p-0.5 bg-white/20 rounded-full text-white">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-0.5 ${
                          isActive ? 'text-neutral-300' : 'text-neutral-500'
                        }`}
                      >
                        {trip.destination}
                      </p>
                    </div>

                    {/* Actions: Share Modal & Delete */}
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {/* Share Button */}
                      <button
                        type="button"
                        onClick={() => onOpenShare(trip)}
                        title="分享旅行文案"
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                          isActive
                            ? 'bg-neutral-800 hover:bg-neutral-700 text-white'
                            : 'bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200/70 shadow-2xs'
                        }`}
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>分享</span>
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={e => handleDelete(e, trip)}
                        title="删除该旅行账本"
                        className={`p-1.5 rounded-xl transition-colors active:scale-95 ${
                          isActive
                            ? 'bg-neutral-800 hover:bg-rose-900/60 text-neutral-400 hover:text-rose-300'
                            : 'bg-white hover:bg-rose-50 text-neutral-400 hover:text-rose-600 border border-neutral-200 shadow-2xs'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div
                    className={`flex items-center justify-between text-xs mt-3 pt-2.5 border-t ${
                      isActive ? 'border-neutral-800 text-neutral-300' : 'border-neutral-200 text-neutral-500'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {trip.startDate}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {trip.members ? trip.members.length : 0} 人
                      </span>
                    </div>

                    {(trip as any).totalExpense !== undefined && (
                      <span className="font-bold">
                        {formatMoney((trip as any).totalExpense || 0, trip.settlementCurrency)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Create new trip */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50">
          <button
            onClick={() => {
              onClose();
              onOpenCreateTrip();
            }}
            className="w-full py-2.5 rounded-2xl bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-2xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>创建新旅行</span>
          </button>
        </div>
      </div>
    </div>
  );
};
