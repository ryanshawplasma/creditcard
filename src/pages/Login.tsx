import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Vault, Eye, EyeOff, ShieldCheck, Fingerprint, Lock, Mail, User, ArrowRight, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/store/theme';
import { useToast } from '@/components/ui/Toast';
import { Button, Field, Input, Switch } from '@/components/ui/primitives';
import { db } from '@/lib/db';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'register' | 'forgot';

function strength(pw: string): { score: number; label: string; tone: string } {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const label = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'][s];
  const tone = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-warning', 'bg-success', 'bg-success'][s];
  return { score: s, label, tone };
}

export function Login() {
  const { status, register, login, rememberedIdentifier } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();

  const [mode, setMode] = useState<Mode>(status === 'onboarding' ? 'register' : 'login');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [identifier, setIdentifier] = useState(rememberedIdentifier ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [remember, setRemember] = useState(!!rememberedIdentifier);
  const [error, setError] = useState('');

  const pwStrength = useMemo(() => strength(password), [password]);

  async function handleRegister() {
    setError('');
    if (!displayName.trim() || !username.trim() || !email.trim()) return setError('Please fill in all fields.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Master password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await register({ displayName, username, email, password });
      toast.success('Welcome to CreditVault AI', 'Your encrypted vault is ready.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    setError('');
    if (!identifier.trim() || !password) return setError('Enter your username/email and password.');
    setBusy(true);
    try {
      await login(identifier, password, remember);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!confirm.trim()) {
      setError('Type RESET to confirm.');
      return;
    }
    if (confirm.trim().toUpperCase() !== 'RESET') return setError('Type RESET exactly to confirm.');
    await db.delete();
    location.reload();
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-bg">
      {/* Animated aurora + grid background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="aurora" />
        <div className="absolute inset-0 grid-noise opacity-40" />
        <motion.div
          className="absolute left-1/4 top-1/3 h-64 w-64 rounded-full bg-accent/20 blur-3xl"
          animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <button onClick={toggleTheme} className="absolute right-5 top-5 z-20 flex h-10 w-10 items-center justify-center rounded-xl glass text-muted hover:text-fg transition focus-ring">
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="relative z-10 grid w-full max-w-5xl grid-cols-1 items-center gap-10 px-6 lg:grid-cols-2">
        {/* Brand / value panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:block"
        >
          <div className="mb-6 inline-flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-glow">
              <Vault size={22} />
            </div>
            <span className="text-xl font-bold tracking-tight">CreditVault<span className="text-accent"> AI</span></span>
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-gradient">
            Every card, every due date,<br />in one calm place.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
            Track cards across your whole household, never miss a payment, and see exactly who owes what —
            all encrypted and stored locally on your device.
          </p>
          <div className="mt-8 space-y-3">
            {[
              { icon: ShieldCheck, text: 'AES-256 encryption — card numbers never stored in plaintext' },
              { icon: Fingerprint, text: 'Zero-knowledge: your master password never leaves this device' },
              { icon: Lock, text: 'Offline-first — works with no internet, no cloud required' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3 text-sm text-muted">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 text-accent">
                  <f.icon size={16} />
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Auth card */}
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md justify-self-center rounded-3xl glass-strong p-7 shadow-lift lg:justify-self-end"
        >
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-fg">
              <Vault size={20} />
            </div>
            <span className="text-lg font-bold">CreditVault AI</span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={mode} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              {mode === 'register' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Create your vault</h2>
                    <p className="mt-1 text-sm text-muted">Set a master password — it encrypts everything and cannot be recovered.</p>
                  </div>
                  <Field label="Full name">
                    <div className="relative">
                      <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                      <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ryan Shaw" className="pl-9" />
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Username">
                      <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ryan" />
                    </Field>
                    <Field label="Email">
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
                    </Field>
                  </div>
                  <Field label="Master password">
                    <PasswordInput value={password} onChange={setPassword} show={showPw} setShow={setShowPw} placeholder="At least 8 characters" />
                  </Field>
                  {password && (
                    <div className="space-y-1.5">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors', i < pwStrength.score ? pwStrength.tone : 'bg-surface-2')} />
                        ))}
                      </div>
                      <p className="text-xs text-subtle">Strength: {pwStrength.label}</p>
                    </div>
                  )}
                  <Field label="Confirm password">
                    <Input type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Re-enter password" />
                  </Field>
                  {error && <ErrorLine text={error} />}
                  <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={handleRegister}>
                    Create secure vault <ArrowRight size={16} />
                  </Button>
                </div>
              )}

              {mode === 'login' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Welcome back</h2>
                    <p className="mt-1 text-sm text-muted">Unlock your vault to continue.</p>
                  </div>
                  <Field label="Username or email">
                    <div className="relative">
                      <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                      <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="ryan or you@email.com" className="pl-9" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
                    </div>
                  </Field>
                  <Field label="Master password">
                    <PasswordInput value={password} onChange={setPassword} show={showPw} setShow={setShowPw} placeholder="Your master password" onEnter={handleLogin} />
                  </Field>
                  <div className="flex items-center justify-between">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                      <Switch checked={remember} onChange={setRemember} /> Remember me
                    </label>
                    <button onClick={() => { setMode('forgot'); setError(''); }} className="text-sm text-accent hover:underline">Forgot password?</button>
                  </div>
                  {error && <ErrorLine text={error} />}
                  <Button variant="primary" size="lg" className="w-full" loading={busy} onClick={handleLogin}>
                    Unlock vault <ArrowRight size={16} />
                  </Button>
                </div>
              )}

              {mode === 'forgot' && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Password recovery</h2>
                    <p className="mt-1 text-sm text-muted">
                      Your vault uses zero-knowledge encryption — there’s no master password on any server, so it
                      genuinely cannot be recovered. You can reset and start fresh (this erases all local data).
                    </p>
                  </div>
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                    Resetting permanently deletes every card, person and payment stored on this device.
                  </div>
                  <Field label="Type RESET to confirm">
                    <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESET" />
                  </Field>
                  {error && <ErrorLine text={error} />}
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => { setMode('login'); setError(''); setConfirm(''); }}>Back</Button>
                    <Button variant="danger" className="flex-1" onClick={handleReset}>Reset vault</Button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {mode !== 'forgot' && status !== 'onboarding' && (
            <p className="mt-6 text-center text-sm text-muted">
              {mode === 'login' ? "Don't have a vault?" : 'Already have a vault?'}{' '}
              <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }} className="font-medium text-accent hover:underline">
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, show, setShow, placeholder, onEnter }: { value: string; onChange: (v: string) => void; show: boolean; setShow: (v: boolean) => void; placeholder?: string; onEnter?: () => void }) {
  return (
    <div className="relative">
      <Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
      <Input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-10"
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-subtle hover:text-fg">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {text}
    </motion.p>
  );
}
