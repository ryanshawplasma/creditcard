/**
 * Repository layer — the single write path for the app. Every mutation goes
 * through here so audit logging, balance recomputation and encryption stay
 * consistent. UI never touches Dexie tables for writes directly.
 */
import type {
  Bank,
  Card,
  DocumentFile,
  EMIPlan,
  Owner,
  Payment,
  Settings,
  Transaction,
} from '@/types';
import { db, logAudit, recomputeCardBalance } from './db';
import { encryptField } from './crypto';
import { nowISO, uid } from './utils';

// ── Owners ───────────────────────────────────────────────
export async function saveOwner(owner: Partial<Owner> & { name: string; relationship: Owner['relationship']; color: string }) {
  const ts = nowISO();
  if (owner.id) {
    await db.owners.update(owner.id, { ...owner, updatedAt: ts });
    await logAudit('owner.update', 'owner', owner.id, owner.name);
    return owner.id;
  }
  const id = uid('own_');
  await db.owners.add({ ...owner, id, createdAt: ts, updatedAt: ts } as Owner);
  await logAudit('owner.create', 'owner', id, owner.name);
  return id;
}

export async function deleteOwner(id: string) {
  const cards = await db.cards.where('ownerId').equals(id).count();
  if (cards > 0) throw new Error('Reassign or delete this person’s cards first.');
  await db.owners.delete(id);
  await logAudit('owner.delete', 'owner', id);
}

// ── Banks ────────────────────────────────────────────────
export async function saveBank(bank: Partial<Bank> & { name: string; color: string }) {
  if (bank.id) {
    await db.banks.update(bank.id, bank);
    return bank.id;
  }
  const id = uid('bank_');
  await db.banks.add({ ...bank, id } as Bank);
  await logAudit('bank.create', 'bank', id, bank.name);
  return id;
}

// ── Cards ────────────────────────────────────────────────
export interface CardInput extends Omit<Card, 'id' | 'createdAt' | 'updatedAt' | 'secure' | 'currentBalance' | 'baselineBalance'> {
  id?: string;
  openingBalance?: number; // outstanding at time of entry
  fullCardNumber?: string; // plaintext, encrypted here — never persisted raw
  cvv?: string;
  secureNotes?: string;
}

export async function saveCard(input: CardInput, masterKey: CryptoKey | null) {
  const ts = nowISO();
  const { id, openingBalance, fullCardNumber, cvv, secureNotes, ...rest } = input;

  // Encrypt sensitive fields if provided and a key is available.
  const secure: Card['secure'] = {};
  if (masterKey) {
    if (fullCardNumber && fullCardNumber.replace(/\D/g, '').length >= 12)
      secure.cardNumber = await encryptField(masterKey, fullCardNumber.replace(/\s/g, ''));
    if (cvv) secure.cvv = await encryptField(masterKey, cvv);
    if (secureNotes) secure.secureNotes = await encryptField(masterKey, secureNotes);
  }

  if (id) {
    const existing = await db.cards.get(id);
    const mergedSecure = { ...existing?.secure, ...secure };
    await db.cards.update(id, {
      ...rest,
      secure: mergedSecure,
      baselineBalance: openingBalance ?? existing?.baselineBalance ?? 0,
      updatedAt: ts,
    });
    await recomputeCardBalance(id);
    await logAudit('card.update', 'card', id, rest.name);
    return id;
  }

  const newId = uid('card_');
  const baseline = openingBalance ?? 0;
  await db.cards.add({
    ...rest,
    id: newId,
    secure: Object.keys(secure).length ? secure : undefined,
    baselineBalance: baseline,
    currentBalance: baseline,
    createdAt: ts,
    updatedAt: ts,
  } as Card);
  await recomputeCardBalance(newId);
  await logAudit('card.create', 'card', newId, rest.name);
  return newId;
}

export async function deleteCard(id: string) {
  await db.transaction('rw', [db.cards, db.payments, db.transactions, db.emis, db.documents], async () => {
    await db.payments.where('cardId').equals(id).delete();
    await db.transactions.where('cardId').equals(id).delete();
    await db.emis.where('cardId').equals(id).delete();
    await db.documents.where('cardId').equals(id).delete();
    await db.cards.delete(id);
  });
  await logAudit('card.delete', 'card', id);
}

export async function togglePin(id: string, pinned: boolean) {
  await db.cards.update(id, { pinned, updatedAt: nowISO() });
}

