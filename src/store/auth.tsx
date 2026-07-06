import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppUser, Settings } from '@/types';
import { db, logAudit } from '@/lib/db';
import {
  constantTimeEqual,
  deriveKEK,
  generateDataKey,
  generateRecoveryKey,
  hashPassword,
  normalizeRecoveryKey,
  randomSalt,
  unwrapKey,
  wrapKey,
} from '@/lib/crypto';
import { seedDatabase } from '@/lib/seed';
import { nowISO } from '@/lib/utils';

type AuthStatus = 'loading' | 'onboarding' | 'locked' | 'authenticated';

interface AuthCtx {
  status: AuthStatus;
  user: AppUser | null;
  masterKey: CryptoKey | null;
  register: (input: {
    displayName: string;
    username: string;
    email: string;
    password: string;
    hint?: string;
    seedDemo?: boolean;
  }) => Promise<void>;
  login: (identifier: string, password: string, remember: boolean) => Promise<void>;
  recoverWithKey: (recoveryKey: string, newPassword: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  regenerateRecoveryKey: (currentPassword: string) => Promise<string>;
  setPasswordHint: (hint: string) => Promise<void>;
  lock: () => void;
  logout: () => Promise<void>;
  rememberedIdentifier: string | null;
  registerActivity: () => void;
  /** Set once, right after sign-up, so the app can show the recovery key. */
  pendingRecoveryKey: string | null;
  clearPendingRecoveryKey: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);
const REMEMBER_KEY = 'cv.remember';

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'dark',
  accent: 'indigo',
  currency: 'INR',
  locale: 'en-IN',
  sessionTimeoutMin: 15,
  reminder: {
    id: 'default',
    offsets: [15, 10, 7, 5, 3, 2, 1],
    timeOfDay: ['Morning', 'Evening'],
    channels: ['Desktop'],
    includeDueToday: true,
    includeOverdue: true,
  },
  telegram: { enabled: false },
  email: { enabled: false, address: undefined },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AppUser | null>(null);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(null);
  const [rememberedIdentifier, setRemembered] = useState<string | null>(
    () => localStorage.getItem(REMEMBER_KEY),
  );
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMin = useRef<number>(DEFAULT_SETTINGS.sessionTimeoutMin);

  useEffect(() => {
    (async () => {
      const existing = await db.users.toCollection().first();
      if (existing) {
        setUser(existing);
        setStatus('locked');
      } else {
        setStatus('onboarding');
      }
    })();
  }, []);

  const lock = useCallback(() => {
    setMasterKey(null);
    setStatus((s) => (s === 'authenticated' ? 'locked' : s));
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  const registerActivity = useCallback(() => {
    if (status !== 'authenticated') return;
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      logAudit('session.autolock', 'session');
      lock();
    }, timeoutMin.current * 60_000);
  }, [status, lock]);

  const register = useCallback<AuthCtx['register']>(async (input) => {
    const pwSalt = randomSalt();
    const recoverySalt = randomSalt();
    const recoveryKey = generateRecoveryKey();
    const recoveryNorm = normalizeRecoveryKey(recoveryKey);

    const [pwHash, recoveryVerifier, dek] = await Promise.all([
      hashPassword(input.password, pwSalt),
      hashPassword(recoveryNorm, recoverySalt),
      generateDataKey(),
    ]);
    const [kekPw, kekRec] = await Promise.all([
      deriveKEK(input.password, pwSalt),
      deriveKEK(recoveryNorm, recoverySalt),
    ]);
    const [wrappedDEKPw, wrappedDEKRec] = await Promise.all([wrapKey(kekPw, dek), wrapKey(kekRec, dek)]);

    const newUser: AppUser = {
      id: 'user_primary',
      username: input.username.trim(),
      email: input.email.trim(),
      displayName: input.displayName.trim(),
      pwHash,
      pwSalt,
      wrappedDEKPw,
      recoveryVerifier,
      recoverySalt,
      wrappedDEKRec,
      hint: input.hint?.trim() || undefined,
      createdAt: nowISO(),
    };

    await db.users.add(newUser);
    await db.settings.put(DEFAULT_SETTINGS);
    try {
      await seedDatabase(dek, newUser.displayName, newUser.email, input.seedDemo ?? true);
    } catch (e) {
      await db.users.delete(newUser.id);
      throw e;
    }
    await logAudit('account.create', 'user', newUser.id);
    setUser(newUser);
    setMasterKey(dek);
    setPendingRecoveryKey(recoveryKey);
    timeoutMin.current = DEFAULT_SETTINGS.sessionTimeoutMin;
    setStatus('authenticated');
  }, []);

  const login = useCallback<AuthCtx['login']>(async (identifier, password, remember) => {
    const id = identifier.trim().toLowerCase();
    const account =
      (await db.users.where('username').equalsIgnoreCase(id).first()) ??
      (await db.users.where('email').equalsIgnoreCase(id).first()) ??
      (await db.users.toCollection().first());
    if (!account) throw new Error('No account found. Please create one.');

    const candidate = await hashPassword(password, account.pwSalt);
    if (!constantTimeEqual(candidate, account.pwHash)) {
      await logAudit('login.failed', 'user', account.id);
      throw new Error('Incorrect password. Please try again.');
    }

    // Vaults created before the envelope-encryption upgrade lack the wrapped
    // data key — they can't be opened by the new scheme. Guide the user to reset.
    if (!account.wrappedDEKPw) {
      throw new Error(
        'This vault was created before a security upgrade. Please use “Forgot password → Lost your key? Reset vault” to start fresh.',
      );
    }

    const kekPw = await deriveKEK(password, account.pwSalt);
    const dek = await unwrapKey(kekPw, account.wrappedDEKPw);

    const settings = await db.settings.get('app');
    timeoutMin.current = settings?.sessionTimeoutMin ?? DEFAULT_SETTINGS.sessionTimeoutMin;

    if (remember) {
      localStorage.setItem(REMEMBER_KEY, account.username);
      setRemembered(account.username);
    } else {
      localStorage.removeItem(REMEMBER_KEY);
      setRemembered(null);
    }

    await logAudit('login.success', 'user', account.id);
    setUser(account);
    setMasterKey(dek);
    setStatus('authenticated');
  }, []);

