import React, { useState, useEffect, useRef } from 'react';
import { Currency, CURRENCY_NAMES } from '../types';
import { X, Plus, Sparkles, Mic, MicOff, RefreshCw, KeyRound, Compass, User } from 'lucide-react';
import { parseTripFromNaturalLanguage } from '../services/api';
import { isSpeechSupported, createSpeechRecognizer } from '../utils/speech';

interface CreateTripModalProps {
  onClose: () => void;
  onCreate: (tripData: {
    name: string;
    destination: string;
    startDate: string;
    endDate: string;
    settlementCurrency: Currency;
    creatorName?: string;
    members: Array<{ name: string; isCurrentUser: boolean }>;
  }) => Promise<void>;
}

const SAMPLE_TRIP_PROMPTS = [
  '阿伟和老王、小李三个人国庆去成都玩5天',
  'Amy和Bob下周去东京4天，用日元',
  '一家三口去三亚度假3天',
];

export const CreateTripModal: React.FC<CreateTripModalProps> = ({ onClose, onCreate }) => {
  // AI / Speech Input State
  const [aiInput, setAiInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [creatorName, setCreatorName] = useState(() => {
    const cached = localStorage.getItem('tripsplit_user_name') || '';
    return ['我', '自己', '本人', 'me', 'i'].includes(cached.toLowerCase()) ? '' : cached;
  });
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  });
  const [settlementCurrency, setSettlementCurrency] = useState<Currency>('CNY');
  const [members, setMembers] = useState<string[]>(['小王', '小李']);
  const [newMember, setNewMember] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSpeechAvailable(isSpeechSupported());
  }, []);

  const toggleRecording = () => {
    if (!speechAvailable) {
      alert('您的浏览器当前暂不支持语音识别或未授予麦克风权限，请使用键盘输入。');
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        const recognizer = createSpeechRecognizer(
          text => {
            setAiInput(prev => (prev ? `${prev} ${text}` : text));
            setIsRecording(false);
          },
          err => {
            console.warn('Speech error:', err);
            setIsRecording(false);
          },
          () => {
            setIsRecording(false);
          }
        );
        recognitionRef.current = recognizer;
        recognizer?.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Failed to start speech recognition', e);
        setIsRecording(false);
      }
    }
  };

  const handleAiParse = async (textToParse?: string) => {
    const text = (textToParse || aiInput).trim();
    if (!text || isAiParsing) return;

    try {
      setIsAiParsing(true);
      const draft = await parseTripFromNaturalLanguage(text);

      if (draft.name) setName(draft.name);
      if (draft.destination) setDestination(draft.destination);
      if (draft.creatorName && !['我', '自己', '本人', 'me', 'i'].includes(draft.creatorName.trim().toLowerCase())) {
        setCreatorName(draft.creatorName.trim());
      }
      if (draft.settlementCurrency) setSettlementCurrency(draft.settlementCurrency);
      if (draft.startDate) setStartDate(draft.startDate);
      if (draft.endDate) setEndDate(draft.endDate);
      if (draft.members && draft.members.length > 0) {
        setMembers(draft.members.filter(m => !['我', '自己', '本人', 'me', 'i'].includes(m.trim().toLowerCase())));
      }
    } catch (err: any) {
      alert(`AI 解析失败: ${err.message}`);
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleAddMember = () => {
    const trimmed = newMember.trim();
    if (!trimmed) return;
    if (['我', '自己', '本人', 'me', 'i'].includes(trimmed.toLowerCase())) {
      alert('成员名字不能使用“' + trimmed + '”，请填写具体名字或昵称。');
      return;
    }
    if (trimmed !== creatorName && !members.includes(trimmed)) {
      setMembers([...members, trimmed]);
      setNewMember('');
    }
  };

  const handleRemoveMember = (idx: number) => {
    setMembers(members.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !destination.trim() || isSubmitting) return;

    const trimmedCreator = creatorName.trim();
    if (!trimmedCreator) {
      alert('请填写你的名字或昵称（发起人），方便其他同行好友识别。');
      return;
    }
    if (['我', '自己', '本人', 'me', 'i'].includes(trimmedCreator.toLowerCase())) {
      alert('不能使用“' + trimmedCreator + '”作为名字！\n其他人进入房间后会不知道“我”是谁。请填写具体的名字或昵称（如：小张、Amy）。');
      return;
    }

    try {
      setIsSubmitting(true);
      localStorage.setItem('tripsplit_user_name', trimmedCreator);

      const memberObjects = [
        { name: trimmedCreator, isCurrentUser: true },
        ...members.filter(m => m !== trimmedCreator).map(m => ({ name: m, isCurrentUser: false })),
      ];

      await onCreate({
        name: name.trim(),
        destination: destination.trim(),
        startDate,
        endDate,
        settlementCurrency,
        creatorName: trimmedCreator,
        members: memberObjects,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-float border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-neutral-900" />
            <div>
              <h3 className="font-bold text-base text-neutral-900 leading-tight">创建新旅行</h3>
              <p className="text-[11px] text-neutral-400">支持语音 / AI 自动识别并生成 6 位专属口令</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* AI / Voice Assistant Bar */}
          <div className="bg-neutral-900 text-white p-3.5 rounded-2xl shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 语音 / 智能一键生成</span>
              </div>
              <span className="text-[10px] text-neutral-400">说出或粘贴计划即可</span>
            </div>

            <div className="flex items-center gap-1.5 bg-neutral-800/90 rounded-xl p-1.5 border border-neutral-700">
              {speechAvailable && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  title={isRecording ? '点击结束语音' : '点击开始语音输入'}
                  className={`p-2 rounded-lg transition-all ${
                    isRecording
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                  }`}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              <input
                type="text"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAiParse();
                  }
                }}
                placeholder={isRecording ? '正在倾听中...' : '试着输入：我和老王、小李国庆去成都玩5天'}
                className="flex-1 bg-transparent text-xs text-white placeholder:text-neutral-500 focus:outline-none px-2 py-1"
              />

              <button
                type="button"
                disabled={isAiParsing || !aiInput.trim()}
                onClick={() => handleAiParse()}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-neutral-950 text-xs font-bold transition-colors flex items-center gap-1"
              >
                {isAiParsing ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>解析中</span>
                  </>
                ) : (
                  <span>智能识别</span>
                )}
              </button>
            </div>

            {/* Quick Prompts */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {SAMPLE_TRIP_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setAiInput(prompt);
                    handleAiParse(prompt);
                  }}
                  className="text-[10px] px-2 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          {/* Form */}
          <form id="create-trip-form" onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1">旅行名称</label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="例如：2026 成都国庆逛吃之旅"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">目的地</label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  placeholder="例如：成都"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">结算基准币种</label>
                <select
                  value={settlementCurrency}
                  onChange={e => setSettlementCurrency(e.target.value as Currency)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                >
                  {Object.entries(CURRENCY_NAMES).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">出发日期</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">返回日期</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900"
                />
              </div>
            </div>

            {/* Creator name & Automatic Code Security */}
            <div className="p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/80 space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-neutral-500" />
                    <span>你的名字 / 昵称（发起人，必填）</span>
                  </span>
                  <span className="text-[10px] text-red-500 font-medium">* 严禁填写“我”</span>
                </label>
                <input
                  type="text"
                  required
                  value={creatorName}
                  onChange={e => setCreatorName(e.target.value)}
                  placeholder="例如：小张、Amy、阿伟（请勿填写“我”）"
                  className={`w-full bg-white border rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 ${
                    ['我', '自己', '本人', 'me', 'i'].includes(creatorName.trim().toLowerCase())
                      ? 'border-red-400 focus:ring-red-400 ring-1 ring-red-400/20'
                      : 'border-neutral-300 focus:ring-neutral-900'
                  }`}
                />
                {['我', '自己', '本人', 'me', 'i'].includes(creatorName.trim().toLowerCase()) ? (
                  <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                    <span>⚠️ 不能填写“{creatorName.trim()}”，好友进群后无法识别谁是“我”，请填写具体名字或昵称。</span>
                  </p>
                ) : (
                  <p className="text-[10px] text-neutral-400 mt-1">
                    用于好友进群后认出你是谁，请使用大家平时称呼你的名字。
                  </p>
                )}
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 leading-relaxed">
                <span className="text-sm">🔒</span>
                <div>
                  <strong>系统自动生成专属口令：</strong>
                  <span className="text-emerald-700"> 为防止口令冲突，系统将自动生成 6 位唯一口令。创建后把口令或链接发给朋友，大家就能一起记账。</span>
                </div>
              </div>
            </div>

            {/* Members */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-600">同行成员</label>
              <div className="flex flex-wrap gap-1.5 items-center">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                    creatorName.trim() && !['我', '自己', '本人', 'me', 'i'].includes(creatorName.trim().toLowerCase())
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 border border-amber-300'
                  }`}
                >
                  <span>
                    {creatorName.trim() && !['我', '自己', '本人', 'me', 'i'].includes(creatorName.trim().toLowerCase())
                      ? `${creatorName.trim()} (发起人)`
                      : '（待填发起人名字）'}
                  </span>
                </span>
                {members.map((m, idx) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800 border border-neutral-200/60"
                  >
                    <span>{m}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(idx)}
                      className="text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newMember}
                  onChange={e => setNewMember(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddMember();
                    }
                  }}
                  placeholder="添加同行好友名字..."
                  className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-medium"
                >
                  + 添加
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-neutral-500 hover:text-neutral-800 px-4 py-2 rounded-xl hover:bg-neutral-200/50 transition-colors"
          >
            取消
          </button>
          <button
            form="create-trip-form"
            type="submit"
            disabled={isSubmitting || !name.trim() || !destination.trim()}
            className="px-5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all active:scale-95"
          >
            {isSubmitting ? '正在创建...' : '立即创建旅行'}
          </button>
        </div>
      </div>
    </div>
  );
};

