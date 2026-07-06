import { useEffect, useRef, type ReactNode } from 'react';
import { UIProvider } from '@/store/ui';
import { useData } from '@/store/data';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { DueBanner } from '@/components/DueBanner';
import { FAB } from '@/components/FAB';
import { CommandPalette } from '@/components/CommandPalette';
import { AIAssistant } from '@/components/AIAssistant';
import { CardModal } from '@/components/modals/CardModal';
import { SmartImportModal } from '@/components/modals/SmartImportModal';
import { PaymentModal } from '@/components/modals/PaymentModal';
import { OwnerModal } from '@/components/modals/OwnerModal';
import { TxnModal } from '@/components/modals/TxnModal';
import { activeReminders, notify } from '@/lib/reminders';

/** Fires desktop notifications for any live reminders, once per session key. */
function ReminderRunner() {
  const { dueItems, settings, dismissedKeys } = useData();
  const notified = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!settings.reminder.channels.includes('Desktop')) return;
    const live = activeReminders(dueItems, settings.reminder, dismissedKeys);
    for (const r of live.slice(0, 3)) {
      if (notified.current.has(r.key)) continue;
      notified.current.add(r.key);
      notify(`${r.severity === 'overdue' ? '⚠️ Overdue' : '🔔 Payment reminder'} — ${r.item.card.name}`, `${r.label}. Amount: ₹${r.item.amount.toLocaleString('en-IN')}.`);
    }
  }, [dueItems, settings, dismissedKeys]);

  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <UIProvider>
      <div className="flex h-full w-full overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <DueBanner />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>

      {/* Global overlays */}
      <FAB />
      <CommandPalette />
      <AIAssistant />
      <CardModal />
      <SmartImportModal />
      <PaymentModal />
      <OwnerModal />
      <TxnModal />
      <ReminderRunner />
    </UIProvider>
  );
}
