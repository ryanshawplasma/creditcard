import { useEffect, useMemo, useState } from 'react';
import { Lock, Upload, X } from 'lucide-react';
import type { Card, CardNetwork, CardStatus, RewardType } from '@/types';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button, Field, Input, Select, Switch, Textarea } from '@/components/ui/primitives';
import { CardVisual } from '@/components/CardVisual';
import { CARD_GRADIENTS, CARD_GRADIENT_KEYS } from '@/lib/format';
import { saveCard, saveBank, saveOwner } from '@/lib/repo';
import { cn, readFileAsDataURL } from '@/lib/utils';

const NETWORKS: CardNetwork[] = ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Discover', 'Diners'];
const STATUSES: CardStatus[] = ['Active', 'Blocked', 'Closed'];
const REWARD_TYPES: RewardType[] = ['Points', 'Cashback', 'Miles', 'None'];
const ICONS = ['💳', '👑', '✈️', '🛒', '📦', '🍽️', '⛽', '🏦', '💠', '🌸', '⭐', '🛍️', '💼', '🖱️', '🎁', '🔥'];

interface FormState {
  name: string;
  bankId: string;
  newBankName: string;
  network: CardNetwork;
  ownerId: string;
  newOwnerName: string;
  last4: string;
  expiryMonth: string;
  expiryYear: string;
  creditLimit: string;
  cashLimit: string;
  openingBalance: string;
  billingDay: string;
  statementDay: string;
  dueDay: string;
  interestRate: string;
  annualFee: string;
  annualFeeMonth: string;
  rewardType: RewardType;
  rewardProgram: string;
  rewardPoints: string;
  rewardRate: string;
  autoDebit: boolean;
  linkedBank: string;
  status: CardStatus;
  color: string;
  icon: string;
  image?: string;
  notes: string;
  tags: string;
  fullCardNumber: string;
  cvv: string;
  secureNotes: string;
  pinned: boolean;
}

const empty = (): FormState => ({
  name: '', bankId: '', newBankName: '', network: 'Visa', ownerId: '', newOwnerName: '', last4: '',
  expiryMonth: '', expiryYear: '', creditLimit: '', cashLimit: '', openingBalance: '',
  billingDay: '1', statementDay: '1', dueDay: '15', interestRate: '', annualFee: '', annualFeeMonth: '',
  rewardType: 'Points', rewardProgram: '', rewardPoints: '', rewardRate: '', autoDebit: false, linkedBank: '',
  status: 'Active', color: 'aurora', icon: '💳', notes: '', tags: '', fullCardNumber: '', cvv: '', secureNotes: '', pinned: false,
});

function fromCard(c: Card): FormState {
  return {
    ...empty(),
    name: c.name, bankId: c.bankId, network: c.network, ownerId: c.ownerId, last4: c.last4,
    expiryMonth: String(c.expiryMonth), expiryYear: String(c.expiryYear),
    creditLimit: String(c.creditLimit), cashLimit: c.cashLimit ? String(c.cashLimit) : '',
    openingBalance: String(c.baselineBalance ?? 0),
    billingDay: String(c.billingDay), statementDay: String(c.statementDay), dueDay: String(c.dueDay),
    interestRate: c.interestRate ? String(c.interestRate) : '', annualFee: c.annualFee ? String(c.annualFee) : '',
    annualFeeMonth: c.annualFeeMonth ? String(c.annualFeeMonth) : '', rewardType: c.rewardType,
    rewardProgram: c.rewardProgram ?? '', rewardPoints: c.rewardPoints ? String(c.rewardPoints) : '',
    rewardRate: c.rewardRate ? String(c.rewardRate) : '', autoDebit: c.autoDebit, linkedBank: c.linkedBank ?? '',
    status: c.status, color: c.color, icon: c.icon ?? '💳', image: c.image, notes: c.notes ?? '',
    tags: (c.tags ?? []).join(', '), pinned: !!c.pinned, fullCardNumber: '', cvv: '', secureNotes: '',
  };
}

