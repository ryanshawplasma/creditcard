import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, CreditCard, CalendarDays, Wallet, Menu } from 'lucide-react';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/cards', label: 'Cards', icon: CreditCard, end: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
  { to: '/payments', label: 'Pay', icon: Wallet, end: false },
];

/** Native-style bottom tab bar — mobile only (hidden from `lg` up). */
export function BottomNav() {
  const { setMobileNavOpen, mobileNavOpen } = useUI();
  const { dueItems } = useData();
  const overdue = dueItems.filter((d) => d.status === 'overdue').length;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-surface/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] lg:hidden">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="relative flex-1" onClick={() => setMobileNavOpen(false)}>
          {({ isActive }) => (
            <div className={cn('flex flex-col items-center justify-center gap-1 pb-1.5 pt-2 transition-colors', isActive ? 'text-accent' : 'text-muted')}>
              {isActive && (
                <motion.span layoutId="tab-active" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <div className="relative">
                <t.icon size={22} />
                {t.to === '/payments' && overdue > 0 && (
                  <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
                )}
              </div>
              <span className="text-[10px] font-medium leading-none">{t.label}</span>
            </div>
          )}
        </NavLink>
      ))}
      <button
        onClick={() => setMobileNavOpen(true)}
        className={cn('flex flex-1 flex-col items-center justify-center gap-1 pb-1.5 pt-2 transition-colors', mobileNavOpen ? 'text-accent' : 'text-muted')}
      >
        <Menu size={22} />
        <span className="text-[10px] font-medium leading-none">More</span>
      </button>
    </nav>
  );
}
