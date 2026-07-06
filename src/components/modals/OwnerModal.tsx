import { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';
import type { Owner, Relationship } from '@/types';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useToast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button, Field, Input, Select, Switch, Textarea } from '@/components/ui/primitives';
import { Avatar } from '@/components/ui/feedback';
import { saveOwner } from '@/lib/repo';
import { readFileAsDataURL } from '@/lib/utils';

const RELATIONSHIPS: Relationship[] = ['Self', 'Family', 'Employee', 'Friend', 'Business'];
const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#f43f5e', '#14b8a6'];

export function OwnerModal() {
  const { ownerModal, closeOwnerModal } = useUI();
  const { owners } = useData();
  const toast = useToast();
  const editing = ownerModal.id ? owners.find((o) => o.id === ownerModal.id) : undefined;

  const [form, setForm] = useState<Partial<Owner>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ownerModal.open) return;
    setError('');
    setForm(editing ?? { relationship: 'Family', color: COLORS[Math.floor(Math.random() * COLORS.length)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerModal.open, ownerModal.id]);

  const set = <K extends keyof Owner>(k: K, v: Owner[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setError('');
    if (!form.name?.trim()) return setError('Name is required.');
    setBusy(true);
    try {
      await saveOwner({
        id: editing?.id,
        name: form.name.trim(),
        relationship: (form.relationship as Relationship) ?? 'Family',
        color: form.color ?? COLORS[0],
        phone: form.phone, email: form.email, department: form.department, notes: form.notes,
        photo: form.photo, favorite: form.favorite,
      });
      toast.success(editing ? 'Person updated' : 'Person added', form.name);
      closeOwnerModal();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={ownerModal.open}
      onClose={closeOwnerModal}
      title={editing ? 'Edit person' : 'Add a person'}
      description="People can own multiple cards."
      footer={<><Button onClick={closeOwnerModal}>Cancel</Button><Button variant="primary" loading={busy} onClick={handleSubmit}>{editing ? 'Save' : 'Add person'}</Button></>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar name={form.name || '?'} src={form.photo} color={form.color} size={64} />
          <div className="flex-1">
            <div className="mb-2 flex gap-1.5">
              {COLORS.map((c) => (
                <button key={c} onClick={() => set('color', c)} style={{ background: c }} className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-surface transition ${form.color === c ? 'ring-fg' : 'ring-transparent'}`} />
              ))}
            </div>
            {form.photo ? (
              <Button size="sm" variant="ghost" onClick={() => set('photo', undefined as any)}><X size={14} /> Remove photo</Button>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm text-accent hover:underline">
                <Upload size={14} /> Upload photo
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('photo', await readFileAsDataURL(f)); }} />
              </label>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Full name" className="col-span-2"><Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Priya Shaw" autoFocus /></Field>
          <Field label="Relationship"><Select value={form.relationship ?? 'Family'} onChange={(e) => set('relationship', e.target.value as Relationship)}>{RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Department (optional)"><Input value={form.department ?? ''} onChange={(e) => set('department', e.target.value)} placeholder="Operations" /></Field>
          <Field label="Phone"><Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98200 11223" /></Field>
          <Field label="Email"><Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="name@email.com" /></Field>
        </div>
        <Field label="Notes"><Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth noting" /></Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted"><Switch checked={!!form.favorite} onChange={(v) => set('favorite', v)} /> Mark as favourite</label>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  );
}