export function CardModal() {
  const { cardModal, closeCardModal } = useUI();
  const { banks, owners, cardsById } = useData();
  const { masterKey } = useAuth();
  const toast = useToast();
  const editing = cardModal.id ? cardsById[cardModal.id] : undefined;

  const [form, setForm] = useState<FormState>(empty());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cardModal.open) return;
    setError('');
    if (editing) {
      setForm(fromCard(editing));
      return;
    }
    const base = empty();
    base.bankId = banks[0]?.id ?? '';
    base.ownerId = owners.find((o) => o.relationship === 'Self')?.id ?? owners[0]?.id ?? '';
    // Pre-fill from a smart-import draft (photo / pasted text), if present.
    const d = cardModal.draft;
    if (d) {
      if (d.name) base.name = d.name;
      if (d.network) base.network = d.network;
      if (d.last4) base.last4 = d.last4;
      if (d.fullCardNumber) base.fullCardNumber = d.fullCardNumber;
      if (d.rewardProgram) base.rewardProgram = d.rewardProgram;
      if (d.image) base.image = d.image;
      if (d.notes) base.notes = d.notes;
      if (d.creditLimit) base.creditLimit = String(d.creditLimit);
      if (d.openingBalance !== undefined) base.openingBalance = String(d.openingBalance);
      if (d.dueDay) base.dueDay = String(d.dueDay);
      if (d.billingDay) base.billingDay = String(d.billingDay);
      if (d.statementDay) base.statementDay = String(d.statementDay);
      if (d.expiryMonth) base.expiryMonth = String(d.expiryMonth);
      if (d.expiryYear) base.expiryYear = String(d.expiryYear);
      if (d.bankId) base.bankId = d.bankId;
      else if (d.newBankName) { base.bankId = ''; base.newBankName = d.newBankName; }
    }
    setForm(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardModal.open, cardModal.id, cardModal.draft]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const previewCard = useMemo<Card>(
    () => ({
      id: 'preview', name: form.name || 'Card name', bankId: form.bankId, network: form.network,
      ownerId: form.ownerId, last4: form.last4 || '0000', expiryMonth: Number(form.expiryMonth) || 12,
      expiryYear: Number(form.expiryYear) || 2028, creditLimit: 0, baselineBalance: 0, currentBalance: 0,
      billingDay: 1, statementDay: 1, dueDay: 1, rewardType: form.rewardType, autoDebit: form.autoDebit,
      status: form.status, color: form.color, icon: form.icon, image: form.image, pinned: form.pinned,
      createdAt: '', updatedAt: '',
    }),
    [form],
  );
  const previewBank = banks.find((b) => b.id === form.bankId) ?? (form.newBankName ? { id: 'new', name: form.newBankName, color: '#666' } : undefined);
  const previewOwnerName = owners.find((o) => o.id === form.ownerId)?.name ?? form.newOwnerName;

  async function handleImage(file?: File) {
    if (!file) return;
    set('image', await readFileAsDataURL(file));
  }

  async function handleSubmit() {
    setError('');
    if (!form.name.trim()) return setError('Card name is required.');
    if (!/^\d{4}$/.test(form.last4)) return setError('Enter the last 4 digits.');
    if (!form.creditLimit || Number(form.creditLimit) <= 0) return setError('Enter a valid credit limit.');
    if (!form.bankId && !form.newBankName.trim()) return setError('Select or add a bank.');
    if (!form.ownerId && !form.newOwnerName.trim()) return setError('Select or add an owner.');

    setBusy(true);
    try {
      let bankId = form.bankId;
      if (!bankId && form.newBankName.trim()) {
        bankId = await saveBank({ name: form.newBankName.trim(), color: '#6366f1' });
      }
      let ownerId = form.ownerId;
      if (!ownerId && form.newOwnerName.trim()) {
        ownerId = await saveOwner({ name: form.newOwnerName.trim(), relationship: 'Family', color: '#ec4899' });
      }

      await saveCard(
        {
          id: editing?.id,
          name: form.name.trim(),
          bankId,
          network: form.network,
          ownerId,
          last4: form.last4,
          expiryMonth: Number(form.expiryMonth) || 12,
          expiryYear: Number(form.expiryYear) || new Date().getFullYear() + 3,
          creditLimit: Number(form.creditLimit),
          cashLimit: form.cashLimit ? Number(form.cashLimit) : undefined,
          openingBalance: form.openingBalance ? Number(form.openingBalance) : 0,
          billingDay: Number(form.billingDay), statementDay: Number(form.statementDay), dueDay: Number(form.dueDay),
          interestRate: form.interestRate ? Number(form.interestRate) : undefined,
          annualFee: form.annualFee ? Number(form.annualFee) : undefined,
          annualFeeMonth: form.annualFeeMonth ? Number(form.annualFeeMonth) : undefined,
          rewardType: form.rewardType,
          rewardProgram: form.rewardProgram || undefined,
          rewardPoints: form.rewardPoints ? Number(form.rewardPoints) : undefined,
          rewardRate: form.rewardRate ? Number(form.rewardRate) : undefined,
          autoDebit: form.autoDebit,
          linkedBank: form.linkedBank || undefined,
          status: form.status,
          color: form.color,
          icon: form.icon,
          image: form.image,
          notes: form.notes || undefined,
          tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
          pinned: form.pinned,
          fullCardNumber: form.fullCardNumber || undefined,
          cvv: form.cvv || undefined,
          secureNotes: form.secureNotes || undefined,
        },
        masterKey,
      );
      toast.success(editing ? 'Card updated' : 'Card added', `${form.name} saved to your vault.`);
      closeCardModal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={cardModal.open}
      onClose={closeCardModal}
      size="xl"
      title={editing ? 'Edit card' : 'Add a card'}
      description="Sensitive fields are encrypted with AES-256 before they touch storage."
      footer={
        <>
          <Button onClick={closeCardModal}>Cancel</Button>
          <Button variant="primary" loading={busy} onClick={handleSubmit}>{editing ? 'Save changes' : 'Add card'}</Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Live preview + appearance */}
        <div className="space-y-4">
          <CardVisual card={previewCard} bank={previewBank as any} ownerName={previewOwnerName} />
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Card colour</p>
            <div className="grid grid-cols-5 gap-2">
              {CARD_GRADIENT_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => set('color', key)}
                  style={{ background: CARD_GRADIENTS[key] }}
                  className={cn('h-9 rounded-lg ring-2 ring-offset-2 ring-offset-surface transition', form.color === key ? 'ring-accent' : 'ring-transparent')}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Icon</p>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((ic) => (
                <button key={ic} onClick={() => set('icon', ic)} className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-lg transition', form.icon === ic ? 'bg-accent/20 ring-1 ring-accent' : 'hover:bg-surface-2')}>
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Card image (optional)</p>
            {form.image ? (
              <div className="flex items-center gap-2">
                <img src={form.image} alt="card" className="h-10 w-16 rounded-lg object-cover" />
                <Button size="sm" variant="ghost" onClick={() => set('image', undefined)}><X size={14} /> Remove</Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:border-border-strong">
                <Upload size={15} /> Upload card art
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-5">
          <Section title="Identity">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Card name" className="col-span-2">
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Amazon Pay ICICI" autoFocus />
              </Field>
              <Field label="Bank">
                <Select value={form.bankId} onChange={(e) => set('bankId', e.target.value)}>
                  <option value="">＋ Add new bank…</option>
                  {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              {!form.bankId && <Field label="New bank name"><Input value={form.newBankName} onChange={(e) => set('newBankName', e.target.value)} placeholder="Bank name" /></Field>}
              {form.bankId && <Field label="Network"><Select value={form.network} onChange={(e) => set('network', e.target.value as CardNetwork)}>{NETWORKS.map((n) => <option key={n}>{n}</option>)}</Select></Field>}
              {!form.bankId && <Field label="Network"><Select value={form.network} onChange={(e) => set('network', e.target.value as CardNetwork)}>{NETWORKS.map((n) => <option key={n}>{n}</option>)}</Select></Field>}
              <Field label="Owner">
                <Select value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
                  <option value="">＋ Add new person…</option>
                  {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </Field>
              {!form.ownerId && <Field label="New person name"><Input value={form.newOwnerName} onChange={(e) => set('newOwnerName', e.target.value)} placeholder="Full name" /></Field>}
              <Field label="Last 4 digits">
                <Input value={form.last4} onChange={(e) => set('last4', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4589" inputMode="numeric" />
              </Field>
            </div>
          </Section>

          <Section title="Security" hint="Encrypted at rest — leave blank to keep existing / store only metadata.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Full card number (optional)" className="col-span-2">
                <div className="relative">
                  <Lock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                  <Input value={form.fullCardNumber} onChange={(e) => set('fullCardNumber', e.target.value)} placeholder="Stored encrypted, never in plaintext" className="pl-9 font-mono" autoComplete="off" />
                </div>
              </Field>
              <Field label="CVV (optional)"><Input value={form.cvv} onChange={(e) => set('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="•••" type="password" autoComplete="off" /></Field>
              <Field label="Secure notes (optional)"><Input value={form.secureNotes} onChange={(e) => set('secureNotes', e.target.value)} placeholder="PIN hint, etc." /></Field>
            </div>
          </Section>

          <Section title="Limits & billing cycle">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Credit limit"><Input value={form.creditLimit} onChange={(e) => set('creditLimit', e.target.value.replace(/[^\d]/g, ''))} placeholder="500000" inputMode="numeric" /></Field>
              <Field label="Cash limit"><Input value={form.cashLimit} onChange={(e) => set('cashLimit', e.target.value.replace(/[^\d]/g, ''))} placeholder="150000" inputMode="numeric" /></Field>
              <Field label="Current outstanding"><Input value={form.openingBalance} onChange={(e) => set('openingBalance', e.target.value.replace(/[^\d]/g, ''))} placeholder="0" inputMode="numeric" /></Field>
              <Field label="Billing day"><Input value={form.billingDay} onChange={(e) => set('billingDay', clampDay(e.target.value))} inputMode="numeric" /></Field>
              <Field label="Statement day"><Input value={form.statementDay} onChange={(e) => set('statementDay', clampDay(e.target.value))} inputMode="numeric" /></Field>
              <Field label="Due day"><Input value={form.dueDay} onChange={(e) => set('dueDay', clampDay(e.target.value))} inputMode="numeric" /></Field>
              <Field label="Expiry month"><Input value={form.expiryMonth} onChange={(e) => set('expiryMonth', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="MM" inputMode="numeric" /></Field>
              <Field label="Expiry year"><Input value={form.expiryYear} onChange={(e) => set('expiryYear', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" inputMode="numeric" /></Field>
              <Field label="Status"><Select value={form.status} onChange={(e) => set('status', e.target.value as CardStatus)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            </div>
          </Section>

          <Section title="Terms & rewards">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Interest rate % p.a."><Input value={form.interestRate} onChange={(e) => set('interestRate', e.target.value.replace(/[^\d.]/g, ''))} placeholder="42" inputMode="decimal" /></Field>
              <Field label="Annual fee"><Input value={form.annualFee} onChange={(e) => set('annualFee', e.target.value.replace(/[^\d]/g, ''))} placeholder="2500" inputMode="numeric" /></Field>
              <Field label="Fee month (1–12)"><Input value={form.annualFeeMonth} onChange={(e) => set('annualFeeMonth', e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="9" inputMode="numeric" /></Field>
              <Field label="Reward type"><Select value={form.rewardType} onChange={(e) => set('rewardType', e.target.value as RewardType)}>{REWARD_TYPES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
              <Field label="Reward program"><Input value={form.rewardProgram} onChange={(e) => set('rewardProgram', e.target.value)} placeholder="e.g. Edge Rewards" /></Field>
              <Field label="Reward points"><Input value={form.rewardPoints} onChange={(e) => set('rewardPoints', e.target.value.replace(/[^\d]/g, ''))} placeholder="12000" inputMode="numeric" /></Field>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Linked bank account"><Input value={form.linkedBank} onChange={(e) => set('linkedBank', e.target.value)} placeholder="HDFC Savings ••4501" /></Field>
              <Field label="Tags (comma separated)"><Input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="Travel, Premium" /></Field>
            </div>
            <div className="mt-3 flex items-center gap-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted"><Switch checked={form.autoDebit} onChange={(v) => set('autoDebit', v)} /> Auto-debit enabled</label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted"><Switch checked={form.pinned} onChange={(v) => set('pinned', v)} /> Pin to top</label>
            </div>
            <Field label="Notes" className="mt-3"><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth remembering about this card…" /></Field>
          </Section>

          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </Modal>
  );
}

function clampDay(v: string): string {
  const n = v.replace(/\D/g, '').slice(0, 2);
  if (n === '') return '';
  return String(Math.max(1, Math.min(31, Number(n))));
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2.5 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        {hint && <span className="text-[11px] text-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
