import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type {
  AuditLog,
  Bank,
  Card,
  DocumentFile,
  DueItem,
  EMIPlan,
  Owner,
  Payment,
  Settings,
  Transaction,
} from '@/types';
import { db } from '@/lib/db';
import { buildDueItems } from '@/lib/reminders';
import { configureFormatting } from '@/lib/format';
import { DEFAULT_SETTINGS } from './auth';

interface DataCtx {
  loading: boolean;
  cards: Card[];
  owners: Owner[];
  banks: Bank[];
  payments: Payment[];
  transactions: Transaction[];
  emis: EMIPlan[];
  documents: DocumentFile[];
  audit: AuditLog[];
  settings: Settings;
  ownersById: Record<string, Owner>;
  banksById: Record<string, Bank>;
  cardsById: Record<string, Card>;
  dueItems: DueItem[];
  dismissedKeys: Set<string>;
}

const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const cards = useLiveQuery(() => db.cards.toArray(), [], undefined as Card[] | undefined);
  const owners = useLiveQuery(() => db.owners.toArray(), [], undefined as Owner[] | undefined);
  const banks = useLiveQuery(() => db.banks.toArray(), [], undefined as Bank[] | undefined);
  const payments = useLiveQuery(() => db.payments.toArray(), [], undefined as Payment[] | undefined);
  const transactions = useLiveQuery(() => db.transactions.toArray(), [], undefined as Transaction[] | undefined);
  const emis = useLiveQuery(() => db.emis.toArray(), [], undefined as EMIPlan[] | undefined);
  const documents = useLiveQuery(() => db.documents.toArray(), [], undefined as DocumentFile[] | undefined);
  const audit = useLiveQuery(() => db.audit.orderBy('at').reverse().limit(100).toArray(), [], undefined as AuditLog[] | undefined);
  const settingsRow = useLiveQuery(() => db.settings.get('app'), [], undefined as Settings | undefined);
  const dismissed = useLiveQuery(() => db.reminders.toArray(), [], []);

  const settings = settingsRow ?? DEFAULT_SETTINGS;

  useEffect(() => {
    configureFormatting(settings.currency, settings.locale);
  }, [settings.currency, settings.locale]);

  const value = useMemo<DataCtx>(() => {
    const c = cards ?? [];
    const o = owners ?? [];
    const b = banks ?? [];
    const ownersById = Object.fromEntries(o.map((x) => [x.id, x]));
    const banksById = Object.fromEntries(b.map((x) => [x.id, x]));
    const cardsById = Object.fromEntries(c.map((x) => [x.id, x]));
    const dueItems = buildDueItems(c, ownersById, banksById);
    return {
      loading: cards === undefined || owners === undefined || banks === undefined,
      cards: c,
      owners: o,
      banks: b,
      payments: payments ?? [],
      transactions: transactions ?? [],
      emis: emis ?? [],
      documents: documents ?? [],
      audit: audit ?? [],
      settings,
      ownersById,
      banksById,
      cardsById,
      dueItems,
      dismissedKeys: new Set((dismissed ?? []).map((d) => d.id)),
    };
  }, [cards, owners, banks, payments, transactions, emis, documents, audit, settings, dismissed]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
