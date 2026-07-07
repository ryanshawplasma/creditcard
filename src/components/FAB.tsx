import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, CreditCard, Wallet, Users, Receipt, Sparkles } from 'lucide-react';
import { useUI } from '@/store/ui';

export function FAB() {
  const { openCardModal, openPaymentModal, openOwnerModal, openTxnModal, openSmartImport } = useUI();
  const [open, setOpen] = useState(false);

  const actions = [
    { label: 'Smart add card', icon: Sparkles, run: () => openSmartImport() },
    { label: 'Add card', icon: CreditCard, run: () => openCardModal() },
    { label: 'Record payment', icon: Wallet, run: () => openPaymentModal() },
    { label: 'Add spend', icon: Receipt, run: () => openTxnModal() },
    { label: 'Add person', icon: Users, run: () => openOwnerModal() },
  ];

  return (
    <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-5 z-40 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
      <AnimatePresence>
        {open && (
          <motion.div initial="hidden" animate="show" exit="hidden" className="flex flex-col items-end gap-2.5">
            {actions.map((a, i) => (
              <motion.button
                key={a.label}
                variants={{ hidden: { opacity: 0, y: 12, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1 } }}
                transition={{ delay: i * 0.04 }}
                onClick={() => { a.run(); setOpen(false); }}
                className="flex items-center gap-2.5 rounded-full glass-strong py-2 pl-4 pr-2 shadow-lift"
              >
                <span className="text-sm font-medium text-fg">{a.label}</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent"><a.icon size={16} /></span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-glow"
        aria-label="Quick actions"
      >
        <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
          <Plus size={26} />
        </motion.span>
      </motion.button>
    </div>
  );
}
