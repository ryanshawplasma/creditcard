import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Vault, PanelLeftClose, PanelLeft, Lock, Plus } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { useData } from '@/store/data';
import { Avatar } from '@/components/ui/feedback';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const { sidebarCollapsed, setSidebarCollapsed, openCardModal } = useUI();
  const { user, lock } = useAuth();
  const { dueItems } = useData();
  const overdue = dueItems.filter((d) => d.status === 'overdue').length;
  const dueSoon = dueItems.filter((d) => d.status === 'today' || d.status === 'soon').length;

  const width = sidebarCollapsed ? 76 : 248;

  return (
    <motion.aside
      animate={{ width }}
      transition={{ type: 'spring', stiffness: 300, damping: 32 }}
      className="relative z-20 flex h-full flex-col border-r border-border bg-surface/60 backdrop-blur-xl"
    >
      {/* Brand */}
      <div className={cn('flex h-16 items-center gap-2.5 px-4', sidebarCollapsed && 'justify-center px-0')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg shadow-glow">
          <Vault size={19} />
        </div>
        {!sidebarCollapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">CreditVault<span className="text-accent"> AI</span></p>
            <p className="truncate text-[11px] text-subtle">Liability manager</p>
          </div>
        )}
      </div>

      {/* Quick add */}
      <div className="px-3 pb-2">
        <button
          onClick={() => openCardModal()}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl bg-accent/12 px-3 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 focus-ring',
            sidebarCollapsed && 'justify-center px-0',
          )}
        >
          <Plus size={17} />
          {!sidebarCollapsed && 'Add card'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2 no-scrollbar">
        {NAV_ITEMS.map((item) => {
          const badge = item.to === '/reminders' ? overdue || dueSoon : item.to === '/' ? overdue : 0;
          const badgeTone = item.to === '/reminders' && overdue ? 'bg-danger' : 'bg-accent';
          return (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} title={sidebarCollapsed ? item.label : undefined}>
              {({ isActive }) => (
                <div
                  className={cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                    sidebarCollapsed && 'justify-center px-0',
                    isActive ? 'text-fg' : 'text-muted hover:text-fg hover:bg-surface-2',
                  )}
                >
                  {isActive && (
                    <motion.div layoutId="nav-active" className="absolute inset-0 rounded-xl bg-surface-2 border border-border" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                  )}
                  <item.icon size={19} className={cn('relative z-10 shrink-0', isActive && 'text-accent')} />
                  {!sidebarCollapsed && <span className="relative z-10 flex-1 truncate">{item.label}</span>}
                  {!sidebarCollapsed && badge > 0 && (
                    <span className={cn('relative z-10 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white', badgeTone)}>{badge}</span>
                  )}
                  {sidebarCollapsed && badge > 0 && (
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
        <div className={cn('flex items-center gap-2.5 rounded-xl p-2', sidebarCollapsed && 'justify-center')}>
          <Avatar name={user?.displayName ?? 'User'} color="rgb(var(--accent))" size={34} />
          {!sidebarCollapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user?.displayName}</p>
              <p className="truncate text-[11px] text-subtle">@{user?.username}</p>
            </div>
          )}
          {!sidebarCollapsed && (
            <button onClick={lock} title="Lock vault" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg">
              <Lock size={15} />
            </button>
          )}
        </div>
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={cn('mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-subtle hover:bg-surface-2 hover:text-fg', sidebarCollapsed && 'justify-center px-0')}
        >
          {sidebarCollapsed ? <PanelLeft size={16} /> : <><PanelLeftClose size={16} /> Collapse</>}
        </button>
      </div>
    </motion.aside>
  );
}
