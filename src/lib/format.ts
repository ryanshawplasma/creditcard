import {
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
} from 'date-fns';

let CURRENCY = 'INR';
let LOCALE = 'en-IN';

export function configureFormatting(currency: string, locale: string) {
  CURRENCY = currency;
  LOCALE = locale;
}

export function money(amount: number, opts: { compact?: boolean; sign?: boolean } = {}): string {
  const formatter = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: opts.compact ? 1 : amount % 1 === 0 ? 0 : 2,
  });
  const out = formatter.format(Math.abs(amount));
  if (opts.sign && amount !== 0) return `${amount < 0 ? '−' : '+'}${out}`;
  return amount < 0 ? `−${out}` : out;
}

export function number(n: number, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat(LOCALE, {
    notation: opts.compact ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(n);
}

export function percent(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

export function fmtDate(iso: string, pattern = 'dd MMM yyyy'): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, pattern) : '—';
}

export function fmtDay(iso: string): string {
  return fmtDate(iso, 'EEE, dd MMM');
}

export function relativeDays(iso: string): string {
  const d = parseISO(iso);
  if (!isValid(d)) return '—';
  const days = differenceInCalendarDays(d, new Date());
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days < 0) return `${Math.abs(days)} days ago`;
  return `in ${days} days`;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export const NETWORK_META: Record<string, { label: string; gradient: string }> = {
  Visa: { label: 'VISA', gradient: 'from-blue-600 to-indigo-700' },
  Mastercard: { label: 'Mastercard', gradient: 'from-orange-500 to-red-600' },
  RuPay: { label: 'RuPay', gradient: 'from-emerald-600 to-teal-700' },
  Amex: { label: 'AMEX', gradient: 'from-cyan-600 to-blue-800' },
  Discover: { label: 'Discover', gradient: 'from-amber-500 to-orange-600' },
  Diners: { label: 'Diners Club', gradient: 'from-slate-600 to-slate-800' },
};

/** Card art gradients keyed by a stable id so cards keep their look. */
export const CARD_GRADIENTS: Record<string, string> = {
  midnight: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
  aurora: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #db2777 100%)',
  ocean: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 60%, #1e3a8a 100%)',
  forest: 'linear-gradient(135deg, #059669 0%, #047857 55%, #064e3b 100%)',
  ember: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 55%, #b91c1c 100%)',
  rose: 'linear-gradient(135deg, #f43f5e 0%, #be123c 55%, #831843 100%)',
  graphite: 'linear-gradient(135deg, #3f3f46 0%, #27272a 55%, #09090b 100%)',
  gold: 'linear-gradient(135deg, #d4af37 0%, #b8860b 55%, #7a5c00 100%)',
  arctic: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 55%, #475569 100%)',
  plum: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 55%, #4c1d95 100%)',
};

export const CARD_GRADIENT_KEYS = Object.keys(CARD_GRADIENTS);
