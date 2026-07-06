import Dexie, { type Table } from 'dexie';
import type {
  AppUser,
  AuditLog,
  Bank,
  Card,
  DismissedReminder,
  DocumentFile,
  EMIPlan,
  Owner,
  Payment,
  Settings,
  Transaction,
} from '@/types';
import { nowISO, uid } from './utils';

/**
 * Local-first persistence via IndexedDB (Dexie).
 *
 * Everything lives on the user's machine — nothing is transmitted anywhere.
 * Sensitive card fields are stored encrypted (see lib/crypto). This is the
 * "offline-first" foundation; a sync backend can be layered on later without
 * changing the schema.
 */
export class CreditVaultDB extends Dexie {
  users!: Table<AppUser, string>;
  owners!: Table<Owner, string>;
  banks!: Table<Bank, string>;
  cards!: Table<Card, string>;
  payments!: Table<Payment, string>;
  transactions!: Table<Transaction, string>;
  emis!: Table<EMIPlan, string>;
  documents!: Table<DocumentFile, string>;
  reminders!: Table<DismissedReminder, string>;
  audit!: Table<AuditLog, string>;
  settings!: Table<Settings, string>;

  constructor() {
    super('creditvault-ai');
    this.version(1).stores({
      users: 'id, username, email',
      owners: 'id, name, relationship, favorite',
      banks: 'id, name',
      cards: 'id, ownerId, bankId, status, last4, pinned',
      payments: 'id, cardId, date, paidById',
      transactions: 'id, cardId, date, category, merchant',
      emis: 'id, cardId',
      documents: 'id, cardId, ownerId, kind',
      reminders: 'id, cardId, dueDate',
      audit: 'id, at, entity',
      settings: 'id',
    });
  }
}

export const db = new CreditVaultDB();

export async function logAudit(action: string, entity: string, entityId?: string, detail?: string) {
  await db.audit.add({
    id: uid('log_'),
    action,
    entity,
    entityId,
    detail,
    at: nowISO(),
  });
  // Keep the audit trail bounded (most recent 500 entries).
  const count = await db.audit.count();
  if (count > 500) {
    const oldest = await db.audit.orderBy('at').limit(count - 500).primaryKeys();
    await db.audit.bulkDelete(oldest);
  }
}

/** Recompute a card's outstanding balance from transactions − payments. */
export async function recomputeCardBalance(cardId: string): Promise<number> {
  const [txns, pays, card] = await Promise.all([
    db.transactions.where('cardId').equals(cardId).toArray(),
    db.payments.where('cardId').equals(cardId).toArray(),
    db.cards.get(cardId),
  ]);
  if (!card) return 0;
  const spent = txns.reduce((s, t) => s + t.amount, 0);
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, Math.round((card.baselineBalance ?? 0) + spent - paid));
  await db.cards.update(cardId, { currentBalance: balance, updatedAt: nowISO() });
  return balance;
}
