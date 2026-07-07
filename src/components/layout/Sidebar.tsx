import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Vault, PanelLeftClose, PanelLeft, Lock, Plus, X } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { useMediaQuery } from '@/lib/hooks';
import { Avatar } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, mobileNavOpen, setMobileNavOpen, openCardModal } = useUI();
  const { user, lock } = useAuth();
  const { dueItems } = useData();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const overdue = dueItems.filter((d) => d.status === 'overdue').length;
  const dueSoon = dueItems.filter((d) => d.status === 'today' || d.status === 'soon').length;

  // Icon-only collapse is a desktop-only affordance; on mobile the drawer is
  // always full width so labels stay visible.
  const iconOnly = sidebarCollapsed && isDesktop;
  const closeMobile = () => setMobileNavOpen(false);

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeMobile}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-border bg-surface/95 backdrop-blur-xl transition-[transform,width] duration-300 ease-out lg:static lg:z-20 lg:bg-surface/60',
          'w-[264px]',
          iconOnly ? 'lg:w-[76px]' : 'lg:w-[248px]',
          mobileNavOpen ? 'translate-x-0 shadow-lift' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className={cn('flex h-16 items-center gap-2.5 px-4', iconOnly && 'lg:justify-center lg:px-0')}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-glow">
            <Vault size={19} />
          </div>
          {!iconOnly && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold leading-tight">CreditVault<span className="text-accent"> AI</span></p>
              <p className="truncate text-[11px] text-subtle">Liability manager</p>
            </div>
          )}
          {/* Close button (mobile only) */}
          <button onClick={closeMobile} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg lg:hidden">
            <X size={18} />
          </button>
        </div>

        {/* Quick add */}
        <div className="px-3 pb-2">
          <button
            onClick={() => { openCardModal(); closeMobile(); }}
            className={cn(
              'flex w-full items-center gap-2 rounded-xl bg-accent/12 px-3 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 focus-ring',
              iconOnly && 'lg:justify-center lg:px-0',
            )}
          >
            <Plus size={17} />
            {!iconOnly && 'Add card'}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 no-scrollbar">
          {NAV_ITEMS.map((item) => {
            const badge = item.to === '/reminders' ? overdue || dueSoon : item.to === '/' ? overdue : 0;
            const badgeTone = item.to === '/reminders' && overdue ? 'bg-danger' : 'bg-accent';
            return (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={closeMobile} title={iconOnly ? item.label : undefined}>
                {({ isActive }) => (
                  <div
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      iconOnly && 'lg:justify-center lg:px-0',
                      isActive ? 'text-fg' : 'text-muted hover:text-fg hover:bg-surface-2',
                    )}
                  >
                    {isActive && (
                      <motion.div layoutId="nav-active" className="absolute inset-0 rounded-xl bg-surface-2 border border-border" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                    )}
                    <item.icon size={19} className={cn('relative z-10 shrink-0', isActive && 'text-accent')} />
                    {!iconOnly && <span className="relative z-10 flex-1 truncate">{item.label}</span>}
                    {!iconOnly && badge > 0 && (
                      <span className={cn('relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white', badgeTone)}>{badge}</span>
                    )}
                    {iconOnly && badge > 0 && (
                      <span className={cn('absolute right-2 top-1.5 z-10 h-2 w-2 rounded-full', badgeTone)} />
                    )}
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer: user + collapse */}
        <div className="border-t border-border p-3">
          <div className={cn('flex items-center gap-2.5 rounded-xl p-2', iconOnly && 'lg:justify-center')}>
            <Avatar name={user?.displayName ?? 'User'} color="rgb(var(--accent))" size={34} />
            {!iconOnly && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.displayName}</p>
                <p className="truncate text-[11px] text-subtle">@{user?.username}</p>
              </div>
            )}
            {!iconOnly && (
              <button onClick={lock} title="Lock vault" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
                <Lock size={15} />
              </button>
            )}
          </div>
          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={cn('mt-1 hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-subtle hover:bg-surface-2 hover:text-fg lg:flex', iconOnly && 'lg:justify-center lg:px-0')}
          >
            {iconOnly ? <PanelLeft size={16} /> : <><PanelLeftClose size={16} /> Collapse</>}
          </button>
        </div>
      </aside>
    </>
  );
}
