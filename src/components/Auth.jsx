// src/components/Auth.jsx
import { useState } from 'react';
import { Sprout, Eye, EyeOff, Leaf, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

function getPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '', color: '' };
  let score = 0;
  if (pw.length >= 8)             score++;
  if (pw.length >= 12)            score++;
  if (/[A-Z]/.test(pw))          score++;
  if (/[0-9]/.test(pw))          score++;
  if (/[^A-Za-z0-9]/.test(pw))   score++;
  const levels = [
    { label: '',          color: '' },
    { label: 'Weak',      color: 'bg-red-400'    },
    { label: 'Fair',      color: 'bg-yellow-400' },
    { label: 'Good',      color: 'bg-lime-400'   },
    { label: 'Strong',    color: 'bg-green-500'  },
    { label: 'Very strong', color: 'bg-green-700' },
  ];
  return { score, ...levels[score] };
}

function PasswordInput({ value, onChange, placeholder = 'Password', id, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete ?? 'current-password'}
        required
        minLength={6}
        className="field-input pr-10 w-full p-2.5 border border-gray-200 rounded-xl"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function LogoMark() {
  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div className="w-14 h-14 rounded-2xl bg-[#1F3D2B] flex items-center justify-center shadow-md">
        <Sprout size={28} className="text-[#C7E26E]" />
      </div>
      <div className="text-center">
        <h1 className="font-serif text-2xl text-[#1F3D2B] leading-none font-bold">Sprout</h1>
        <p className="text-xs text-gray-400 mt-0.5 font-medium">Watch your savings grow</p>
      </div>
    </div>
  );
}

function ModeTabs({ mode, setMode }) {
  return (
    <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
      {[
        { value: 'login',  label: 'Sign in'  },
        { value: 'signup', label: 'Sign up'  },
      ].map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => setMode(value)}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
            mode === value
              ? 'bg-white text-[#1F3D2B] shadow-sm'
              : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function LoginForm({ onForgot }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault(); // Prevents standard HTML page reload loops
    setError('');
    setLoading(true);
    
    try {
      console.log("📬 Sending authentication payload to client instance...");
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      console.log("🎉 Session assigned successfully in LoginForm context.");
    } catch (err) {
      console.error("❌ Sign in transaction error details:", err);
      const msg = err.message ?? '';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError('Email or password is incorrect. Please try again.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Please verify your email address before signing in.');
      } else {
        setError(msg || 'Sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="login-email" className="field-label block text-xs font-semibold text-gray-500 uppercase tracking-wider">Email address</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="field-input w-full p-2.5 border border-gray-200 rounded-xl"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="login-password" className="field-label block text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
          <button
            type="button"
            onClick={onForgot}
            className="text-xs text-[#4F7E5B] hover:text-[#1F3D2B] font-semibold transition-colors"
          >
            Forgot password?
          </button>
        </div>
        <PasswordInput
          id="login-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="alert-error p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-2.5 bg-[#1F3D2B] text-white rounded-xl font-bold transition-all hover:bg-[#152a1e] disabled:opacity-50">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Signing in…
          </span>
        ) : 'Sign in'}
      </button>
    </form>
  );
}

function SignupForm() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [done,     setDone]     = useState(false);

  const strength = getPasswordStrength(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (strength.score < 2)   { setError('Please choose a stronger password.'); return; }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      setDone(true);
    } catch (err) {
      const msg = err.message ?? '';
      if (msg.toLowerCase().includes('already registered')) {
        setError('An account with this email already exists. Try signing in instead.');
      } else {
        setError(msg || 'Sign-up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4 py-2">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <CheckCircle2 size={28} className="text-green-600" />
        </div>
        <div>
          <p className="font-serif text-lg text-[#1F3D2B] font-bold">Check your inbox</p>
          <p className="text-sm text-gray-500 mt-1">
            We sent a confirmation link to <span className="font-semibold text-gray-700">{email}</span>.
            Click it to activate your account, then return here to sign in.
          </p>
        </div>
        <p className="text-xs text-gray-400">Didn't receive it? Check your spam folder.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="signup-email" className="field-label block text-xs font-semibold text-gray-500 uppercase tracking-wider">Email address</label>
        <input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setError(''); }}
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="field-input w-full p-2.5 border border-gray-200 rounded-xl"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="signup-password" className="field-label block text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
        <PasswordInput
          id="signup-password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          placeholder="At least 8 characters"
          autoComplete="new-password"
        />
        {password.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    i <= strength.score ? strength.color : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
            {strength.label && (
              <p className="text-xs text-gray-400 font-medium">{strength.label}</p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="signup-confirm" className="field-label block text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirm password</label>
        <PasswordInput
          id="signup-confirm"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(''); }}
          placeholder="Re-enter password"
          autoComplete="new-password"
        />
        {mismatch && (
          <p className="text-xs text-red-500 font-semibold mt-1 flex items-center gap-1">
            <AlertCircle size={11} /> Passwords don't match
          </p>
        )}
      </div>

      {error && (
        <div className="alert-error p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || mismatch}
        className="btn-primary mt-2 w-full py-2.5 bg-[#1F3D2B] text-white rounded-xl font-bold transition-all hover:bg-[#152a1e] disabled:opacity-50"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Creating account…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Leaf size={15} /> Create account
          </span>
        )}
      </button>
    </form>
  );
}

function ForgotPasswordForm({ onBack }) {
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (authError) throw authError;
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-[#1F3D2B] font-semibold transition-colors"
      >
        <ArrowLeft size={14} /> Back to sign in
      </button>

      <div>
        <h2 className="font-serif text-lg text-[#1F3D2B] font-bold">Reset your password</h2>
        <p className="text-sm text-gray-400 mt-1">
          Enter your email and we'll send you a link to create a new password.
        </p>
      </div>

      {sent ? (
        <div className="alert-success p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-800 flex gap-2">
          <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
          <span>
            Reset link sent to <strong>{email}</strong>. Check your inbox (and spam folder).
          </span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="forgot-email" className="field-label block text-xs font-semibold text-gray-500 uppercase tracking-wider">Email address</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="field-input w-full p-2.5 border border-gray-200 rounded-xl"
            />
          </div>

          {error && (
            <div className="alert-error p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 flex gap-2">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 bg-[#1F3D2B] text-white rounded-xl font-bold transition-all hover:bg-[#152a1e]">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Sending…
              </span>
            ) : 'Send reset link'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState('login');

  return (
    <div className="min-h-screen bg-[#F5F8F0] flex items-center justify-center p-4">
      <div aria-hidden="true" className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#C7E26E]/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#4F7E5B]/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 space-y-6">
          <LogoMark />

          {mode === 'forgot' ? (
            <ForgotPasswordForm onBack={() => setMode('login')} />
          ) : (
            <>
              <ModeTabs mode={mode} setMode={setMode} />
              {mode === 'login'  && <LoginForm  onForgot={() => setMode('forgot')} />}
              {mode === 'signup' && <SignupForm />}
            </>
          )}

          {mode !== 'forgot' && (
            <p className="text-center text-xs text-gray-400 leading-relaxed">
              Your data is private and stored securely.
              <br />No ads. No data selling. Ever.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}