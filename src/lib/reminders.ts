import type { Bank, Card, DueItem, Owner, ReminderRule } from '@/types';
import { currentDueDate, daysUntil } from './cycle';

/** Typical minimum-due heuristic: 5% of outstanding, floored at ₹200. */
export function minimumDue(balance: number): number {
  if (balance <= 0) return 0;
  return Math.max(200, Math.round(balance * 0.05));
}

function statusFor(daysUntilDue: number): DueItem['status'] {
  if (daysUntilDue < 0) return 'overdue';
  if (daysUntilDue === 0) return 'today';
  if (daysUntilDue <= 7) return 'soon';
  return 'upcoming';
}

/**
 * Build the list of upcoming payment obligations across all active cards
 * that currently carry a balance. This is the beating heart of the dashboard
 * and reminder engine — everything downstream reads from here.
 */
export function buildDueItems(
  cards: Card[],
  owners: Record<string, Owner>,
  banks: Record<string, Bank>,
  from: Date = new Date(),
): DueItem[] {
  return cards
    .filter((c) => c.status === 'Active' && c.currentBalance > 0)
    .map((card) => {
      const dueDate = currentDueDate(card, from);
      const d = daysUntil(dueDate, from);
      return {
        card,
        owner: owners[card.ownerId],
        bank: banks[card.bankId],
        dueDate,
        amount: card.currentBalance,
        minimumDue: minimumDue(card.currentBalance),
        daysUntil: d,
        status: statusFor(d),
      } satisfies DueItem;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);
}

export function filterDue(items: DueItem[], within: number): DueItem[] {
  return items.filter((i) => i.daysUntil >= 0 && i.daysUntil <= within);
}

export interface ActiveReminder {
  key: string;
  item: DueItem;
  offset: number;
  label: string;
  severity: 'overdue' | 'today' | 'warn' | 'info';
}

/**
 * Given the reminder rule (offsets like 15,10,7,5,3,2,1 days before), return
 * the reminders that are "live" right now for each due item.
 */
export function activeReminders(
  items: DueItem[],
  rule: ReminderRule,
  dismissed: Set<string>,
): ActiveReminder[] {
  const out: ActiveReminder[] = [];
  for (const item of items) {
    const d = item.daysUntil;
    if (d < 0 && rule.includeOverdue) {
      const key = `${item.card.id}:${item.dueDate}:overdue`;
      if (!dismissed.has(key)) {
        out.push({
          key,
          item,
          offset: d,
          label: `Overdue by ${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`,
          severity: 'overdue',
        });
      }
      continue;
    }
    if (d === 0 && rule.includeDueToday) {
      const key = `${item.card.id}:${item.dueDate}:0`;
      if (!dismissed.has(key)) {
        out.push({ key, item, offset: 0, label: 'Due today', severity: 'today' });
      }
      continue;
    }
    // Fire on the largest matching offset that has been reached.
    const reached = rule.offsets.filter((o) => o >= d).sort((a, b) => a - b)[0];
    if (reached !== undefined && d > 0) {
      const key = `${item.card.id}:${item.dueDate}:${reached}`;
      if (!dismissed.has(key)) {
        out.push({
          key,
          item,
          offset: reached,
          label: `Due in ${d} day${d === 1 ? '' : 's'}`,
          severity: d <= 3 ? 'warn' : 'info',
        });
      }
    }
  }
  return out.sort((a, b) => a.item.daysUntil - b.item.daysUntil);
}

/** Fire a native desktop notification (requires user permission). */
export async function notify(title: string, body: string) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/vault.svg' });
  } else if (Notification.permission !== 'denied') {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') new Notification(title, { body });
  }
}
