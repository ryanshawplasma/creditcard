import { useMemo } from 'react';
import { Bell, BellOff, Check, Wallet, AlertTriangle, Clock, CalendarClock, BellRing } from 'lucide-react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useToast } from '@/components/ui/Toast';
import { Page, PageHeader } from '@/components/ui/Page';
import { Button, Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/feedback';
import { activeReminders, notify } from '@/lib/reminders';
import { dismissReminder } from '@/lib/repo';
import { money, fmtDate, relativeDays, CARD_GRADIENTS } from '@/lib/format';
import { cn } from '@/lib/utils';

export function RemindersPage() {
  const { dueItems, settings, dismissedKeys, ownersById } = useData();
  const { openPaymentModal } = useUI();
  const toast = useToast();

  const reminders = useMemo(
    () => activeReminders(dueItems, settings.reminder, dismissedKeys),
    [dueItems, settings.reminder, dismissedKeys],
  );

  const overdue = reminders.filter((r) => r.severity === 'overdue');
  const today = reminders.filter((r) => r.severity === 'today');
  const upcoming = reminders.filter((r) => r.severity === 'warn' || r.severity === 'info');

  const upcomingSchedule = useMemo(
    () => [...dueItems].filter((d) => d.daysUntil >= 0).sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 8),
    [dueItems],
  );

  async function testNotification() {
    await notify('🔔 CreditVault AI', 'Notifications are working — you’ll be reminded before every due date.');
    toast.info('Test notification sent', 'Check your desktop notifications.');
  }

  const sections = [
    { key: 'overdue', title: 'Overdue', icon: AlertTriangle, items: overdue, tone: 'danger' as const },
    { key: 'today', title: 'Due today', icon: Clock, items: today, tone: 'warning' as const },
    { key: 'upcoming', title: 'Upcoming', icon: CalendarClock, items: upcoming, tone: 'accent' as const },
  ];

  return (
    <Page>
      <PageHeader
        title="Reminders"
        subtitle={`Alerts at ${settings.reminder.offsets.join(', ')} days before · ${settings.reminder.channels.join(', ')}`}
        actions={<Button onClick={testNotification}><BellRing size={16} /> Test notification</Button>}
      />

      {reminders.length === 0 ? (
        <EmptyState icon={<BellOff size={26} />} title="You’re all caught up" description="No active reminders. We’ll alert you as due dates approach." />
      ) : (
        <div className="space-y-6">
          {sections.map((s) => s.items.length > 0 && (
            <div key={s.key}>
              <div className="mb-2.5 flex items-center gap-2">
                <s.icon size={17} className={cn(s.tone === 'danger' ? 'text-danger' : s.tone === 'warning' ? 'text-warning' : 'text-accent')} />
                <h3 className="text-sm font-semibold">{s.title}</h3>
                <Badge tone={s.tone}>{s.items.length}</Badge>
              </div>
              <div className="space-y-2">
                {s.items.map((r) => (
                  <div key={r.key} className={cn('flex items-center gap-3 rounded-2xl border p-3.5', s.tone === 'danger' ? 'border-danger/25 bg-danger/5' : s.tone === 'warning' ? 'border-warning/25 bg-warning/5' : 'border-border bg-surface')}>
                    <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg text-sm" style={{ background: CARD_GRADIENTS[r.item.card.color] }}>{r.item.card.icon}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.item.card.name}</p>
                      <p className="truncate text-xs text-subtle">{ownersById[r.item.card.ownerId]?.name} · {r.label} · due {fmtDate(r.item.dueDate, 'dd MMM')}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{money(r.item.amount)}</p>
                      <p className="text-[11px] text-subtle">min {money(r.item.minimumDue)}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="primary" onClick={() => openPaymentModal(r.item.card.id)}><Wallet size={14} /> Pay</Button>
                      <Button size="icon" title="Dismiss" onClick={async () => { await dismissReminder(r.item.card.id, r.item.dueDate, r.offset, r.key); toast.info('Reminder dismissed'); }}><Check size={15} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upcoming schedule timeline */}
      <div className="mt-8">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bell size={16} className="text-accent" /> Upcoming schedule</h3>
        <div className="card-surface p-5">
          {upcomingSchedule.length === 0 ? (
            <p className="text-sm text-subtle">No upcoming dues.</p>
          ) : (
            <div className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
              {upcomingSchedule.map((d) => (
                <div key={d.card.id} className="relative flex items-center gap-4 pl-6">
                  <span className={cn('absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-bg', d.status === 'today' ? 'bg-warning' : 'bg-accent')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.card.name}</p>
                    <p className="text-xs text-subtle">{ownersById[d.card.ownerId]?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{money(d.amount)}</p>
                    <p className="text-[11px] text-muted">{relativeDays(d.dueDate)} · {fmtDate(d.dueDate, 'dd MMM')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
