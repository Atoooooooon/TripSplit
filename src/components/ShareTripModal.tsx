import React, { useState } from 'react';
import { Trip } from '../types';
import { X, Check, Copy, Share2, Sparkles, MessageSquare, ArrowRight } from 'lucide-react';
import { copyText, getTripInviteText } from '../utils/clipboard';

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

  const inviteText = getTripInviteText(trip.name, trip.accessCode);

  const handleCopyInviteText = async () => {
    const success = await copyText(inviteText);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      alert('复制失败，请长按下方文案手动复制');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400">
              {isNewlyCreated ? <Sparkles className="w-6 h-6" /> : <Share2 className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg">
                  {isNewlyCreated ? '旅行创建成功！' : '邀请朋友加入'}
                </h3>
                {isNewlyCreated && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                    新房间
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                「{trip.name}」· {trip.destination}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded-full hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <p className="text-xs text-neutral-600 leading-relaxed">
            复制下方分享文案发到微信群，好友<strong>点击链接即可直接进入房间</strong>，无需手动输口令：
          </p>

          {/* Invitation Message Card */}
          <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>群聊 / 微信邀请文案</span>
              </label>
              {copied && (
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 animate-in fade-in">
                  <Check className="w-3.5 h-3.5" /> 已复制到剪贴板
                </span>
              )}
            </div>

            <div className="bg-white p-3 rounded-xl border border-neutral-200 text-xs text-neutral-700 font-mono whitespace-pre-line leading-relaxed select-all">
              {inviteText}
            </div>

            <button
              type="button"
              onClick={handleCopyInviteText}
              className={`w-full py-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 ${
                copied
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-400'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '已复制！快发给朋友吧' : '一键复制分享文案'}</span>
            </button>
          </div>

          <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100/80 text-[11px] text-emerald-800 leading-relaxed flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>朋友在手机上点开链接，选一下自己的名字，大家就能一起记账并自动抵消结账。</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <span>{isNewlyCreated ? '开始记账' : '关闭'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
