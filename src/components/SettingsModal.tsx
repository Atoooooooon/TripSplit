import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../services/api';
import { DEFAULT_EXCHANGE_RATES, CURRENCY_NAMES } from '../types';
import { X, Key, Sparkles, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  onKeyUpdated: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onKeyUpdated }) => {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [model, setModel] = useState('deepseek-chat');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    getSettings()
      .then(res => {
        setHasKey(res.hasDeepSeekKey);
        setMaskedKey(res.maskedKey || '');
      })
      .catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await saveSettings({ deepseekApiKey: apiKey.trim() });
      setSaveSuccess(true);
      setHasKey(true);
      setMaskedKey(apiKey ? `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}` : '');
      setApiKey('');
      onKeyUpdated();
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestKey = async () => {
    setTestStatus('testing');
    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '打车 20 元 我付',
          customApiKey: apiKey.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestStatus('success');
      } else {
        setTestStatus('error');
      }
    } catch (e) {
      setTestStatus('error');
    }
    setTimeout(() => setTestStatus(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-base text-neutral-900">AI 与系统设置</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* DeepSeek Key Section */}
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-neutral-700 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-neutral-400" />
                  <span>DeepSeek API Key</span>
                </label>
                {hasKey && (
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-semibold">
                    已配置 ({maskedKey})
                  </span>
                )}
              </div>

              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={hasKey ? '输入新 Key 以覆盖更新...' : 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
              />
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Key 仅存储在您的服务器本地 SQLite 数据库中。若未配置，系统会自动无缝切换至内置的超高速本地 NLP 启发式解析引擎。
              </p>
            </div>

            {/* Model select */}
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                AI 模型选择
              </label>
              <select
                value={model}
                onChange={e => setModel(e.target.value)}
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="deepseek-chat">deepseek-chat (通用快速对话 - 推荐)</option>
                <option value="deepseek-reasoner">deepseek-reasoner (深度思考模型)</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleTestKey}
                disabled={testStatus === 'testing'}
                className="text-xs font-medium text-neutral-600 hover:text-neutral-900 flex items-center gap-1"
              >
                {testStatus === 'testing' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : testStatus === 'success' ? (
                  <span className="text-emerald-600 font-bold">✓ 连接成功</span>
                ) : testStatus === 'error' ? (
                  <span className="text-red-500 font-bold">✕ 连接失败</span>
                ) : (
                  <span>测试连接</span>
                )}
              </button>

              <button
                type="submit"
                disabled={isSaving || (!apiKey.trim() && !hasKey)}
                className="px-4 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs font-semibold shadow-2xs transition-all active:scale-95"
              >
                {saveSuccess ? '已保存！' : isSaving ? '保存中...' : '保存 Key'}
              </button>
            </div>
          </form>

          {/* Currency reference table */}
          <div className="space-y-2 pt-2 border-t border-neutral-100">
            <h4 className="text-xs font-semibold text-neutral-700">预设基准汇率参考 (相对 1 人民币)</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(DEFAULT_EXCHANGE_RATES).map(([curr, rate]) => (
                <div
                  key={curr}
                  className="bg-neutral-50 p-2 rounded-xl border border-neutral-100 flex items-center justify-between"
                >
                  <span className="font-medium text-neutral-600">{curr}</span>
                  <span className="font-mono text-neutral-800">1 CNY ≈ {rate} {curr}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-neutral-400">
              * 记账时汇率会作为账单一部分固化，日后支持单笔手动修改。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
