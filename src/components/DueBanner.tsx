import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { money } from '@/lib/format';

/** The "Upcoming Due Banner" — always surfaces the single most urgent thing. */
export function DueBanner() {
  const { dueItems } = useData();
  const { openPaymentModal } = useUI();

  const overdue = dueItems.filter((d) => d.status === 'overdue');
  const today = dueItems.filter((d) => d.status === 'today');
  const urgent = overdue[0] ?? today[0];
  if (!urgent) return null;

  const isOverdue = urgent.status === 'overdue';
  const count = isOverdue ? overdue.length : today.length;
  const total = (isOverdue ? overdue : today).reduce((s, d) => s + d.amount, 0);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        className="px-6 pt-4"
      >
        <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${isOverdue ? 'border-danger/30 bg-danger/10' : 'border-warning/30 bg-warning/10'}`}>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isOverdue ? 'bg-danger/20 text-danger' : 'bg-warning/20 text-warning'}`}>
            {isOverdue ? <AlertTriangle size={18} /> : <Clock size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-semibold ${isOverdue ? 'text-danger' : 'text-warning'}`}>
              {isOverdue
                ? `${count} payment${count > 1 ? 's' : ''} overdue — ${money(total)} needs attention`
                : `${count} payment${count > 1 ? 's' : ''} due today — ${money(total)}`}
            </p>
            <p className="truncate text-xs text-muted">
              {urgent.card.name} · {urgent.owner?.name} · {money(urgent.amount)} {isOverdue ? `(${Math.abs(urgent.daysUntil)}d late)` : 'due today'}
            </p>
          </div>
          <button
            onClick={() => openPaymentModal(urgent.card.id)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white transition ${isOverdue ? 'bg-danger hover:brightness-110' : 'bg-warning hover:brightness-110'}`}
          >
            Pay now <ArrowRight size={15} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
