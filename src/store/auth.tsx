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
  deriveMasterKey,
  hashPassword,
  randomSalt,
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
  }) => Promise<void>;
  login: (identifier: string, password: string, remember: boolean) => Promise<void>;
  lock: () => void;
  logout: () => Promise<void>;
  rememberedIdentifier: string | null;
  registerActivity: () => void;
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
  const [rememberedIdentifier, setRemembered] = useState<string | null>(
    () => localStorage.getItem(REMEMBER_KEY),
  );
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutMin = useRef<number>(DEFAULT_SETTINGS.sessionTimeoutMin);

  // Detect existing account on boot.
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
    const keySalt = randomSalt();
    const pwHash = await hashPassword(input.password, pwSalt);
    const newUser: AppUser = {
      id: 'user_primary',
      username: input.username.trim(),
      email: input.email.trim(),
      displayName: input.displayName.trim(),
      pwHash,
      pwSalt,
      keySalt,
      createdAt: nowISO(),
    };
    const key = await deriveMasterKey(input.password, keySalt);
    await db.users.add(newUser);
    await db.settings.put(DEFAULT_SETTINGS);
    try {
      await seedDatabase(key, newUser.displayName, newUser.email);
    } catch (e) {
      // Roll back so a failed seed never leaves a half-created vault.
      await db.users.delete(newUser.id);
      throw e;
    }
    await logAudit('account.create', 'user', newUser.id);
    setUser(newUser);
    setMasterKey(key);
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

    const key = await deriveMasterKey(password, account.keySalt);
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
    setMasterKey(key);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await logAudit('logout', 'session');
    setMasterKey(null);
    setStatus('locked');
  }, []);

  // Idle auto-lock wiring.
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
      lock,
      logout,
      rememberedIdentifier,
      registerActivity,
    }),
    [status, user, masterKey, register, login, lock, logout, rememberedIdentifier, registerActivity],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
