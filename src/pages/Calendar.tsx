import { useMemo, useState } from 'react';
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth,
  isToday, lastDayOfMonth, setDate, startOfMonth, startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { Page, PageHeader } from '@/components/ui/Page';
import { Button, Badge } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/Modal';
import { money, CARD_GRADIENTS } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Card } from '@/types';

type EventKind = 'due' | 'billing' | 'statement' | 'fee' | 'emi';
interface CalEvent { kind: EventKind; card: Card; amount?: number; label: string }

const KIND_META: Record<EventKind, { label: string; dot: string; badge: 'danger' | 'accent' | 'info' | 'warning' | 'success' }> = {
  due: { label: 'Payment due', dot: 'bg-danger', badge: 'danger' },
  billing: { label: 'Billing date', dot: 'bg-accent', badge: 'accent' },
  statement: { label: 'Statement generated', dot: 'bg-info', badge: 'info' },
  fee: { label: 'Annual fee', dot: 'bg-warning', badge: 'warning' },
  emi: { label: 'EMI instalment', dot: 'bg-success', badge: 'success' },
};

function clampDay(day: number, ref: Date) {
  return setDate(ref, Math.min(day, lastDayOfMonth(ref).getDate()));
}

export function CalendarPage() {
  const { cards, emis } = useData();
  const { openPaymentModal } = useUI();
  const [cursor, setCursor] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const active = cards.filter((c) => c.status === 'Active');

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    const monthRef = cursor;
    const push = (d: Date, ev: CalEvent) => {
      const key = format(d, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    };
    for (const c of active) {
      push(clampDay(c.dueDay, monthRef), { kind: 'due', card: c, amount: c.currentBalance, label: c.name });
      push(clampDay(c.billingDay, monthRef), { kind: 'billing', card: c, label: c.name });
      push(clampDay(c.statementDay, monthRef), { kind: 'statement', card: c, label: c.name });
      if (c.annualFee && c.annualFeeMonth === monthRef.getMonth() + 1) {
        push(clampDay(1, monthRef), { kind: 'fee', card: c, amount: c.annualFee, label: `${c.name} fee` });
      }
    }
    for (const e of emis) {
      if (e.paidMonths >= e.totalMonths) continue;
      const card = cards.find((c) => c.id === e.cardId);
      if (!card) continue;
      const startDay = new Date(e.startDate).getDate();
      push(clampDay(startDay, monthRef), { kind: 'emi', card, amount: e.monthlyAmount, label: e.description });
    }
    return map;
  }, [active, emis, cards, cursor]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const selectedEvents = selectedDay ? eventsByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? [] : [];

  return (
    <Page>
      <PageHeader
        title="Calendar"
        subtitle="Billing dates, due dates, EMIs and fees at a glance"
        actions={
          <div className="flex items-center gap-2">
            <Button size="icon" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft size={16} /></Button>
            <span className="w-36 text-center text-sm font-semibold">{format(cursor, 'MMMM yyyy')}</span>
            <Button size="icon" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight size={16} /></Button>
            <Button onClick={() => setCursor(new Date())} className="ml-1">Today</Button>
          </div>
        }
      />

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        {Object.entries(KIND_META).map(([k, m]) => (
          <span key={k} className="flex items-center gap-1.5 text-xs text-muted"><span className={cn('h-2 w-2 rounded-full', m.dot)} /> {m.label}</span>
        ))}
      </div>

      <div className="card-surface overflow-hidden p-2">
        <div className="grid grid-cols-7">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-subtle">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const evs = eventsByDay.get(format(day, 'yyyy-MM-dd')) ?? [];
            const inMonth = isSameMonth(day, cursor);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDay(day)}
                className={cn(
                  'min-h-[92px] rounded-xl border p-1.5 text-left transition',
                  inMonth ? 'border-border bg-surface hover:border-border-strong' : 'border-transparent bg-transparent opacity-40',
                  isToday(day) && 'ring-2 ring-accent/60',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium', isToday(day) ? 'bg-accent text-accent-fg' : 'text-muted')}>{format(day, 'd')}</span>
                </div>
                <div className="space-y-0.5">
                  {evs.slice(0, 3).map((ev, i) => (
                    <div key={i} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[10px]" style={{ background: 'rgb(var(--surface-2))' }}>
                      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', KIND_META[ev.kind].dot)} />
                      <span className="truncate text-muted">{ev.label}</span>
                    </div>
                  ))}
                  {evs.length > 3 && <p className="px-1 text-[10px] text-subtle">+{evs.length - 3} more</p>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Sheet open={!!selectedDay} onClose={() => setSelectedDay(null)} title={selectedDay ? format(selectedDay, 'EEEE, dd MMMM yyyy') : ''}>
        <div className="space-y-3 p-5">
          {selectedEvents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <CalendarDays size={26} className="text-subtle" />
              <p className="text-sm text-muted">Nothing scheduled on this day.</p>
            </div>
          ) : (
            selectedEvents.map((ev, i) => {
              const meta = KIND_META[ev.kind];
              return (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3">
                  <div className="flex h-9 w-14 items-center justify-center rounded-lg text-sm" style={{ background: CARD_GRADIENTS[ev.card.color] }}>{ev.card.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ev.card.name}</p>
                    <Badge tone={meta.badge}>{meta.label}</Badge>
                  </div>
                  <div className="text-right">
                    {ev.amount !== undefined && <p className="text-sm font-semibold tabular-nums">{money(ev.amount)}</p>}
                    {ev.kind === 'due' && ev.amount ? (
                      <button onClick={() => openPaymentModal(ev.card.id)} className="text-xs text-accent hover:underline">Pay now</button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Sheet>
    </Page>
  );
}
