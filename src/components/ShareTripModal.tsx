import React, { useState } from 'react';
import { Trip } from '../types';
import { X, Check, Copy, Share2, Sparkles, MessageSquare, ArrowRight, Smartphone } from 'lucide-react';
import { copyText, getTripInviteText, getTripShareUrl } from '../utils/clipboard';

interface ShareTripModalProps {
  trip: Trip;
  isNewlyCreated?: boolean;
  onClose: () => void;
}

export const ShareTripModal: React.FC<ShareTripModalProps> = ({
  trip,
  isNewlyCreated = false,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const inviteText = getTripInviteText(trip.name, trip.accessCode);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleCopyInviteText = async () => {
    const success = await copyText(inviteText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      alert('复制失败，请长按下方文案手动复制');
    }
  };

  const handleCopyCodeOnly = async () => {
    const success = await copyText(trip.accessCode.trim().toUpperCase());
    if (success) {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `TripSplit - ${trip.name}`,
          text: `✈️ 邀请你加入「${trip.name}」旅行记账！口令：${trip.accessCode.trim().toUpperCase()}`,
          url: getTripShareUrl(trip.accessCode),
        });
      } catch (e) {
        // If user cancelled, do nothing
      }
    } else {
      handleCopyInviteText();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh] pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom-6 duration-200">
        {/* Mobile Pull Handle Indicator */}
        <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mt-2.5 mb-1 sm:hidden" />

        {/* Header */}
        <div className="px-5 pt-3 sm:pt-5 pb-4 border-b border-neutral-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-neutral-800 flex items-center justify-center flex-shrink-0">
              {isNewlyCreated ? (
                <Sparkles className="w-5 h-5 text-amber-500" />
              ) : (
                <Share2 className="w-5 h-5 text-neutral-800" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-neutral-900">
                  {isNewlyCreated ? '旅行房间创建成功' : '邀请好友加入房间'}
                </h3>
                {isNewlyCreated && (
                  <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                    新房间
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                「{trip.name}」· {trip.destination}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto">
          {/* Quick Access Code Card */}
          <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80">
            <div>
              <span className="text-[11px] font-medium text-neutral-500 block">房间邀请口令</span>
              <div className="font-mono text-lg sm:text-xl font-extrabold tracking-wider text-neutral-900 mt-0.5">
                {trip.accessCode.trim().toUpperCase()}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCopyCodeOnly}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 shadow-2xs ${
                copiedCode
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-200'
              }`}
            >
              {copiedCode ? '已复制口令 ✓' : '单独复制口令'}
            </button>
          </div>

          {/* Invitation Message Card */}
          <div className="bg-neutral-50 p-3.5 sm:p-4 rounded-2xl border border-neutral-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-neutral-600" />
                <span>微信 / 群聊邀请文案</span>
              </label>
              {copied && (
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> 已复制
                </span>
              )}
            </div>

            <div className="bg-white p-3 rounded-xl border border-neutral-200 text-xs text-neutral-700 font-mono whitespace-pre-line leading-relaxed select-all">
              {inviteText}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyInviteText}
                className={`w-full py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-98 ${
                  copied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '已复制！快发微信吧' : '一键复制分享文案'}</span>
              </button>

              {canNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="w-full py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-all active:scale-98 shadow-2xs"
                >
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>调起手机系统分享</span>
                </button>
              )}
            </div>
          </div>

          <div className="p-3 bg-neutral-100/70 rounded-xl text-[11px] text-neutral-600 leading-relaxed flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>朋友在微信点击链接即可直达该房间，并选择自己的名字参与记账与实时结算。</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <span>{isNewlyCreated ? '开始记账' : '完成'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
