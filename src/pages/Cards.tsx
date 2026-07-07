import { useMemo, useState } from 'react';
import {
  Plus, Search, Star, Pencil, Wallet, Trash2, Eye, EyeOff, Copy, ShieldCheck,
  CreditCard as CardIcon, Grid3x3, List, Sparkles,
} from 'lucide-react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/ui/Toast';
import { Page, PageHeader, Stagger, StaggerItem } from '@/components/ui/Page';
import { Button, Badge, Input, Select, Segmented } from '@/components/ui/primitives';
import { ProgressBar, EmptyState } from '@/components/ui/feedback';
import { Sheet } from '@/components/ui/Modal';
import { CardVisual } from '@/components/CardVisual';
import { decryptField, groupCardNumber, maskCardNumber } from '@/lib/crypto';
import { money, percent, fmtDate, NETWORK_META, CARD_GRADIENTS } from '@/lib/format';
import { utilization } from '@/lib/analytics';
import { togglePin, deleteCard, setCardStatus } from '@/lib/repo';
import { currentDueDate, daysUntil } from '@/lib/cycle';
import { cn } from '@/lib/utils';
import type { Card } from '@/types';

export function CardsPage() {
  const { cards, owners, ownersById, banksById, payments } = useData();
  const { openCardModal, openPaymentModal, openSmartImport } = useUI();
  const [q, setQ] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState<'balance' | 'utilization' | 'due' | 'name'>('balance');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = cards.filter((c) => {
      const owner = ownersById[c.ownerId]?.name.toLowerCase() ?? '';
      const bank = banksById[c.bankId]?.name.toLowerCase() ?? '';
      const hay = `${c.name} ${owner} ${bank} ${c.last4} ${(c.tags ?? []).join(' ')}`.toLowerCase();
      return (
        hay.includes(q.toLowerCase()) &&
        (ownerFilter === 'all' || c.ownerId === ownerFilter) &&
        (statusFilter === 'all' || c.status === statusFilter)
      );
    });
    list = [...list].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (sort === 'balance') return b.currentBalance - a.currentBalance;
      if (sort === 'utilization') return utilization(b) - utilization(a);
      if (sort === 'due') return a.dueDay - b.dueDay;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [cards, q, ownerFilter, statusFilter, sort, ownersById, banksById]);

  const selectedCard = selected ? cards.find((c) => c.id === selected) : undefined;

  return (
    <Page>
      <PageHeader
        title="Cards"
        subtitle={`${cards.filter((c) => c.status === 'Active').length} active · ${money(cards.reduce((s, c) => s + c.currentBalance, 0))} outstanding`}
        actions={
          <>
            <Button onClick={openSmartImport}><Sparkles size={16} /> Smart add</Button>
            <Button variant="primary" onClick={() => openCardModal()}><Plus size={16} /> Add card</Button>
          </>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-2.5 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:min-w-[220px] sm:flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards, people, banks, last 4…" className="pl-9" />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 no-scrollbar sm:mx-0 sm:contents sm:overflow-visible sm:px-0">
          <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} className="w-auto min-w-[130px] shrink-0">
            <option value="all">All people</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto min-w-[110px] shrink-0">
            <option value="all">All status</option>
            <option>Active</option><option>Blocked</option><option>Closed</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as any)} className="w-auto min-w-[130px] shrink-0">
            <option value="balance">Sort: Balance</option>
            <option value="utilization">Sort: Utilization</option>
            <option value="due">Sort: Due date</option>
            <option value="name">Sort: Name</option>
          </Select>
          <div className="shrink-0"><Segmented value={view} onChange={setView} options={[{ value: 'grid', label: <Grid3x3 size={14} /> }, { value: 'list', label: <List size={14} /> }]} /></div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CardIcon size={26} />}
          title={q || ownerFilter !== 'all' ? 'No cards match your filters' : 'No cards yet'}
          description={q ? 'Try a different search or clear the filters.' : 'Add your first card to start tracking dues, limits and rewards.'}
          action={<Button variant="primary" onClick={() => openCardModal()}><Plus size={16} /> Add a card</Button>}
        />
      ) : view === 'grid' ? (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <StaggerItem key={c.id}>
              <CardTile card={c} bankName={banksById[c.bankId]?.name} ownerName={ownersById[c.ownerId]?.name} onClick={() => setSelected(c.id)} />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {filtered.map((c, i) => (
            <CardListRow key={c.id} card={c} bankName={banksById[c.bankId]?.name} ownerName={ownersById[c.ownerId]?.name} onClick={() => setSelected(c.id)} isLast={i === filtered.length - 1} />
          ))}
        </div>
      )}

      <CardDetailSheet
        card={selectedCard}
        onClose={() => setSelected(null)}
        payments={payments.filter((p) => p.cardId === selected)}
        bankName={selectedCard ? banksById[selectedCard.bankId]?.name : undefined}
        ownerName={selectedCard ? ownersById[selectedCard.ownerId]?.name : undefined}
        onEdit={() => { if (selectedCard) { const id = selectedCard.id; setSelected(null); openCardModal(id); } }}
        onPay={() => { if (selectedCard) openPaymentModal(selectedCard.id); }}
      />
    </Page>
  );
}

