// src/components/Settings.jsx
// ─────────────────────────────────────────────────────────────
// Props (from App.jsx):
//   user            – Supabase User object
//   settings        – row from user_settings table
//   updateSettings  – async (patch) => updatedSettings
//   resetData       – async () => void  — clears all savings data
//
// Sections:
//   1. Profile         — email, member since
//   2. Currency        — symbol + code that drive all fmt() calls
//   3. AI Assistant    — Gemini API key management
//   4. Security        — reset password, change email, reset data (accordion)
//   5. Account         — sign out
// ─────────────────────────────────────────────────────────────

import { useState } from 'react';
import {
  User, Globe, KeyRound, ShieldCheck, LogOut,
  CheckCircle2, AlertCircle, Eye, EyeOff,
  Sprout, Trash2, RotateCcw, Mail, ChevronDown,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// ── Currency options ──────────────────────────────────────────
const CURRENCIES = [
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso' },
  { code: 'USD', symbol: '$', label: 'US Dollar'       },
  { code: 'EUR', symbol: '€', label: 'Euro'            },
  { code: 'GBP', symbol: '£', label: 'British Pound'   },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen'    },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee'    },
  { code: 'KRW', symbol: '₩', label: 'Korean Won'      },
];

// ── Helper: format a Supabase ISO timestamp ───────────────────
function formatJoinDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  } catch { return '—'; }
}