export async function setCardStatus(id: string, status: Card['status']) {
  await db.cards.update(id, { status, updatedAt: nowISO() });
  await logAudit('card.status', 'card', id, status);
}

// ── Payments ─────────────────────────────────────────────
export async function recordPayment(payment: Omit<Payment, 'id' | 'createdAt'>) {
  const id = uid('pay_');
  await db.payments.add({ ...payment, id, createdAt: nowISO() });
  await recomputeCardBalance(payment.cardId);
  await logAudit('payment.record', 'payment', id, `${payment.amount} on ${payment.cardId}`);
  return id;
}

export async function deletePayment(id: string) {
  const p = await db.payments.get(id);
  await db.payments.delete(id);
  if (p) await recomputeCardBalance(p.cardId);
  await logAudit('payment.delete', 'payment', id);
}

// ── Transactions ─────────────────────────────────────────
export async function addTransaction(txn: Omit<Transaction, 'id' | 'createdAt'>) {
  const id = uid('txn_');
  await db.transactions.add({ ...txn, id, createdAt: nowISO() });
  await recomputeCardBalance(txn.cardId);
  await logAudit('txn.add', 'transaction', id);
  return id;
}

export async function deleteTransaction(id: string) {
  const t = await db.transactions.get(id);
  await db.transactions.delete(id);
  if (t) await recomputeCardBalance(t.cardId);
}

// ── EMIs ─────────────────────────────────────────────────
export async function saveEMI(emi: Omit<EMIPlan, 'id' | 'createdAt'> & { id?: string }) {
  if (emi.id) {
    await db.emis.update(emi.id, emi);
    return emi.id;
  }
  const id = uid('emi_');
  await db.emis.add({ ...emi, id, createdAt: nowISO() } as EMIPlan);
  await logAudit('emi.create', 'emi', id, emi.description);
  return id;
}

export async function deleteEMI(id: string) {
  await db.emis.delete(id);
}

// ── Documents ────────────────────────────────────────────
export async function addDocument(doc: Omit<DocumentFile, 'id' | 'createdAt'>) {
  const id = uid('doc_');
  await db.documents.add({ ...doc, id, createdAt: nowISO() });
  await logAudit('document.add', 'document', id, doc.name);
  return id;
}

export async function deleteDocument(id: string) {
  await db.documents.delete(id);
  await logAudit('document.delete', 'document', id);
}

// ── Settings ─────────────────────────────────────────────
export async function saveSettings(patch: Partial<Settings>) {
  const current = await db.settings.get('app');
  await db.settings.put({ ...(current as Settings), ...patch, id: 'app' });
  await logAudit('settings.update', 'settings');
}

export async function dismissReminder(cardId: string, dueDate: string, offset: number, key: string) {
  await db.reminders.put({
    id: key,
    cardId,
    dueDate,
    offset,
    dismissedAt: nowISO(),
  });
}

// ── Backup / Restore ─────────────────────────────────────
export async function exportBackup(): Promise<string> {
  const [users, owners, banks, cards, payments, transactions, emis, documents, settings, audit] =
    await Promise.all([
      db.users.toArray(),
      db.owners.toArray(),
      db.banks.toArray(),
      db.cards.toArray(),
      db.payments.toArray(),
      db.transactions.toArray(),
      db.emis.toArray(),
      db.documents.toArray(),
      db.settings.toArray(),
      db.audit.toArray(),
    ]);
  // Card numbers remain encrypted inside `secure` — backups are safe to store.
  return JSON.stringify(
    { version: 1, exportedAt: nowISO(), users, owners, banks, cards, payments, transactions, emis, documents, settings, audit },
    null,
    2,
  );
}

export async function importBackup(json: string) {
  const data = JSON.parse(json);
  await db.transaction(
    'rw',
    [db.users, db.owners, db.banks, db.cards, db.payments, db.transactions, db.emis, db.documents, db.settings, db.audit],
    async () => {
      if (data.owners) await db.owners.bulkPut(data.owners);
      if (data.banks) await db.banks.bulkPut(data.banks);
      if (data.cards) await db.cards.bulkPut(data.cards);
      if (data.payments) await db.payments.bulkPut(data.payments);
      if (data.transactions) await db.transactions.bulkPut(data.transactions);
      if (data.emis) await db.emis.bulkPut(data.emis);
      if (data.documents) await db.documents.bulkPut(data.documents);
      if (data.settings) await db.settings.bulkPut(data.settings);
    },
  );
  await logAudit('backup.import', 'system');
}