function CardTile({ card, bankName, ownerName, onClick }: { card: Card; bankName?: string; ownerName?: string; onClick: () => void }) {
  const util = utilization(card);
  const due = currentDueDate(card);
  const overdue = card.currentBalance > 0 && daysUntil(due) < 0;
  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className="[perspective:1200px]"><CardVisual card={card} bank={bankName ? { id: '', name: bankName, color: '#000' } : undefined} ownerName={ownerName} interactive /></div>
      <div className="mt-3 space-y-2 px-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">Outstanding</span>
          <span className="font-semibold tabular-nums">{money(card.currentBalance)}</span>
        </div>
        <ProgressBar value={util} />
        <div className="flex items-center justify-between text-xs text-subtle">
          <span>{percent(util)} of {money(card.creditLimit, { compact: true })}</span>
          <span className={overdue ? 'font-medium text-danger' : ''}>{overdue ? 'Overdue' : 'Due'} {fmtDate(due, 'dd MMM')}</span>
        </div>
      </div>
    </div>
  );
}

function CardListRow({ card, bankName, ownerName, onClick, isLast }: { card: Card; bankName?: string; ownerName?: string; onClick: () => void; isLast: boolean }) {
  const util = utilization(card);
  return (
    <button onClick={onClick} className={cn('flex w-full items-center gap-4 bg-surface px-4 py-3 text-left transition hover:bg-surface-2', !isLast && 'border-b border-border')}>
      <div className="flex h-9 w-14 shrink-0 items-center justify-center rounded-lg text-sm shadow-soft" style={{ background: CARD_GRADIENTS[card.color] }}>
        <span>{card.icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{card.name} {card.pinned && <Star size={11} className="inline fill-accent text-accent" />}</p>
        <p className="truncate text-xs text-subtle">{bankName} · {ownerName} · {maskCardNumber(card.last4)}</p>
      </div>
      <div className="hidden w-28 sm:block">
        <ProgressBar value={util} />
        <p className="mt-1 text-[11px] text-subtle">{percent(util)}</p>
      </div>
      <div className="w-24 text-right">
        <p className="text-sm font-semibold tabular-nums">{money(card.currentBalance)}</p>
        <Badge tone={card.status === 'Active' ? 'success' : card.status === 'Blocked' ? 'warning' : 'neutral'}>{card.status}</Badge>
      </div>
    </button>
  );
}

function CardDetailSheet({ card, onClose, payments, bankName, ownerName, onEdit, onPay }: {
  card?: Card; onClose: () => void; payments: any[]; bankName?: string; ownerName?: string; onEdit: () => void; onPay: () => void;
}) {
  const { masterKey } = useAuth();
  const toast = useToast();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function reveal() {
    if (!card?.secure?.cardNumber || !masterKey) { toast.info('No stored number', 'Only the last 4 digits are on file for this card.'); return; }
    try {
      const full = await decryptField(masterKey, card.secure.cardNumber);
      setRevealed(groupCardNumber(full));
    } catch { toast.error('Could not decrypt', 'The vault key is unavailable.'); }
  }

  const util = card ? utilization(card) : 0;

  return (
    <Sheet open={!!card} onClose={() => { setRevealed(null); setConfirmDelete(false); onClose(); }} width="max-w-lg" title={card?.name}>
      {card && (
        <div className="space-y-5 p-5">
          <CardVisual card={card} bank={bankName ? { id: '', name: bankName, color: '#000' } : undefined} ownerName={ownerName} />

          <div className="flex gap-2">
            <Button variant="primary" className="flex-1" onClick={onPay}><Wallet size={15} /> Record payment</Button>
            <Button className="flex-1" onClick={onEdit}><Pencil size={15} /> Edit</Button>
            <Button size="icon" onClick={() => togglePin(card.id, !card.pinned)} title="Pin"><Star size={16} className={card.pinned ? 'fill-accent text-accent' : ''} /></Button>
          </div>

          {/* Secure number */}
          <div className="rounded-2xl border border-border bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted"><ShieldCheck size={14} className="text-success" /> Card number (AES-256 encrypted)</div>
            <div className="flex items-center justify-between">
              <p className="font-mono text-base tracking-wider">{revealed ?? maskCardNumber(card.last4)}</p>
              <div className="flex gap-1">
                {revealed && (
                  <button onClick={() => { navigator.clipboard.writeText(revealed.replace(/\s/g, '')); toast.success('Copied'); }} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg"><Copy size={15} /></button>
                )}
                <button onClick={() => (revealed ? setRevealed(null) : reveal())} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg">
                  {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Outstanding" value={money(card.currentBalance)} />
            <Stat label="Credit limit" value={money(card.creditLimit)} />
            <Stat label="Available" value={money(Math.max(0, card.creditLimit - card.currentBalance))} />
            <Stat label="Utilization" value={percent(util)} tone={util >= 70 ? 'danger' : util >= 30 ? 'warning' : 'success'} />
          </div>
          <ProgressBar value={util} />

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-border p-4 text-sm">
            <Detail label="Network" value={NETWORK_META[card.network]?.label ?? card.network} />
            <Detail label="Owner" value={ownerName ?? '—'} />
            <Detail label="Expiry" value={`${String(card.expiryMonth).padStart(2, '0')}/${card.expiryYear}`} />
            <Detail label="Billing day" value={`${card.billingDay}`} />
            <Detail label="Statement day" value={`${card.statementDay}`} />
            <Detail label="Due day" value={`${card.dueDay}`} />
            <Detail label="Interest" value={card.interestRate ? `${card.interestRate}% p.a.` : '—'} />
            <Detail label="Annual fee" value={card.annualFee ? money(card.annualFee) : 'None'} />
            <Detail label="Reward program" value={card.rewardProgram ?? '—'} />
            <Detail label="Reward points" value={(card.rewardPoints ?? 0).toLocaleString('en-IN')} />
            <Detail label="Auto-debit" value={card.autoDebit ? 'On' : 'Off'} />
            <Detail label="Linked bank" value={card.linkedBank ?? '—'} />
          </div>

          {card.tags && card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{card.tags.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}</div>
          )}
          {card.notes && <p className="rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">{card.notes}</p>}

          {/* Recent payments */}
          <div>
            <h4 className="mb-2 text-sm font-semibold">Recent payments</h4>
            {payments.length === 0 ? (
              <p className="text-xs text-subtle">No payments recorded for this card yet.</p>
            ) : (
              <div className="space-y-1.5">
                {payments.slice(0, 5).map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
                    <span className="text-muted">{fmtDate(p.date)} · {p.mode}</span>
                    <span className="font-medium text-success tabular-nums">−{money(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex gap-1.5">
              {(['Active', 'Blocked', 'Closed'] as const).map((s) => (
                <button key={s} onClick={() => setCardStatus(card.id, s)} className={cn('rounded-lg px-2.5 py-1.5 text-xs font-medium transition', card.status === s ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-surface-2')}>{s}</button>
              ))}
            </div>
            {confirmDelete ? (
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                <Button size="sm" variant="danger" onClick={async () => { await deleteCard(card.id); toast.success('Card deleted'); onClose(); }}>Confirm delete</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Delete</Button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'warning' | 'success' }) {
  const c = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-fg';
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn('mt-0.5 text-base font-semibold tabular-nums', c)}>{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-fg">{value}</span>
    </div>
  );
}
