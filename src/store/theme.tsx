import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'dark' | 'light';

export interface Accent {
  key: string;
  label: string;
  /** "r g b" triplets for CSS variables. */
  accent: string;
  soft: string;
  fg: string;
  swatch: string;
}

export const ACCENTS: Accent[] = [
  { key: 'indigo', label: 'Indigo', accent: '99 102 241', soft: '129 140 248', fg: '255 255 255', swatch: '#6366f1' },
  { key: 'violet', label: 'Violet', accent: '139 92 246', soft: '167 139 250', fg: '255 255 255', swatch: '#8b5cf6' },
  { key: 'blue', label: 'Blue', accent: '59 130 246', soft: '96 165 250', fg: '255 255 255', swatch: '#3b82f6' },
  { key: 'emerald', label: 'Emerald', accent: '16 185 129', soft: '52 211 153', fg: '255 255 255', swatch: '#10b981' },
  { key: 'rose', label: 'Rose', accent: '244 63 94', soft: '251 113 133', fg: '255 255 255', swatch: '#f43f5e' },
  { key: 'amber', label: 'Amber', accent: '245 158 11', soft: '251 191 36', fg: '30 20 0', swatch: '#f59e0b' },
  { key: 'cyan', label: 'Cyan', accent: '6 182 212', soft: '34 211 238', fg: '8 20 24', swatch: '#06b6d4' },
  { key: 'fuchsia', label: 'Fuchsia', accent: '217 70 239', soft: '232 121 249', fg: '255 255 255', swatch: '#d946ef' },
];

interface ThemeCtx {
  theme: ThemeMode;
  accent: string;
  toggleTheme: () => void;
  setTheme: (t: ThemeMode) => void;
  setAccent: (key: string) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

const THEME_KEY = 'cv.theme';
const ACCENT_KEY = 'cv.accent';

function applyAccent(key: string) {
  const a = ACCENTS.find((x) => x.key === key) ?? ACCENTS[0];
  const root = document.documentElement;
  root.style.setProperty('--accent', a.accent);
  root.style.setProperty('--accent-soft', a.soft);
  root.style.setProperty('--accent-fg', a.fg);
}

function applyTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.classList.toggle('light', mode === 'light');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(
    () => (localStorage.getItem(THEME_KEY) as ThemeMode) ?? 'dark',
  );
  const [accent, setAccentState] = useState<string>(
    () => localStorage.getItem(ACCENT_KEY) ?? 'indigo',
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    applyAccent(accent);
    localStorage.setItem(ACCENT_KEY, accent);
  }, [accent]);

  const setTheme = useCallback((t: ThemeMode) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')),
    [],
  );
  const setAccent = useCallback((key: string) => setAccentState(key), []);

  const value = useMemo(
    () => ({ theme, accent, toggleTheme, setTheme, setAccent }),
    [theme, accent, toggleTheme, setTheme, setAccent],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
