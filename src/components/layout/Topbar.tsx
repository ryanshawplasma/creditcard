import { useLocation } from 'react-router-dom';
import { Search, Command, Sparkles, Sun, Moon, Wallet, Bell, Menu } from 'lucide-react';
import { PAGE_TITLES } from './nav';
import { useUI } from '@/store/ui';
import { useTheme } from '@/store/theme';
import { useData } from '@/store/data';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function Topbar() {
  const { pathname } = useLocation();
  const { setCommandOpen, setAiOpen, openPaymentModal, setMobileNavOpen } = useUI();
  const { theme, toggleTheme } = useTheme();
  const { dueItems } = useData();
  const title = PAGE_TITLES[pathname] ?? 'CreditVault AI';
  const overdue = dueItems.filter((d) => d.status === 'overdue').length;

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-surface/40 px-3 backdrop-blur-xl sm:gap-3 sm:px-5">
      {/* Hamburger — mobile only */}
      <button
        onClick={() => setMobileNavOpen(true)}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg focus-ring lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <h1 className="hidden shrink-0 text-lg font-semibold tracking-tight sm:block">{title}</h1>

      <div className="mx-auto w-full max-w-md sm:px-4">
        <button
          onClick={() => setCommandOpen(true)}
          className="group flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-sm text-subtle transition hover:border-border-strong hover:text-muted focus-ring"
        >
          <Search size={16} className="shrink-0" />
          <span className="flex-1 truncate text-left"><span className="sm:hidden">Search…</span><span className="hidden sm:inline">Search cards, people, payments…</span></span>
          <kbd className="hidden items-center gap-0.5 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[10px] font-medium text-subtle sm:flex">
            <Command size={10} /> K
          </kbd>
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <Button variant="secondary" size="sm" onClick={() => openPaymentModal()} className="hidden md:inline-flex">
          <Wallet size={15} /> Record payment
        </Button>
        <button
          onClick={() => setAiOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-accent/12 px-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 focus-ring"
          aria-label="Ask AI"
        >
          <Sparkles size={16} /> <span className="hidden lg:inline">Ask AI</span>
        </button>
        <div className="relative">
          <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg focus-ring" title="Reminders">
            <Bell size={18} />
          </button>
          {overdue > 0 && <span className={cn('absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-surface')} />}
        </div>
        <button onClick={toggleTheme} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-fg focus-ring" title="Toggle theme">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}
