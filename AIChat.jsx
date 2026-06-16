// src/components/AIChat.jsx
// ─────────────────────────────────────────────────────────────
// Streaming AI chatbot powered by Gemini 2.5 Flash.
// Conversation history is kept in local state — it is NOT
// persisted to Supabase (intentional: keeps costs down and
// avoids storing potentially sensitive chat data).
//
// Key design decisions:
//   • Uses streamGemini() so replies appear word-by-word
//   • Maintains Gemini-compatible history format [{role, parts}]
//   • API key is sourced from user_settings (editable here)
//   • Financial context is rebuilt on every send (always fresh)
// ─────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from 'react';
import { Send, Sprout, User, Settings, Eye, EyeOff, Trash2 } from 'lucide-react';
import { streamGemini, buildFinancialContext, GeminiError } from '../services/geminiService';

// Suggested prompts shown in empty state
const SUGGESTIONS = [
  "What's my current balance?",
  "How much have I saved this month?",
  "Am I on track with any of my goals?",
  "Which category am I spending the most on?",
  "Give me a tip to save more next month.",
];

// ─────────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────────
function Bubble({ role, text, streaming }) {
  const isUser = role === 'user';
  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? 'bg-[#1F3D2B]' : 'bg-[#C7E26E]'}`}>
        {isUser
          ? <User size={15} className="text-white" />
          : <Sprout size={15} className="text-[#1F3D2B]" />
        }
      </div>

      {/* Bubble */}
      <div
        className={`
          max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-[#1F3D2B] text-white rounded-br-sm'
            : 'bg-white border border-gray-100 text-gray-800 shadow-sm rounded-bl-sm'
          }
          ${streaming ? 'animate-pulse' : ''}
        `}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {text}
        {streaming && <span className="ml-1 inline-block w-1.5 h-4 bg-[#C7E26E] rounded-sm animate-pulse align-middle" />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

/**
 * @param {{
 *   balance: number, totalDeposited: number, totalWithdrawn: number,
 *   monthNet: number, goals: Array, transactions: Array,
 *   settings: object|null, currencySymbol: string,
 *   updateSettings: Function
 * }} props
 */
export default function AIChat({
  balance, totalDeposited, totalWithdrawn, monthNet,
  goals, transactions, settings, currencySymbol = '₱', updateSettings,
}) {
  // ── Conversation state ──
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: "Hi! I'm Sprout, your savings assistant 🌱 Ask me anything about your finances.",
      id:   'init',
    }
  ]);
  const [streamingText, setStreamingText] = useState('');  // text being streamed in
  const [isStreaming,   setIsStreaming]   = useState(false);
  const [input,         setInput]        = useState('');
  const [chatError,     setChatError]    = useState('');

  // ── Settings panel ──
  const [showSettings, setShowSettings] = useState(false);
  const [keyInput,     setKeyInput]     = useState('');
  const [showKey,      setShowKey]      = useState(false);
  const [savingKey,    setSavingKey]    = useState(false);

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);
  const abortRef   = useRef(null);  // to cancel streams on unmount

  const apiKey = settings?.gemini_api_key ?? '';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // ── Build Gemini-format history (exclude init message) ──
  function buildHistory() {
    return messages
      .filter((m) => m.id !== 'init')
      .map((m) => ({
        role:  m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));
  }

  // ── Send message ──
  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    if (!apiKey) { setShowSettings(true); return; }

    const userMsg = { role: 'user', text, id: Date.now().toString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setChatError('');
    setIsStreaming(true);
    setStreamingText('');

    const context = buildFinancialContext({
      balance, totalDeposited, totalWithdrawn, monthNet,
      currencySymbol, goals,
      recentTx: [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    });

    let full = '';
    let cancelled = false;
    abortRef.current = () => { cancelled = true; };

    try {
      const stream = streamGemini(apiKey, text, context, buildHistory());

      for await (const chunk of stream) {
        if (cancelled) break;
        full += chunk;
        setStreamingText(full);
      }
    } catch (err) {
      if (!cancelled) {
        const msg = err instanceof GeminiError
          ? err.message
          : 'Something went wrong. Check your API key or try again.';
        setChatError(msg);
      }
    } finally {
      if (!cancelled && full) {
        setMessages((prev) => [...prev, { role: 'assistant', text: full, id: Date.now().toString() }]);
        setStreamingText('');
      }
      setIsStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  // Cancel stream on unmount
  useEffect(() => () => abortRef.current?.(), []);

  // ── Save API key ──
  async function handleSaveKey() {
    if (!keyInput.trim()) return;
    setSavingKey(true);
    try {
      await updateSettings({ gemini_api_key: keyInput.trim() });
      setKeyInput('');
      setShowSettings(false);
    } catch (err) {
      setChatError(err.message);
    } finally {
      setSavingKey(false);
    }
  }

  function handleClear() {
    setMessages([{ role: 'assistant', text: "Conversation cleared. Ask me anything!", id: 'cleared' }]);
    setStreamingText('');
    setChatError('');
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-h-[780px] space-y-3">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#C7E26E] flex items-center justify-center">
            <Sprout size={16} className="text-[#1F3D2B]" />
          </div>
          <div>
            <p className="font-serif font-semibold text-[#1F3D2B] leading-none">Sprout AI</p>
            <p className="text-xs text-gray-400">powered by Gemini 2.5 Flash</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleClear}
            title="Clear conversation"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`p-2 rounded-xl transition-all ${showSettings ? 'bg-[#C7E26E] text-[#1F3D2B]' : 'text-gray-400 hover:bg-gray-100'}`}
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
          <p className="text-sm font-semibold text-gray-700">Gemini API Key</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            Get a free key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-green-700 underline font-semibold">
              aistudio.google.com/apikey
            </a>
            . Your key is saved in your account settings.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder={apiKey ? '•••••• (key saved)' : 'Paste your key here'}
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                className="w-full pr-9 pl-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C7E26E]"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <button
              onClick={handleSaveKey}
              disabled={!keyInput.trim() || savingKey}
              className="bg-[#1F3D2B] text-[#C7E26E] px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
            >
              {savingKey ? 'Saving…' : 'Save'}
            </button>
          </div>
          {apiKey && <p className="text-xs text-green-700 font-semibold">✓ API key active</p>}
        </div>
      )}

      {/* ── Message list ── */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} text={m.text} />
        ))}

        {/* Streaming bubble */}
        {isStreaming && (
          <Bubble
            role="assistant"
            text={streamingText || '…'}
            streaming={!streamingText}
          />
        )}

        {/* Error */}
        {chatError && (
          <div className="text-xs text-red-500 font-semibold bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            {chatError}
          </div>
        )}

        {/* Suggestions (empty-ish state) */}
        {messages.length <= 1 && !isStreaming && (
          <div className="flex flex-wrap gap-2 mt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); inputRef.current?.focus(); }}
                className="text-xs text-green-800 bg-green-50 border border-green-100 px-3 py-1.5 rounded-full hover:bg-green-100 transition-colors font-medium"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ── */}
      <form onSubmit={handleSend} className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-sm">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={apiKey ? 'Ask about your balance, goals, or spending…' : 'Add a Gemini API key in settings to chat →'}
          disabled={isStreaming}
          className="flex-1 text-sm bg-transparent focus:outline-none placeholder:text-gray-400 disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isStreaming || !apiKey}
          className="w-9 h-9 bg-[#1F3D2B] text-[#C7E26E] rounded-xl flex items-center justify-center disabled:opacity-30 transition-opacity shrink-0"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
