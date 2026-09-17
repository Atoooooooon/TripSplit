import React from 'react';
import { Trip, TripSummary } from '../types';
import { formatMoney } from '../utils/math';
import { Users, Calendar, ArrowUpRight, ArrowDownLeft, CheckCircle2, Share2 } from 'lucide-react';

interface TripSummaryHeaderProps {
  trip: Trip;
  summary: TripSummary;
  onOpenSettlement?: () => void;
  onOpenShare?: () => void;
}

export const TripSummaryHeader: React.FC<TripSummaryHeaderProps> = ({
  trip,
  summary,
  onOpenSettlement,
  onOpenShare,
}) => {
  const currency = trip.settlementCurrency;

  return (
    <div className="bg-white border-b border-neutral-200/80 px-4 pt-5 pb-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Trip Meta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
                {trip.name}
              </h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-neutral-100 text-neutral-600">
                {trip.destination}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-neutral-500 mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {trip.startDate} ~ {trip.endDate}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {summary.memberCount} 人 · {summary.billCount} 笔账单
              </span>
            </div>
          </div>

          {/* Member Avatars & Quick Invite Button */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center -space-x-1.5">
              {trip.members.map(m => (
                <div
                  key={m.id}
                  title={`${m.name}${m.isCurrentUser ? '（我）' : ''}`}
                  style={{ backgroundColor: m.avatarColor }}
                  className="w-7 h-7 rounded-full text-white text-xs font-medium flex items-center justify-center ring-2 ring-white shadow-sm"
                >
                  {m.name.slice(0, 1)}
                </div>
              ))}
            </div>

            {onOpenShare && (
              <button
                type="button"
                onClick={onOpenShare}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-700 text-xs font-medium border border-neutral-200/80 transition-all active:scale-95 shadow-2xs"
                title="邀请朋友加入房间"
              >
                <Share2 className="w-3 h-3 text-neutral-500" />
                <span>邀请</span>
              </button>
            )}
          </div>
        </div>

        {/* 4 Core Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Total Expense */}
          <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex flex-col justify-between">
            <span className="text-xs font-medium text-neutral-500">总消费</span>
            <div className="mt-1">
              <span className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                {formatMoney(summary.totalExpense, currency)}
              </span>
              <span className="text-[11px] text-neutral-400 ml-1">{currency}</span>
            </div>
          </div>

          {/* My Paid */}
          <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex flex-col justify-between">
            <span className="text-xs font-medium text-neutral-500">我的支出</span>
            <div className="mt-1">
              <span className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                {formatMoney(summary.myPaid, currency)}
              </span>
              <span className="text-[11px] text-neutral-400 ml-1">{currency}</span>
            </div>
          </div>

          {/* My Share */}
          <div className="bg-neutral-50 rounded-2xl p-3 border border-neutral-100 flex flex-col justify-between">
            <span className="text-xs font-medium text-neutral-500">我的实际承担</span>
            <div className="mt-1">
              <span className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight">
                {formatMoney(summary.myShare, currency)}
              </span>
              <span className="text-[11px] text-neutral-400 ml-1">{currency}</span>
            </div>
          </div>

          {/* Net Balance (Surplus / Deficit) */}
          <div
            className={`rounded-2xl p-3 border flex flex-col justify-between transition-all ${
              summary.myNetBalance > 0.01
                ? 'bg-emerald-50/70 border-emerald-200/70 text-emerald-900'
                : summary.myNetBalance < -0.01
                ? 'bg-amber-50/70 border-amber-200/70 text-amber-900'
                : 'bg-neutral-50 border-neutral-100 text-neutral-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium">
              <span>
                {summary.myNetBalance > 0.01
                  ? '别人欠我'
                  : summary.myNetBalance < -0.01
                  ? '我欠别人'
                  : '费用状态'}
              </span>
              {summary.myNetBalance > 0.01 && <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />}
              {summary.myNetBalance < -0.01 && <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />}
              {Math.abs(summary.myNetBalance) <= 0.01 && <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400" />}
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-1">
              <div>
                <span className="text-base sm:text-lg font-bold tracking-tight">
                  {Math.abs(summary.myNetBalance) <= 0.01
                    ? '已结清'
                    : formatMoney(Math.abs(summary.myNetBalance), currency)}
                </span>
                {Math.abs(summary.myNetBalance) > 0.01 && (
                  <span className="text-[11px] opacity-75 ml-1">{currency}</span>
                )}
              </div>
              {summary.myNetBalance < -0.01 && onOpenSettlement && (
                <button
                  type="button"
                  onClick={onOpenSettlement}
                  className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-semibold transition-all shadow-2xs active:scale-95 flex-shrink-0"
                >
                  去结清 ⚡
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
