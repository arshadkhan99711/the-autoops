import { useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { AlertCircle, CheckCircle2, Lock, Mail, User, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import { BrandLogo } from './BrandLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup' | 'forgot';
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        setNotice('Password reset instructions sent to your email address.');
      } else if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
        await sendEmailVerification(cred.user);
        setNotice('Account created. Please check your inbox to verify your email for cloud persistence.');
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        onClose();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Authentication error.';
      if (raw.includes('auth/operation-not-allowed')) {
        setError(
          'Email/Password sign-in is not yet enabled in Firebase Console (Authentication > Sign-in method). Use Google Sign-In below for immediate verified access, or enable Email/Password in your Firebase Console.'
        );
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0A1022] border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <BrandLogo size={30} className="mt-0.5" />
            <div>
              <h2 className="text-xl font-display font-bold text-white">
                {mode === 'login' && 'Sign in to The Autoops'}
                {mode === 'signup' && 'Create your The Autoops account'}
                {mode === 'forgot' && 'Reset workspace password'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Secure RBAC workspace access, persisted incidents, and encrypted integrations.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close authentication modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Google Auth (Primary Verified Path) */}
        <button
          type="button"
          disabled={loading}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg bg-white text-slate-950 hover:bg-slate-100 text-sm font-semibold transition-colors disabled:opacity-60 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-8.97z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="flex-1 h-px bg-slate-800" />
          <span>or with email</span>
          <div className="flex-1 h-px bg-slate-800" />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800/70 text-xs text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/70 text-xs text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Full Name</span>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#050814] border border-slate-800 focus:border-blue-500 focus:outline-none text-sm text-slate-100"
                />
              </div>
            </label>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-300">Work Email</span>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="engineer@company.com"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#050814] border border-slate-800 focus:border-blue-500 focus:outline-none text-sm text-slate-100"
              />
            </div>
          </label>

          {mode !== 'forgot' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-slate-300">Password</span>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#050814] border border-slate-800 focus:border-blue-500 focus:outline-none text-sm text-slate-100"
                />
              </div>
            </label>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition-all disabled:opacity-60 cursor-pointer"
          >
            {loading
              ? 'Authenticating...'
              : mode === 'login'
              ? 'Sign In'
              : mode === 'signup'
              ? 'Create Account'
              : 'Send Reset Link'}
          </button>
        </form>

        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          {mode !== 'login' ? (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setNotice(null);
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Back to Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setNotice(null);
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Create account
            </button>
          )}

          {mode !== 'forgot' && (
            <button
              type="button"
              onClick={() => {
                setMode('forgot');
                setError(null);
                setNotice(null);
              }}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
