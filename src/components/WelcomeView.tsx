import React, { useState } from 'react';
import { Trip } from '../types';
import { formatMoney } from '../utils/math';
import {
  Compass,
  Sparkles,
  KeyRound,
  ArrowRight,
  Calendar,
  Users,
  Mic,
  ShieldCheck,
  Zap,
  Split,
  Check,
  Share2,
  Trash2,
  Copy,
} from 'lucide-react';
import { copyText, getTripShareUrl } from '../utils/clipboard';

interface WelcomeViewProps {
  trips: Trip[];
  onOpenCreateTrip: () => void;
  onJoinByCode: (code: string) => Promise<void>;
  onSelectTrip: (tripId: string) => void;
  onOpenShare?: (trip: Trip) => void;
  onDeleteTrip?: (tripId: string, accessCode: string) => Promise<void>;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({
  trips,
  onOpenCreateTrip,
  onJoinByCode,
  onSelectTrip,
  onOpenShare,
  onDeleteTrip,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [copiedTripId, setCopiedTripId] = useState<string | null>(null);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = inputCode.trim().toUpperCase();
    if (!cleanCode || isJoining) return;

    try {
      setIsJoining(true);
      setJoinError('');
      await onJoinByCode(cleanCode);
    } catch (err: any) {
      setJoinError(err.message || '未找到该口令对应的旅行，请核对后重试');
    } finally {
      setIsJoining(false);
    }
  };

  const handleDemoClick = async (demoCode: string) => {
    setInputCode(demoCode);
    try {
      setIsJoining(true);
      setJoinError('');
      await onJoinByCode(demoCode);
    } catch (err: any) {
      setJoinError(err.message || '加载示例旅行失败');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyLink = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    const url = getTripShareUrl(trip.accessCode);
    const ok = await copyText(url);
    if (ok) {
      setCopiedTripId(trip.id);
      setTimeout(() => setCopiedTripId(null), 2000);
    }
  };

  const handleDelete = async (e: React.MouseEvent, trip: Trip) => {
    e.stopPropagation();
    if (!onDeleteTrip) return;
    const confirmDelete = window.confirm(
      `确定要删除账本「${trip.name}」吗？\n\n该账本及其所有账单记录将被彻底清除，无法恢复。`
    );
    if (!confirmDelete) return;

    try {
      await onDeleteTrip(trip.id, trip.accessCode);
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12 space-y-10 animate-in fade-in">
      {/* 1. Hero Title & Tagline */}
      <div className="text-center space-y-3.5 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-semibold shadow-2xs">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span>专为朋友结伴出行打造的记账神器</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
          轻装出行，账目一语说清
        </h1>

        <p className="text-sm sm:text-base text-neutral-500 leading-relaxed">
          说话或打字即自动记账，每个人在自己手机上选自己的名字，全团账目自动分摊、聪明抵消。
        </p>
      </div>

      {/* 2. Primary Actions: Join by Code & Create Trip */}
      <div className="max-w-xl mx-auto space-y-4">
        {/* Join by Code Form */}
        <div className="bg-white p-5 sm:p-6 rounded-3xl border border-neutral-200 shadow-soft space-y-3">
          <label className="block text-xs font-bold text-neutral-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-emerald-600" />
              <span>输入 6 位房间口令加入</span>
            </span>
            <span className="text-[11px] text-neutral-400 font-normal">找朋友要 6 位口令</span>
          </label>

          <form onSubmit={handleJoinSubmit} className="flex gap-2.5">
            <input
              type="text"
              maxLength={8}
              value={inputCode}
              onChange={e => {
                setInputCode(e.target.value.toUpperCase());
                setJoinError('');
              }}
              placeholder="例如：MYNRNA"
              className="flex-1 bg-neutral-50 border border-neutral-200 rounded-2xl px-4 py-3 text-sm font-mono font-bold tracking-widest text-neutral-900 placeholder:font-normal placeholder:tracking-normal uppercase focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            <button
              type="submit"
              disabled={!inputCode.trim() || isJoining}
              className="px-6 py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 flex-shrink-0"
            >
              <span>{isJoining ? '加入中...' : '进入旅行'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {joinError && (
            <p className="text-xs text-rose-500 font-medium pt-0.5">{joinError}</p>
          )}
        </div>

        {/* Create New Trip Button */}
        <div className="text-center pt-1">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onOpenCreateTrip}
              className="flex-1 max-w-sm py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <Compass className="w-4 h-4" />
              <span>发起新旅行 (创建房间)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Joined Trips (if any) */}
      {trips.length > 0 && (
        <div className="space-y-3 pt-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>我已加入的旅行</span>
              <span className="text-xs text-neutral-400 font-normal">({trips.length})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {trips.map(trip => (
              <div
                key={trip.id}
                onClick={() => onSelectTrip(trip.id)}
                className="bg-white hover:bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 shadow-2xs hover:shadow-soft transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-neutral-900 group-hover:text-emerald-700 transition-colors">
                      {trip.name}
                    </h4>
                    <p className="text-xs text-neutral-500 mt-0.5">{trip.destination}</p>
                  </div>

                  {/* Actions: Share & Delete */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    {onOpenShare && (
                      <button
                        type="button"
                        onClick={() => onOpenShare(trip)}
                        title="查看微信邀请分享文案"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/70 shadow-2xs transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>分享</span>
                      </button>
                    )}

                    {onDeleteTrip && (
                      <button
                        type="button"
                        onClick={e => handleDelete(e, trip)}
                        title="删除该旅行账本"
                        className="p-1.5 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 border border-neutral-200/80 shadow-2xs transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs mt-3 pt-2.5 border-t border-neutral-100 text-neutral-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {trip.startDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {trip.members?.length || 0} 人
                    </span>
                  </div>

                  <div className="flex items-center gap-1 font-bold text-neutral-800">
                    <span>
                      {formatMoney((trip as any).totalExpense || 0, trip.settlementCurrency)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Product Highlights / Why TripSplit */}
      <div className="pt-4 space-y-4">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-center">
          为什么选择 TripSplit 记账
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-neutral-200/70 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Mic className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-xs text-neutral-900">说话即记账</h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              AI 自动听懂谁买单、谁平摊，无需反复手动填写表单。
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-neutral-200/70 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-xs text-neutral-900">6 位专属口令</h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              系统自动生成专属房间口令，好友点链接即进，防撞防误入。
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-neutral-200/70 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-xs text-neutral-900">聪明结账</h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              多方互相抵消，大家转账次数最少，算账一清二楚。
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-neutral-200/70 shadow-2xs space-y-2">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Split className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-xs text-neutral-900">每单一键结清</h4>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              私下转账后一键点掉，首页直接显示还清，不计入旅游开销。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
