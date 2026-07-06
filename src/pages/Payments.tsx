import { useMemo, useState } from 'react';
import { parseISO } from 'date-fns';
import { Plus, Search, Trash2, Wallet, Receipt, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useToast } from '@/components/ui/Toast';
import { Page, PageHeader } from '@/components/ui/Page';
import { Button, Input, Select, Segmented, Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/feedback';
import { money, fmtDate, CARD_GRADIENTS } from '@/lib/format';
import { deletePayment, deleteTransaction, recordPayment, addTransaction } from '@/lib/repo';
import type { Payment, Transaction } from '@/types';

export function PaymentsPage() {
  const { payments, transactions, cardsById, ownersById } = useData();
  const { openPaymentModal, openTxnModal } = useUI();
  const toast = useToast();
  const [tab, setTab] = useState<'payments' | 'spending'>('payments');
  const [q, setQ] = useState('');
  const [cardFilter, setCardFilter] = useState('all');

  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
    [payments],
  );
  const sortedTxns = useMemo(
    () => [...transactions].sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()),
    [transactions],
  );

  const filteredPayments = sortedPayments.filter((p) => {
    const card = cardsById[p.cardId];
    const hay = `${card?.name} ${p.mode} ${p.reference ?? ''} ${ownersById[p.paidById ?? '']?.name ?? ''}`.toLowerCase();
    return hay.includes(q.toLowerCase()) && (cardFilter === 'all' || p.cardId === cardFilter);
  });
  const filteredTxns = sortedTxns.filter((t) => {
    const card = cardsById[t.cardId];
    const hay = `${card?.name} ${t.merchant} ${t.category}`.toLowerCase();
    return hay.includes(q.toLowerCase()) && (cardFilter === 'all' || t.cardId === cardFilter);
  });

  const totalPaid = filteredPayments.reduce((s, p) => s + p.amount, 0);
  const totalSpent = filteredTxns.reduce((s, t) => s + t.amount, 0);
  const cards = Object.values(cardsById);

  async function undoDeletePayment(p: Payment) {
    await recordPayment({ cardId: p.cardId, amount: p.amount, date: p.date, paidById: p.paidById, mode: p.mode, reference: p.reference, notes: p.notes, screenshot: p.screenshot });
  }
  async function undoDeleteTxn(t: Transaction) {
    await addTransaction({ cardId: t.cardId, amount: t.amount, date: t.date, merchant: t.merchant, category: t.category, notes: t.notes });
  }

  return (
    <Page>
      <PageHeader
        title="Payments"
        subtitle="Track every payment and every purchase"
        actions={
          tab === 'payments'
            ? <Button variant="primary" onClick={() => openPaymentModal()}><Wallet size={16} /> Record payment</Button>
            : <Button variant="primary" onClick={() => openTxnModal()}><Plus size={16} /> Add spend</Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented value={tab} onChange={setTab} options={[
          { value: 'payments', label: <span className="flex items-center gap-1.5"><ArrowDownCircle size={14} /> Payments</span> },
          { value: 'spending', label: <span className="flex items-center gap-1.5"><ArrowUpCircle size={14} /> Spending</span> },
        ]} />
        <div className="relative min-w-[200px] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="pl-9" />
        </div>
        <Select value={cardFilter} onChange={(e) => setCardFilter(e.target.value)} className="w-auto min-w-[140px]">
          <option value="all">All cards</option>
          {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
          <span className="text-muted">{tab === 'payments' ? 'Total paid' : 'Total spent'}: </span>
          <span className="font-semibold tabular-nums">{money(tab === 'payments' ? totalPaid : totalSpent)}</span>
        </div>
      </div>

      {tab === 'payments' ? (
        filteredPayments.length === 0 ? (
          <EmptyState icon={<Wallet size={26} />} title="No payments yet" description="Record a payment to keep balances accurate." action={<Button variant="primary" onClick={() => openPaymentModal()}><Wallet size={16} /> Record payment</Button>} />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            {filteredPayments.map((p, i) => {
              const card = cardsById[p.cardId];
              return (
                <div key={p.id} className={`group flex items-center gap-4 bg-surface px-4 py-3 transition hover:bg-surface-2 ${i < filteredPayments.length - 1 ? 'border-b border-border' : ''}`}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/12 text-success"><ArrowDownCircle size={18} /></div>
                  <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md text-xs" style={{ background: card ? CARD_GRADIENTS[card.color] : undefined }}>{card?.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{card?.name ?? 'Unknown card'}</p>
                    <p className="truncate text-xs text-subtle">{fmtDate(p.date)} · {p.mode} · {ownersById[p.paidById ?? '']?.name ?? '—'}{p.reference ? ` · ${p.reference}` : ''}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-success">−{money(p.amount)}</p>
                  <button
                    onClick={async () => { await deletePayment(p.id); toast.withUndo('Payment deleted', () => undoDeletePayment(p)); }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                  ><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        )
      ) : filteredTxns.length === 0 ? (
        <EmptyState icon={<Receipt size={26} />} title="No spending logged" description="Add purchases to see category and merchant breakdowns." action={<Button variant="primary" onClick={() => openTxnModal()}><Plus size={16} /> Add spend</Button>} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {filteredTxns.map((t, i) => {
            const card = cardsById[t.cardId];
            return (
              <div key={t.id} className={`group flex items-center gap-4 bg-surface px-4 py-3 transition hover:bg-surface-2 ${i < filteredTxns.length - 1 ? 'border-b border-border' : ''}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/12 text-accent"><ArrowUpCircle size={18} /></div>
                <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-md text-xs" style={{ background: card ? CARD_GRADIENTS[card.color] : undefined }}>{card?.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.merchant}</p>
                  <p className="truncate text-xs text-subtle">{fmtDate(t.date)} · {card?.name}</p>
                </div>
                <Badge tone="neutral">{t.category}</Badge>
                <p className="w-24 text-right text-sm font-semibold tabular-nums">{money(t.amount)}</p>
                <button
                  onClick={async () => { await deleteTransaction(t.id); toast.withUndo('Transaction deleted', () => undoDeleteTxn(t)); }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-subtle opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                ><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
