import {
  addMonths,
  differenceInCalendarDays,
  format,
  lastDayOfMonth,
  parseISO,
  setDate,
  startOfDay,
} from 'date-fns';
import type { Card } from '@/types';

function clampDayToMonth(day: number, ref: Date): Date {
  const maxDay = lastDayOfMonth(ref).getDate();
  return setDate(ref, Math.min(day, maxDay));
}

/**
 * Next occurrence of a given day-of-month, on or after `from`.
 * Handles short months (e.g. due day 31 in February → 28/29).
 */
export function nextOccurrence(day: number, from: Date = new Date()): Date {
  const base = startOfDay(from);
  const thisMonth = clampDayToMonth(day, base);
  if (thisMonth >= base) return thisMonth;
  return clampDayToMonth(day, addMonths(base, 1));
}

export function nextDueDate(card: Card, from: Date = new Date()): string {
  return format(nextOccurrence(card.dueDay, from), 'yyyy-MM-dd');
}

/**
 * The due date of the *current* statement cycle — the one the user actually
 * needs to act on. If this month's due day is still ahead, that's it. If it
 * just passed (within a 10-day grace window) and a balance is still owed, we
 * keep showing that date so the item reads as overdue rather than silently
 * rolling to next month. Beyond the window we assume it was paid and roll on.
 */
export function currentDueDate(card: Card, from: Date = new Date()): string {
  const base = startOfDay(from);
  const thisMonthDue = clampDayToMonth(card.dueDay, base);
  if (thisMonthDue >= base) return format(thisMonthDue, 'yyyy-MM-dd');
  const daysPassed = differenceInCalendarDays(base, thisMonthDue);
  if (daysPassed <= 10) return format(thisMonthDue, 'yyyy-MM-dd');
  return format(clampDayToMonth(card.dueDay, addMonths(base, 1)), 'yyyy-MM-dd');
}

export function nextBillingDate(card: Card, from: Date = new Date()): string {
  return format(nextOccurrence(card.billingDay, from), 'yyyy-MM-dd');
}

export function nextStatementDate(card: Card, from: Date = new Date()): string {
  return format(nextOccurrence(card.statementDay, from), 'yyyy-MM-dd');
}

/** Annual fee date for the coming 12 months, if a fee month is set. */
export function nextAnnualFeeDate(card: Card, from: Date = new Date()): string | null {
  if (!card.annualFee || !card.annualFeeMonth) return null;
  const base = startOfDay(from);
  let candidate = new Date(base.getFullYear(), card.annualFeeMonth - 1, 1);
  if (candidate < base) candidate = new Date(base.getFullYear() + 1, card.annualFeeMonth - 1, 1);
  return format(candidate, 'yyyy-MM-dd');
}

export function daysUntil(iso: string, from: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(iso), startOfDay(from));
}

export function isExpiringSoon(card: Card, withinMonths = 3): boolean {
  const expiry = new Date(card.expiryYear, card.expiryMonth, 0); // last day of expiry month
  const cutoff = addMonths(new Date(), withinMonths);
  return expiry <= cutoff;
}

export function isExpired(card: Card): boolean {
  const expiry = new Date(card.expiryYear, card.expiryMonth, 0);
  return expiry < startOfDay(new Date());
}