  const recoverWithKey = useCallback<AuthCtx['recoverWithKey']>(async (recoveryKey, newPassword) => {
    const account = await db.users.toCollection().first();
    if (!account) throw new Error('No account found.');

    const norm = normalizeRecoveryKey(recoveryKey);
    const candidate = await hashPassword(norm, account.recoverySalt);
    if (!constantTimeEqual(candidate, account.recoveryVerifier)) {
      await logAudit('password.recover.failed', 'user', account.id);
      throw new Error('That recovery key is not valid.');
    }

    const kekRec = await deriveKEK(norm, account.recoverySalt);
    const dek = await unwrapKey(kekRec, account.wrappedDEKRec);

    // Set a new password by re-wrapping the same data key.
    const newPwSalt = randomSalt();
    const newPwHash = await hashPassword(newPassword, newPwSalt);
    const kekPw = await deriveKEK(newPassword, newPwSalt);
    const wrappedDEKPw = await wrapKey(kekPw, dek);
    await db.users.update(account.id, { pwSalt: newPwSalt, pwHash: newPwHash, wrappedDEKPw });

    await logAudit('password.recover', 'user', account.id);
    setUser({ ...account, pwSalt: newPwSalt, pwHash: newPwHash, wrappedDEKPw });
    setMasterKey(dek);
    setStatus('authenticated');
  }, []);

  const currentAccount = useCallback(async (): Promise<AppUser> => {
    const account = (user && (await db.users.get(user.id))) ?? (await db.users.toCollection().first());
    if (!account) throw new Error('No account found.');
    return account;
  }, [user]);

  const changePassword = useCallback<AuthCtx['changePassword']>(async (currentPassword, newPassword) => {
    const account = await currentAccount();
    const candidate = await hashPassword(currentPassword, account.pwSalt);
    if (!constantTimeEqual(candidate, account.pwHash)) {
      throw new Error('Your current password is incorrect.');
    }
    const kekOld = await deriveKEK(currentPassword, account.pwSalt);
    const dek = await unwrapKey(kekOld, account.wrappedDEKPw);

    const newPwSalt = randomSalt();
    const newPwHash = await hashPassword(newPassword, newPwSalt);
    const kekNew = await deriveKEK(newPassword, newPwSalt);
    const wrappedDEKPw = await wrapKey(kekNew, dek);
    await db.users.update(account.id, { pwSalt: newPwSalt, pwHash: newPwHash, wrappedDEKPw });

    await logAudit('password.change', 'user', account.id);
    setUser({ ...account, pwSalt: newPwSalt, pwHash: newPwHash, wrappedDEKPw });
  }, [currentAccount]);

  const regenerateRecoveryKey = useCallback<AuthCtx['regenerateRecoveryKey']>(async (currentPassword) => {
    const account = await currentAccount();
    const candidate = await hashPassword(currentPassword, account.pwSalt);
    if (!constantTimeEqual(candidate, account.pwHash)) {
      throw new Error('Your current password is incorrect.');
    }
    const kekPw = await deriveKEK(currentPassword, account.pwSalt);
    const dek = await unwrapKey(kekPw, account.wrappedDEKPw);

    const recoveryKey = generateRecoveryKey();
    const norm = normalizeRecoveryKey(recoveryKey);
    const recoverySalt = randomSalt();
    const recoveryVerifier = await hashPassword(norm, recoverySalt);
    const kekRec = await deriveKEK(norm, recoverySalt);
    const wrappedDEKRec = await wrapKey(kekRec, dek);
    await db.users.update(account.id, { recoverySalt, recoveryVerifier, wrappedDEKRec });

    await logAudit('recovery.regenerate', 'user', account.id);
    setUser({ ...account, recoverySalt, recoveryVerifier, wrappedDEKRec });
    return recoveryKey;
  }, [currentAccount]);

  const setPasswordHint = useCallback<AuthCtx['setPasswordHint']>(async (hint) => {
    const account = await currentAccount();
    const clean = hint.trim() || undefined;
    await db.users.update(account.id, { hint: clean });
    setUser({ ...account, hint: clean });
  }, [currentAccount]);

  const logout = useCallback(async () => {
    await logAudit('logout', 'session');
    setMasterKey(null);
    setStatus('locked');
  }, []);

  const clearPendingRecoveryKey = useCallback(() => setPendingRecoveryKey(null), []);

  useEffect(() => {
    if (status !== 'authenticated') return;
    registerActivity();
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    const handler = () => registerActivity();
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [status, registerActivity]);

  const value = useMemo(
    () => ({
      status,
      user,
      masterKey,
      register,
      login,
      recoverWithKey,
      changePassword,
      regenerateRecoveryKey,
      setPasswordHint,
      lock,
      logout,
      rememberedIdentifier,
      registerActivity,
      pendingRecoveryKey,
      clearPendingRecoveryKey,
    }),
    [status, user, masterKey, register, login, recoverWithKey, changePassword, regenerateRecoveryKey, setPasswordHint, lock, logout, rememberedIdentifier, registerActivity, pendingRecoveryKey, clearPendingRecoveryKey],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
