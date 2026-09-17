import React, { useState } from 'react';
import { X, Lock, KeyRound, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { verifyDevPassword } from '../services/api';

interface DevAuthModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const DevAuthModal: React.FC<DevAuthModalProps> = ({ onSuccess, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = password.trim();
    if (!clean || isVerifying) return;

    try {
      setIsVerifying(true);
      setError(false);
      const ok = await verifyDevPassword(clean);
      if (ok) {
        onSuccess();
      } else {
        setError(true);
        setPassword('');
      }
    } catch (err) {
      setError(true);
      setPassword('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-float border border-neutral-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white p-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">开发者配置后台</h3>
              <p className="text-xs text-neutral-300 mt-0.5">请输入开发者管理密码</p>
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
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-700 flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
              <span>管理密码</span>
            </label>
            <input
              type="password"
              autoFocus
              value={password}
              onChange={e => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="输入管理员密码..."
              className={`w-full bg-neutral-50 border rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 ${
                error
                  ? 'border-rose-300 ring-2 ring-rose-200 bg-rose-50/40'
                  : 'border-neutral-200 focus:ring-neutral-900'
              }`}
            />
            {error && (
              <p className="text-xs text-rose-500 flex items-center gap-1 pt-1 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>密码不正确，请重新输入</span>
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={!password.trim() || isVerifying}
              className="w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>验证中...</span>
                </>
              ) : (
                <>
                  <span>进入后台配置</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
