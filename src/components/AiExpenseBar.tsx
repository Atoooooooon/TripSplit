import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { isSpeechSupported, createSpeechRecognizer } from '../utils/speech';
import { TripMember } from '../types';

interface AiExpenseBarProps {
  onParse: (text: string, history?: Array<{ role: string; content: string }>) => Promise<any>;
  isLoading: boolean;
  members: TripMember[];
  clarificationState: {
    needed: boolean;
    question?: string;
    options?: string[];
    history: Array<{ role: string; content: string }>;
  } | null;
  onClearClarification: () => void;
}

const SAMPLE_PROMPTS = [
  '晚饭 480 我付 小王没吃 剩下三人AA',
  '打车 76 我和Amy坐的 我付款',
  '早餐 86 小李付的 大家一起吃',
  '便利店 135 我出100 小李出35 四人平摊',
  '昨天酒店 1200 我先垫的 4人平摊',
  '烤肉 86000韩元 我付 大家平摊',
];

export const AiExpenseBar: React.FC<AiExpenseBarProps> = ({
  onParse,
  isLoading,
  members,
  clarificationState,
  onClearClarification,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
            setInputText(prev => (prev ? `${prev} ${text}` : text));
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

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    const history = clarificationState?.history || [];
    await onParse(text, history);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInputText(prompt);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-white via-white/95 to-white/0 pt-6 pb-4 pb-[max(1rem,env(safe-area-inset-bottom))] px-3 sm:px-4 pointer-events-none">
      <div className="max-w-2xl mx-auto space-y-2 pointer-events-auto">
        {/* Continuous Clarification Bubble */}
        {clarificationState?.needed && (
          <div className="bg-neutral-900 text-white p-3.5 rounded-2xl shadow-float border border-neutral-700/80 animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI 智能提示</span>
              </div>
              <button
                onClick={onClearClarification}
                className="text-[11px] text-neutral-400 hover:text-white"
              >
                重置
              </button>
            </div>
            <p className="text-sm font-medium mt-1 text-neutral-100">
              {clarificationState.question}
            </p>

            {/* Quick Answer Buttons */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {(clarificationState.options || members.map(m => m.name)).map(opt => (
                <button
                  key={opt}
                  onClick={() => handleSend(`${opt}付的`)}
                  className="px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium border border-neutral-700 transition-colors"
                >
                  {opt}
                </button>
              ))}
              <button
                onClick={() => handleSend('所有人平摊')}
                className="px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium border border-neutral-700 transition-colors"
              >
                所有人AA
              </button>
            </div>
          </div>
        )}

        {/* Quick Sample Prompts Carousel/Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs text-neutral-500">
          <span className="flex-shrink-0 text-[11px] font-semibold text-neutral-400 px-1">
            快速试用:
          </span>
          {SAMPLE_PROMPTS.map(sample => (
            <button
              key={sample}
              onClick={() => handleQuickPrompt(sample)}
              className="flex-shrink-0 px-2.5 py-1 rounded-full bg-neutral-100/90 hover:bg-neutral-200 text-neutral-700 font-medium text-[11px] border border-neutral-200/50 shadow-2xs transition-all hover:scale-[1.02] active:scale-95"
            >
              {sample}
            </button>
          ))}
        </div>

        {/* AI Input Box */}
        <div className="relative flex items-center bg-white rounded-full shadow-float border border-neutral-200/90 pl-3.5 pr-2 py-1.5 focus-within:ring-2 focus-within:ring-neutral-900 focus-within:border-transparent transition-all">
          <Sparkles className="w-4 h-4 text-emerald-600 mr-2 flex-shrink-0" />

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              clarificationState?.needed
                ? '补充信息，例如：“小王付的，大家AA”'
                : '说说刚刚花了什么……（支持语音输入或打字）'
            }
            className="w-full bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none pr-2"
          />

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Voice Mic Button */}
            <button
              type="button"
              onClick={toggleRecording}
              title={speechAvailable ? '按住或点击语音输入' : '当前浏览器不支持语音输入'}
              className={`p-2 rounded-full transition-all ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100'
              }`}
            >
              {isRecording ? <Mic className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Send Button */}
            <button
              type="button"
              disabled={isLoading || !inputText.trim()}
              onClick={() => handleSend()}
              className="p-2 rounded-full bg-neutral-900 hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-neutral-900 text-white transition-all active:scale-95"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