// ── Section wrapper ───────────────────────────────────────────
function Section({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-gray-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F0F7EC] flex items-center justify-center shrink-0">
            <Icon size={18} className="text-[#4F7E5B]" />
          </div>
          <div>
            <h2 className="font-serif text-base text-[#1F3D2B] leading-snug">{title}</h2>
            {description && (
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            )}
          </div>
        </div>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ── Inline feedback ───────────────────────────────────────────
function Feedback({ success, error }) {
  if (success) return (
    <div className="alert-success mt-3">
      <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
      <span>{success}</span>
    </div>
  );
  if (error) return (
    <div className="alert-error mt-3">
      <AlertCircle size={13} className="shrink-0 mt-0.5" />
      <span>{error}</span>
    </div>
  );
  return null;
}

// ─────────────────────────────────────────────────────────────
// 1. Profile section
// ─────────────────────────────────────────────────────────────
function ProfileSection({ user }) {
  const joinDate = formatJoinDate(user?.created_at);
  const emailInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <Section
      icon={User}
      title="Profile"
      description="Your account information"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#1F3D2B] flex items-center justify-center text-[#C7E26E] font-serif text-2xl font-semibold shrink-0 select-none">
          {emailInitial}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{user?.email ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Member since {joinDate}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
            <span className="text-xs text-gray-400 font-medium">Active account</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Currency section
// ─────────────────────────────────────────────────────────────
function CurrencySection({ settings, updateSettings }) {
  const current = settings?.currency ?? 'PHP';
  const [selected, setSelected] = useState(current);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState('');
  const [error,    setError]    = useState('');

  const changed = selected !== current;

  async function handleSave() {
    const entry = CURRENCIES.find((c) => c.code === selected);
    if (!entry) return;
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await updateSettings({ currency: entry.code, currency_symbol: entry.symbol });
      setSuccess(`Currency updated to ${entry.label} (${entry.symbol})`);
    } catch (err) {
      setError(err.message || 'Failed to save currency.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      icon={Globe}
      title="Currency"
      description="All amounts are displayed in this currency"
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CURRENCIES.map(({ code, symbol, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => { setSelected(code); setSuccess(''); setError(''); }}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all text-left ${
                selected === code
                  ? 'bg-[#F0F7EC] text-[#1F3D2B] border-[#C7E26E]/60 hover:bg-[#E3F2D7]'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
              }`}
            >
              <span className="font-mono font-bold text-base w-6 shrink-0">{symbol}</span>
              <span className="truncate text-xs">{code}</span>
            </button>
          ))}
        </div>

        {changed && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-[#C7E26E]/40 border-t-[#C7E26E] rounded-full animate-spin" />
                Saving…
              </span>
            ) : 'Save currency preference'}
          </button>
        )}

        <Feedback success={success} error={error} />
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. AI assistant (Gemini API key)
// ─────────────────────────────────────────────────────────────
function AISection({ settings, updateSettings }) {
  const existingKey = settings?.gemini_api_key ?? '';
  const [input,          setInput]          = useState('');
  const [showKey,        setShowKey]        = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [removing,       setRemoving]       = useState(false);
  const [confirmRemove,  setConfirmRemove]  = useState(false);
  const [success,        setSuccess]        = useState('');
  const [error,          setError]          = useState('');

  function reset() { setSuccess(''); setError(''); setConfirmRemove(false); }

  async function handleSave() {
    const key = input.trim();
    if (!key) return;
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await updateSettings({ gemini_api_key: key });
      setInput('');
      setSuccess('API key saved. The AI Assistant is now active.');
    } catch (err) {
      setError(err.message || 'Failed to save API key.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setSuccess('');
    setError('');
    try {
      await updateSettings({ gemini_api_key: null });
      setConfirmRemove(false);
      setSuccess('API key removed. AI Assistant is now disabled.');
    } catch (err) {
      setError(err.message || 'Failed to remove API key.');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Section
      icon={Sprout}
      title="AI Assistant"
      description="Connect Gemini to enable the savings chatbot"
    >
      <div className="space-y-4">
        {/* Status badge */}
        <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl border ${
          existingKey
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-gray-50 border-gray-200 text-gray-500'
        }`}>
          <span className={`w-2 h-2 rounded-full ${existingKey ? 'bg-green-500' : 'bg-gray-300'}`} />
          {existingKey ? 'API key connected — Sprout AI is active' : 'No API key set — AI Assistant is disabled'}
        </div>

        {existingKey ? (
          /* ── Key already set: show remove flow only ── */
          <>
            <p className="text-xs text-gray-400 leading-relaxed">
              Your Gemini API key is active. To use a different key, remove this one first and then paste a new key.
            </p>

            {!confirmRemove ? (
              <button
                type="button"
                onClick={() => { setConfirmRemove(true); setSuccess(''); setError(''); }}
                className="w-full bg-[#1F3D2B] text-[#C7E26E] font-bold text-sm py-2 rounded-xl hover:bg-[#2d5a3f] transition-colors"
              >
                Remove API key
              </button>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    Removing your API key will disable the AI Assistant. You can re-add a key at any time to re-enable it.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={removing}
                    className="flex-1 bg-[#1F3D2B] text-[#C7E26E] font-bold text-sm py-2 rounded-xl hover:bg-[#2d5a3f] disabled:opacity-50 transition-colors"
                  >
                    {removing ? 'Removing…' : 'Yes, remove key'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 bg-white border border-gray-200 text-gray-600 font-semibold text-sm py-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── No key: show paste + save flow ── */
          <>
            <p className="text-xs text-gray-400 leading-relaxed">
              Get a free key from{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[#4F7E5B] underline font-semibold hover:text-[#1F3D2B]"
              >
                aistudio.google.com/apikey
              </a>
              . Your key is stored in your account and is only used to send your financial
              questions to Google's Gemini model.
            </p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); reset(); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  placeholder="Paste your Gemini API key…"
                  className="field-input pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={!input.trim() || saving}
                className="btn-secondary shrink-0"
              >
                {saving ? '…' : 'Save'}
              </button>
            </div>
          </>
        )}

        <Feedback success={success} error={error} />
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────
// Accordion row used inside SecuritySection
// ─────────────────────────────────────────────────────────────
function AccordionRow({ label, hint, open, onToggle, children }) {
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-700">{label}</p>
          {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 py-4 border-t border-gray-100 bg-white">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Security — password, email, reset data
// ─────────────────────────────────────────────────────────────
function SecuritySection({ resetData }) {
  const [openPanel, setOpenPanel] = useState(null); // 'password' | 'email' | 'reset'
  function toggle(panel) { setOpenPanel((p) => (p === panel ? null : panel)); }

  // ── Change password state ──
  const [pwCurrent,  setPwCurrent]  = useState('');
  const [pwNext,     setPwNext]     = useState('');
  const [pwConfirm,  setPwConfirm]  = useState('');
  const [showCur,    setShowCur]    = useState(false);
  const [showNew,    setShowNew]    = useState(false);
  const [pwLoading,  setPwLoading]  = useState(false);
  const [pwSuccess,  setPwSuccess]  = useState('');
  const [pwError,    setPwError]    = useState('');
  const mismatch = pwConfirm.length > 0 && pwConfirm !== pwNext;

  async function handleChangePassword(e) {
    e.preventDefault();
    if (pwNext !== pwConfirm) { setPwError('New passwords do not match.'); return; }
    if (pwNext.length < 8)    { setPwError('New password must be at least 8 characters.'); return; }
    setPwLoading(true); setPwSuccess(''); setPwError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: pwCurrent });
      if (signInErr) throw new Error('Current password is incorrect.');
      const { error: updateErr } = await supabase.auth.updateUser({ password: pwNext });
      if (updateErr) throw updateErr;
      setPwSuccess('Password changed successfully.');
      setPwCurrent(''); setPwNext(''); setPwConfirm('');
    } catch (err) {
      setPwError(err.message || 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  }

  // ── Change email state ──
  const [newEmail,    setNewEmail]    = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState('');
  const [emailError,   setEmailError]   = useState('');

  async function handleChangeEmail(e) {
    e.preventDefault();
    if (!newEmail.trim()) { setEmailError('Enter a new email address.'); return; }
    setEmailLoading(true); setEmailSuccess(''); setEmailError('');
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (updateErr) throw updateErr;
      setEmailSuccess('Confirmation sent to your new address. Click the link in your inbox to confirm the change.');
      setNewEmail('');
    } catch (err) {
      setEmailError(err.message || 'Failed to update email.');
    } finally {
      setEmailLoading(false);
    }
  }

  // ── Reset data state ──
  const [resetStep,  setResetStep]  = useState('idle'); // 'idle' | 'confirm' | 'typing' | 'loading' | 'done'
  const [resetInput, setResetInput] = useState('');
  const [resetError, setResetError] = useState('');
  const RESET_PHRASE = 'lnce masarap';

  async function handleReset() {
    if (resetInput.trim().toLowerCase() !== RESET_PHRASE) {
      setResetError(`Type "${RESET_PHRASE}" exactly to confirm.`);
      return;
    }
    setResetStep('loading'); setResetError('');
    try {
      await resetData?.();
      setResetStep('done'); setResetInput('');
    } catch (err) {
      setResetError(err.message || 'Failed to reset data. Please try again.');
      setResetStep('typing');
    }
  }

  return (
    <Section
      icon={ShieldCheck}
      title="Security"
      description="Manage your password, email, and account data"
    >
      <div className="space-y-2">

        {/* ── Reset password ── */}
        <AccordionRow
          label="Reset password"
          hint="Change your current login password"
          open={openPanel === 'password'}
          onToggle={() => toggle('password')}
        >
          <form onSubmit={handleChangePassword} className="space-y-3" noValidate>
            <div className="space-y-1">
              <label className="field-label">Current password</label>
              <div className="relative">
                <input
                  type={showCur ? 'text' : 'password'}
                  value={pwCurrent}
                  onChange={(e) => { setPwCurrent(e.target.value); setPwError(''); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="field-input pr-10"
                />
                <button type="button" onClick={() => setShowCur((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCur ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="field-label">New password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={pwNext}
                  onChange={(e) => { setPwNext(e.target.value); setPwError(''); }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="field-input pr-10"
                />
                <button type="button" onClick={() => setShowNew((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="field-label">Confirm new password</label>
              <input
                type="password"
                value={pwConfirm}
                onChange={(e) => { setPwConfirm(e.target.value); setPwError(''); }}
                placeholder="Re-enter new password"
                autoComplete="new-password"
                required
                className="field-input"
              />
              {mismatch && (
                <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
                  <AlertCircle size={11} /> Passwords don't match
                </p>
              )}
            </div>
            <Feedback success={pwSuccess} error={pwError} />
            <button type="submit" disabled={pwLoading || mismatch} className="btn-primary">
              {pwLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#C7E26E]/40 border-t-[#C7E26E] rounded-full animate-spin" />
                  Updating…
                </span>
              ) : 'Update password'}
            </button>
          </form>
        </AccordionRow>

        {/* ── Change email ── */}
        <AccordionRow
          label="Change email"
          hint="Update the email address linked to your account"
          open={openPanel === 'email'}
          onToggle={() => toggle('email')}
        >
          <form onSubmit={handleChangeEmail} className="space-y-3" noValidate>
            <div className="space-y-1">
              <label className="field-label">New email address</label>
              <div className="relative">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setEmailError(''); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  name="email"
                  required
                  className="field-input pl-9"
                />
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <p className="text-xs text-gray-400 mt-1">Supabase will send a confirmation link to this address.</p>
            </div>
            <Feedback success={emailSuccess} error={emailError} />
            <button type="submit" disabled={emailLoading || !newEmail.trim()} className="btn-primary">
              {emailLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#C7E26E]/40 border-t-[#C7E26E] rounded-full animate-spin" />
                  Sending confirmation…
                </span>
              ) : 'Update email'}
            </button>
          </form>
        </AccordionRow>

        {/* ── Reset data ── */}
        <AccordionRow
          label="Reset all data"
          hint="Permanently erase all savings goals and history"
          open={openPanel === 'reset'}
          onToggle={() => { toggle('reset'); setResetStep('idle'); setResetInput(''); setResetError(''); }}
        >
          <div className="space-y-3">
            {resetStep === 'idle' && (
              <>
                <p className="text-xs text-gray-500 leading-relaxed">
                  This will permanently delete all your savings goals, transactions, and history.
                  Your account, settings, and API key will remain intact. <span className="font-semibold text-gray-700">This cannot be undone.</span>
                </p>
                <button
                  type="button"
                  onClick={() => setResetStep('confirm')}
                  className="w-full bg-[#1F3D2B] text-[#C7E26E] font-bold text-sm py-2 rounded-xl hover:bg-[#2D5A3F] transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw size={14} /> Reset all data
                </button>
              </>
            )}

            {resetStep === 'confirm' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <Trash2 size={15} className="text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-red-700">Are you sure?</p>
                    <p className="text-xs text-red-500 leading-relaxed">
                      All goals, transactions, and history will be erased permanently.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button"
                    onClick={() => { setResetStep('typing'); setResetInput(''); setResetError(''); }}
                    className="flex-1 bg-[#991B1B] text-white font-bold text-sm py-2 rounded-xl hover:bg-[#B91C1C] transition-colors">
                    I understand, continue
                  </button>
                  <button type="button" onClick={() => setResetStep('idle')}
                    className="flex-1 bg-white border border-gray-200 text-gray-600 font-semibold text-sm py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {resetStep === 'typing' && (
              <div className="space-y-3">
                <p className="text-xs text-red-700 font-medium leading-relaxed">
                  Type <span className="font-mono font-bold bg-red-100 px-1 py-0.5 rounded">{RESET_PHRASE}</span> to confirm:
                </p>
                <input
                  type="text"
                  value={resetInput}
                  onChange={(e) => { setResetInput(e.target.value); setResetError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleReset()}
                  placeholder={RESET_PHRASE}
                  className="field-input text-sm"
                  autoFocus
                />
                {resetError && (
                  <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    <AlertCircle size={11} /> {resetError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={handleReset}
                    disabled={!resetInput.trim()}
                    className="flex-1 bg-[#991B1B] text-white font-bold text-sm py-2 rounded-xl hover:bg-[#B91C1C] disabled:opacity-40 transition-colors">
                    Reset all data
                  </button>
                  <button type="button"
                    onClick={() => { setResetStep('idle'); setResetInput(''); setResetError(''); }}
                    className="flex-1 bg-white border border-gray-200 text-gray-600 font-semibold text-sm py-2 rounded-xl hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {resetStep === 'loading' && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
                <span className="w-4 h-4 border-2 border-gray-300 border-t-[#4F7E5B] rounded-full animate-spin" />
                Resetting your data…
              </div>
            )}

            {resetStep === 'done' && (
              <div className="alert-success">
                <CheckCircle2 size={13} className="shrink-0 mt-0.5" />
                <span>All data has been reset. Your account and settings are unchanged.</span>
              </div>
            )}
          </div>
        </AccordionRow>

      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Account — sign out
// ─────────────────────────────────────────────────────────────
function DangerSection() {
  const [signing,        setSigning]        = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  async function handleSignOut() {
    setSigning(true);
    await supabase.auth.signOut();
  }

  return (
    <Section
      icon={LogOut}
      title="Account"
      description="Sign out of your account"
    >
      <div className="space-y-3">
        {!confirmSignOut ? (
          <button
            onClick={() => setConfirmSignOut(true)}
            className="w-full bg-red-50 text-red-600 border border-red-200 font-bold text-sm py-2.5 rounded-xl hover:bg-red-100 active:bg-red-200 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut size={15} /> Sign out
          </button>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-red-700">
              Are you sure you want to sign out?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleSignOut}
                disabled={signing}
                className="flex-1 bg-[#991B1B] text-white font-bold text-sm py-2 rounded-xl hover:bg-[#B91C1C] disabled:opacity-50 transition-colors"
              >
                {signing ? 'Signing out…' : 'Yes, sign out'}
              </button>
              <button
                onClick={() => setConfirmSignOut(false)}
                className="flex-1 bg-white border border-gray-200 text-gray-600 font-semibold text-sm py-2 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-gray-400 text-center pt-1">
          Your data stays safe in your Supabase account.
        </p>
      </div>
    </Section>
  );
}

// ─────────────────────────────────────────────────────────────
// Root Settings component — exported and used by App.jsx
// Props: { user, settings, updateSettings, resetData }
// ─────────────────────────────────────────────────────────────
export default function Settings({ user, settings, updateSettings, resetData }) {
  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[#1F3D2B] flex items-center justify-center shrink-0">
          <KeyRound size={18} className="text-[#C7E26E]" />
        </div>
        <div>
          <h1 className="font-serif text-2xl text-[#1F3D2B] leading-none">Settings</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage your account and preferences</p>
        </div>
      </div>

      <ProfileSection  user={user} />
      <CurrencySection settings={settings} updateSettings={updateSettings} />
      <AISection       settings={settings} updateSettings={updateSettings} />
      <SecuritySection resetData={resetData} />
      <DangerSection   />

      {/* Version footer */}
      <p className="text-center text-xs text-gray-300 pb-4">
        lnceSaving · Built with React, Supabase & Gemini
      </p>
    </div>
  );
}