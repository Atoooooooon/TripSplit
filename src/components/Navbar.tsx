import React, { useRef } from 'react';
import { Compass, Plus, ChevronDown, Share2, RotateCw } from 'lucide-react';
import { Trip, TripMember } from '../types';

interface NavbarProps {
  currentTrip: Trip | null;
  currentMember: TripMember | null;
  isSyncing?: boolean;
  onRefresh?: () => void;
  onOpenTripSwitcher: () => void;
  onOpenCreateTrip: () => void;
  onOpenPerspective: () => void;
  onOpenDevAuth: () => void;
  onOpenShare?: () => void;
  onGoHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTrip,
  currentMember,
  isSyncing,
  onRefresh,
  onOpenTripSwitcher,
  onOpenCreateTrip,
  onOpenPerspective,
  onOpenDevAuth,
  onOpenShare,
  onGoHome,
}) => {
  const clickTimesRef = useRef<number[]>([]);

  const handleLogoClick = () => {
    const now = Date.now();
    // Keep clicks within the last 2.5 seconds
    clickTimesRef.current = clickTimesRef.current.filter(t => now - t < 2500);
    clickTimesRef.current.push(now);

    if (clickTimesRef.current.length >= 5) {
      clickTimesRef.current = [];
      onOpenDevAuth();
    } else {
      onGoHome?.();
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-neutral-200/80 px-3 sm:px-4 py-2.5 sm:py-3 transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Brand Logo & Current Trip Switcher */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-1.5 sm:gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer select-none active:scale-95 flex-shrink-0"
            title="返回起始首页 (连续点击5次可进入开发者设置)"
          >
            <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-sm font-bold tracking-wider text-xs sm:text-sm flex-shrink-0">
              TS
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-neutral-900 hidden md:inline">
              TripSplit
            </span>
          </button>

          {currentTrip && (
            <button
              onClick={onOpenTripSwitcher}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs sm:text-sm font-medium transition-colors border border-neutral-200/50 max-w-[110px] xs:max-w-[140px] sm:max-w-[200px]"
              title={`当前旅行: ${currentTrip.name} (点击切换)`}
            >
              <Compass className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
              <span className="truncate">{currentTrip.name}</span>
              <ChevronDown className="w-3 h-3 text-neutral-400 flex-shrink-0" />
            </button>
          )}
        </div>

        {/* Right: Actions Cluster (Refresh, Share, Perspective, Create) */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Active Refresh Button */}
          {currentTrip && onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isSyncing}
              title={isSyncing ? '正在同步最新账目...' : '主动刷新最新账目'}
              aria-label="刷新最新账单数据"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 hover:bg-neutral-200/90 text-neutral-600 hover:text-neutral-900 border border-neutral-200/60 active:scale-95 transition-all disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 transition-transform ${isSyncing ? 'animate-spin text-neutral-900' : ''}`} />
            </button>
          )}

          {/* Share / Invite Button - Mobile adapted: compact icon-only on mobile, icon+label on sm: */}
          {currentTrip && onOpenShare && (
            <button
              type="button"
              onClick={onOpenShare}
              title="邀请好友加入房间"
              aria-label="邀请好友加入房间"
              className="h-8 px-2 sm:px-3 rounded-full bg-neutral-100 hover:bg-neutral-200/90 text-neutral-800 border border-neutral-200/60 flex items-center gap-1.5 text-xs font-medium active:scale-95 transition-all shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-neutral-600" />
              <span className="hidden sm:inline">分享</span>
            </button>
          )}

          {/* User Perspective Pill */}
          {currentMember && (
            <button
              type="button"
              onClick={onOpenPerspective}
              title="切换当前使用者（在自己手机上选自己的名字）"
              className="h-8 flex items-center gap-1.5 px-2 sm:px-2.5 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs font-semibold transition-colors border border-neutral-200/60 shadow-2xs active:scale-95"
            >
              <div
                style={{ backgroundColor: currentMember.avatarColor }}
                className="w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0"
              >
                {currentMember.name.slice(0, 1)}
              </div>
              <span className="truncate max-w-[48px] xs:max-w-[65px] sm:max-w-[90px]">
                {currentMember.name}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-400 flex-shrink-0" />
            </button>
          )}

          {/* Create Trip Button */}
          <button
            type="button"
            onClick={onOpenCreateTrip}
            title="创建新旅行房间"
            className="h-8 px-2.5 sm:px-3 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-medium shadow-sm transition-all active:scale-95 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">创建旅行</span>
          </button>
        </div>
      </div>
    </header>
  );
};
