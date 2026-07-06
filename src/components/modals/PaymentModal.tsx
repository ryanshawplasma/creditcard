import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ArrowRight, Upload, X } from 'lucide-react';
import type { PaymentMode } from '@/types';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button, Field, Input, Select, Textarea } from '@/components/ui/primitives';
import { recordPayment } from '@/lib/repo';
import { money } from '@/lib/format';
import { minimumDue } from '@/lib/reminders';
import { readFileAsDataURL } from '@/lib/utils';

const MODES: PaymentMode[] = ['UPI', 'NetBanking', 'AutoDebit', 'NEFT', 'IMPS', 'Cash', 'Cheque', 'Card'];

export function PaymentModal() {
  const { paymentModal, closePaymentModal } = useUI();
  const { cards, owners, cardsById } = useData();
  const toast = useToast();

  const activeCards = cards.filter((c) => c.status !== 'Closed');
  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paidById, setPaidById] = useState('');
  const [mode, setMode] = useState<PaymentMode>('UPI');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [screenshot, setScreenshot] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!paymentModal.open) return;
    const preselect = paymentModal.id ?? activeCards.find((c) => c.currentBalance > 0)?.id ?? activeCards[0]?.id ?? '';
    setCardId(preselect);
    const card = cardsById[preselect];
    setAmount(card ? String(card.currentBalance) : '');
    setPaidById(card ? card.ownerId : owners[0]?.id ?? '');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setReference(''); setNotes(''); setScreenshot(undefined); setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentModal.open, paymentModal.id]);

  const card = cardsById[cardId];
  const amt = Number(amount) || 0;
  const newBalance = card ? Math.max(0, card.currentBalance - amt) : 0;

  async function handleSubmit() {
    setError('');
    if (!cardId) return setError('Select a card.');
    if (amt <= 0) return setError('Enter a valid amount.');
    setBusy(true);
    try {
      await recordPayment({ cardId, amount: amt, date, paidById: paidById || undefined, mode, reference: reference || undefined, notes: notes || undefined, screenshot });
      toast.success('Payment recorded', `${money(amt)} paid — ${card?.name}. Outstanding now ${money(newBalance)}.`);
      closePaymentModal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={paymentModal.open}
      onClose={closePaymentModal}
      title="Record a payment"
      description="Outstanding balance updates automatically."
      footer={<><Button onClick={closePaymentModal}>Cancel</Button><Button variant="primary" loading={busy} onClick={handleSubmit}>Record payment</Button></>}
    >
      <div className="space-y-4">
        <Field label="Card">
          <Select value={cardId} onChange={(e) => { setCardId(e.target.value); const c = cardsById[e.target.value]; if (c) { setAmount(String(c.currentBalance)); setPaidById(c.ownerId); } }}>
            {activeCards.map((c) => <option key={c.id} value={c.id}>{c.name} — {money(c.currentBalance)} due</option>)}
          </Select>
        </Field>

        {card && (
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-muted">Current outstanding</p>
              <p className="font-semibold tabular-nums">{money(card.currentBalance)}</p>
            </div>
            <ArrowRight size={16} className="text-subtle" />
            <div className="text-right">
              <p className="text-xs text-muted">After payment</p>
              <p className="font-semibold tabular-nums text-success">{money(newBalance)}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" autoFocus />
          </Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>

        {card && (
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Full balance', v: card.currentBalance },
              { label: 'Minimum due', v: minimumDue(card.currentBalance) },
              { label: '50%', v: Math.round(card.currentBalance / 2) },
            ].map((q) => (
              <button key={q.label} onClick={() => setAmount(String(q.v))} className="rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs text-muted transition hover:border-accent hover:text-accent">
                {q.label} · {money(q.v)}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid by"><Select value={paidById} onChange={(e) => setPaidById(e.target.value)}>{owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
          <Field label="Mode"><Select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)}>{MODES.map((m) => <option key={m}>{m}</option>)}</Select></Field>
        </div>
        <Field label="Reference number (optional)"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UTR / transaction id" /></Field>
        <Field label="Notes (optional)"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to note about this payment" /></Field>

        <div>
          <p className="mb-2 text-xs font-medium text-muted">Screenshot / receipt (optional)</p>
          {screenshot ? (
            <div className="flex items-center gap-2">
              <img src={screenshot} alt="receipt" className="h-14 w-14 rounded-lg object-cover" />
              <Button size="sm" variant="ghost" onClick={() => setScreenshot(undefined)}><X size={14} /> Remove</Button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm text-muted hover:border-border-strong">
              <Upload size={15} /> Attach receipt
              <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setScreenshot(await readFileAsDataURL(f)); }} />
            </label>
          )}
        </div>

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
