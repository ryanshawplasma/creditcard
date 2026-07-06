import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import type { SpendCategory } from '@/types';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button, Field, Input, Select } from '@/components/ui/primitives';
import { addTransaction } from '@/lib/repo';
import { money } from '@/lib/format';

const CATEGORIES: SpendCategory[] = ['Shopping', 'Dining', 'Travel', 'Fuel', 'Groceries', 'Bills', 'Entertainment', 'Health', 'Education', 'Other'];

export function TxnModal() {
  const { txnModal, closeTxnModal } = useUI();
  const { cards, cardsById } = useData();
  const toast = useToast();
  const activeCards = cards.filter((c) => c.status !== 'Closed');

  const [cardId, setCardId] = useState('');
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<SpendCategory>('Shopping');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!txnModal.open) return;
    setCardId(txnModal.id ?? activeCards[0]?.id ?? '');
    setAmount(''); setMerchant(''); setCategory('Shopping'); setDate(format(new Date(), 'yyyy-MM-dd')); setError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txnModal.open, txnModal.id]);

  async function handleSubmit() {
    setError('');
    const amt = Number(amount) || 0;
    if (!cardId) return setError('Select a card.');
    if (amt <= 0) return setError('Enter a valid amount.');
    if (!merchant.trim()) return setError('Enter a merchant.');
    setBusy(true);
    try {
      await addTransaction({ cardId, amount: amt, merchant: merchant.trim(), category, date });
      const card = cardsById[cardId];
      toast.success('Spend added', `${money(amt)} at ${merchant} — ${card?.name}`);
      closeTxnModal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={txnModal.open}
      onClose={closeTxnModal}
      title="Add a transaction"
      description="Logs a purchase and increases the card’s outstanding."
      footer={<><Button onClick={closeTxnModal}>Cancel</Button><Button variant="primary" loading={busy} onClick={handleSubmit}>Add spend</Button></>}
    >
      <div className="space-y-4">
        <Field label="Card"><Select value={cardId} onChange={(e) => setCardId(e.target.value)}>{activeCards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount"><Input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" autoFocus /></Field>
          <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Merchant"><Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Amazon" /></Field>
          <Field label="Category"><Select value={category} onChange={(e) => setCategory(e.target.value as SpendCategory)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </div>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
