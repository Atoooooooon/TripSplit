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
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-neutral-200/80 px-4 py-3 transition-all">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Brand (5 clicks to enter Dev mode) & Trip Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={handleLogoClick}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left cursor-pointer select-none active:scale-95"
            title="返回起始首页"
          >
            <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-sm font-semibold tracking-wider text-sm">
              TS
            </div>
            <span className="font-bold text-lg tracking-tight text-neutral-900 hidden sm:inline">
              TripSplit
            </span>
          </button>

          {currentTrip && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenTripSwitcher}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs sm:text-sm font-medium transition-colors"
              >
                <Compass className="w-3.5 h-3.5 text-neutral-500" />
                <span className="truncate max-w-[100px] sm:max-w-[180px]">
                  {currentTrip.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {/* Dedicated Share Button */}
              {onOpenShare && (
                <button
                  onClick={onOpenShare}
                  title="邀请朋友加入"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-semibold transition-all active:scale-95 shadow-2xs"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>分享</span>
                </button>
              )}

              {/* Refresh Button */}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isSyncing}
                  title="刷新最新数据 (多手机实时同步)"
                  className="p-1.5 rounded-full text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 border border-transparent hover:border-neutral-200/60 transition-all active:scale-95 disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-neutral-900' : ''}`} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Perspective & Primary Action */}
        <div className="flex items-center gap-2">
          {/* User Perspective Pill */}
          {currentMember && (
            <button
              onClick={onOpenPerspective}
              title="切换当前使用者（在自己手机上选自己的名字）"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200/80 text-neutral-800 text-xs font-semibold transition-colors border border-neutral-200/60 shadow-2xs active:scale-95"
            >
              <div
                style={{ backgroundColor: currentMember.avatarColor }}
                className="w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0"
              >
                {currentMember.name.slice(0, 1)}
              </div>
              <span className="truncate max-w-[60px] sm:max-w-[90px]">
                {currentMember.name}
              </span>
              <ChevronDown className="w-3 h-3 text-neutral-400" />
            </button>
          )}

          <button
            onClick={onOpenCreateTrip}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-medium shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">创建旅行</span>
          </button>
        </div>
      </div>
    </header>
  );
};
