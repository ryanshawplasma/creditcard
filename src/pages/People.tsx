import { useMemo, useState } from 'react';
import { Plus, Search, Phone, Mail, Pencil, Trash2, Star, Users } from 'lucide-react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useToast } from '@/components/ui/Toast';
import { Page, PageHeader, Stagger, StaggerItem } from '@/components/ui/Page';
import { Button, Badge, Input } from '@/components/ui/primitives';
import { Avatar, EmptyState, ProgressBar } from '@/components/ui/feedback';
import { Sheet } from '@/components/ui/Modal';
import { money, percent, CARD_GRADIENTS } from '@/lib/format';
import { utilization } from '@/lib/analytics';
import { maskCardNumber } from '@/lib/crypto';
import { deleteOwner } from '@/lib/repo';

export function PeoplePage() {
  const { owners, cards } = useData();
  const { openOwnerModal, openCardModal } = useUI();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const stats = useMemo(() => {
    const map: Record<string, { count: number; outstanding: number; limit: number }> = {};
    for (const o of owners) map[o.id] = { count: 0, outstanding: 0, limit: 0 };
    for (const c of cards) {
      if (!map[c.ownerId]) continue;
      map[c.ownerId].count++;
      map[c.ownerId].outstanding += c.currentBalance;
      map[c.ownerId].limit += c.creditLimit;
    }
    return map;
  }, [owners, cards]);

  const filtered = owners
    .filter((o) => `${o.name} ${o.relationship} ${o.email ?? ''} ${o.phone ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (stats[b.id]?.outstanding ?? 0) - (stats[a.id]?.outstanding ?? 0));

  const selectedOwner = selected ? owners.find((o) => o.id === selected) : undefined;
  const selectedCards = selected ? cards.filter((c) => c.ownerId === selected) : [];

  return (
    <Page>
      <PageHeader
        title="People"
        subtitle={`${owners.length} people · one owner can hold many cards`}
        actions={<Button variant="primary" onClick={() => openOwnerModal()}><Plus size={16} /> Add person</Button>}
      />

      <div className="relative mb-5 max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, phone, email, relationship…" className="pl-9" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users size={26} />} title="No people yet" description="Add family members, employees or friends to assign their cards." action={<Button variant="primary" onClick={() => openOwnerModal()}><Plus size={16} /> Add person</Button>} />
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o) => {
            const s = stats[o.id] ?? { count: 0, outstanding: 0, limit: 0 };
            const util = s.limit ? (s.outstanding / s.limit) * 100 : 0;
            return (
              <StaggerItem key={o.id}>
                <button onClick={() => setSelected(o.id)} className="card-surface w-full p-5 text-left transition hover:border-border-strong">
                  <div className="flex items-center gap-3">
                    <Avatar name={o.name} src={o.photo} color={o.color} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-semibold">{o.name} {o.favorite && <Star size={12} className="fill-accent text-accent" />}</p>
                      <Badge tone="neutral">{o.relationship}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div><p className="text-[11px] text-muted">Cards</p><p className="text-lg font-bold tabular-nums">{s.count}</p></div>
                    <div><p className="text-[11px] text-muted">Outstanding</p><p className="text-lg font-bold tabular-nums">{money(s.outstanding, { compact: true })}</p></div>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={util} />
                    <p className="mt-1 text-[11px] text-subtle">{percent(util)} utilization</p>
                  </div>
                </button>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <Sheet open={!!selectedOwner} onClose={() => setSelected(null)} title={selectedOwner?.name}>
        {selectedOwner && (
          <div className="space-y-5 p-5">
            <div className="flex items-center gap-4">
              <Avatar name={selectedOwner.name} src={selectedOwner.photo} color={selectedOwner.color} size={64} />
              <div>
                <p className="text-lg font-semibold">{selectedOwner.name}</p>
                <Badge tone="accent">{selectedOwner.relationship}</Badge>
                {selectedOwner.department && <span className="ml-1 text-xs text-muted">· {selectedOwner.department}</span>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {selectedOwner.phone && <ContactRow icon={<Phone size={15} />} value={selectedOwner.phone} href={`tel:${selectedOwner.phone}`} />}
              {selectedOwner.email && <ContactRow icon={<Mail size={15} />} value={selectedOwner.email} href={`mailto:${selectedOwner.email}`} />}
            </div>
            {selectedOwner.notes && <p className="rounded-xl border border-border bg-surface-2 p-3 text-sm text-muted">{selectedOwner.notes}</p>}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { const id = selectedOwner.id; setSelected(null); openOwnerModal(id); }}><Pencil size={15} /> Edit</Button>
              <Button variant="danger" onClick={async () => { try { await deleteOwner(selectedOwner.id); toast.success('Person removed'); setSelected(null); } catch (e) { toast.error('Cannot delete', (e as Error).message); } }}><Trash2 size={15} /></Button>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Cards ({selectedCards.length})</h4>
                <button onClick={() => openCardModal()} className="text-xs text-accent hover:underline">＋ Assign card</button>
              </div>
              <div className="space-y-2">
                {selectedCards.length === 0 && <p className="text-xs text-subtle">No cards assigned yet.</p>}
                {selectedCards.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
                    <div className="flex h-8 w-12 items-center justify-center rounded-md text-xs" style={{ background: CARD_GRADIENTS[c.color] }}>{c.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-subtle">{maskCardNumber(c.last4)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{money(c.currentBalance)}</p>
                      <p className="text-[11px] text-subtle">{percent(utilization(c))}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </Page>
  );
}

function ContactRow({ icon, value, href }: { icon: React.ReactNode; value: string; href: string }) {
  return (
    <a href={href} className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm text-muted transition hover:text-fg">
      <span className="text-accent">{icon}</span> {value}
    </a>
  );
}
