import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, CreditCard, Users, Wallet, Plus, Moon, Sun, Lock, Sparkles, CornerDownLeft, ArrowUp, ArrowDown,
} from 'lucide-react';
import { useUI } from '@/store/ui';
import { useData } from '@/store/data';
import { useTheme } from '@/store/theme';
import { useAuth } from '@/store/auth';
import { NAV_ITEMS } from './layout/nav';
import { money } from '@/lib/format';
import { maskCardNumber } from '@/lib/crypto';
import { cn } from '@/lib/utils';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ReactNode;
  keywords?: string;
  run: () => void;
}

export function CommandPalette() {
  const { commandOpen, setCommandOpen, openCardModal, openPaymentModal, openOwnerModal, setAiOpen } = useUI();
  const { cards, owners, banks, ownersById } = useData();
  const { toggleTheme } = useTheme();
  const { lock } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Global Ctrl/Cmd+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setCommandOpen]);

  useEffect(() => {
    if (commandOpen) { setQuery(''); setActive(0); }
  }, [commandOpen]);

  const commands = useMemo<Cmd[]>(() => {
    const close = () => setCommandOpen(false);
    const actions: Cmd[] = [
      { id: 'add-card', label: 'Add a card', group: 'Actions', icon: <Plus size={16} />, keywords: 'new create', run: () => { close(); openCardModal(); } },
      { id: 'record-payment', label: 'Record a payment', group: 'Actions', icon: <Wallet size={16} />, keywords: 'pay', run: () => { close(); openPaymentModal(); } },
      { id: 'add-person', label: 'Add a person', group: 'Actions', icon: <Users size={16} />, keywords: 'owner', run: () => { close(); openOwnerModal(); } },
      { id: 'ask-ai', label: 'Ask the AI assistant', group: 'Actions', icon: <Sparkles size={16} />, keywords: 'chat question', run: () => { close(); setAiOpen(true); } },
      { id: 'theme', label: 'Toggle dark / light theme', group: 'Actions', icon: <Sun size={16} />, run: () => { close(); toggleTheme(); } },
      { id: 'lock', label: 'Lock vault', group: 'Actions', icon: <Lock size={16} />, run: () => { close(); lock(); } },
    ];
    const nav: Cmd[] = NAV_ITEMS.map((n) => ({
      id: `nav-${n.to}`, label: `Go to ${n.label}`, group: 'Navigate', icon: <n.icon size={16} />,
      run: () => { close(); navigate(n.to); },
    }));
    const cardCmds: Cmd[] = cards.map((c) => ({
      id: `card-${c.id}`, label: c.name, hint: `${maskCardNumber(c.last4)} · ${money(c.currentBalance)}`,
      group: 'Cards', icon: <CreditCard size={16} />, keywords: `${c.last4} ${banks.find((b) => b.id === c.bankId)?.name} ${ownersById[c.ownerId]?.name}`,
      run: () => { close(); navigate('/cards'); setTimeout(() => openCardModal(c.id), 60); },
    }));
    const ownerCmds: Cmd[] = owners.map((o) => ({
      id: `owner-${o.id}`, label: o.name, hint: o.relationship, group: 'People', icon: <Users size={16} />,
      keywords: `${o.phone} ${o.email}`,
      run: () => { close(); navigate('/people'); setTimeout(() => openOwnerModal(o.id), 60); },
    }));
    return [...actions, ...nav, ...cardCmds, ...ownerCmds];
  }, [cards, owners, banks, ownersById, setCommandOpen, openCardModal, openPaymentModal, openOwnerModal, setAiOpen, toggleTheme, lock, navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''} ${c.group}`.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => setActive(0), [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Cmd[]>();
    filtered.forEach((c) => { if (!map.has(c.group)) map.set(c.group, []); map.get(c.group)!.push(c); });
    return Array.from(map);
  }, [filtered]);

  const flat = filtered;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); flat[active]?.run(); }
    else if (e.key === 'Escape') setCommandOpen(false);
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return createPortal(
    <AnimatePresence>
      {commandOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCommandOpen(false)} className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl glass-strong shadow-lift"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search size={18} className="text-subtle" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search or type a command…"
                className="h-14 flex-1 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none"
              />
              <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-subtle">ESC</kbd>
            </div>
            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
              {flat.length === 0 && <p className="py-10 text-center text-sm text-subtle">No results for “{query}”.</p>}
              {grouped.map(([group, items]) => (
                <div key={group} className="mb-1">
                  <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">{group}</p>
                  {items.map((c) => {
                    const idx = flat.indexOf(c);
                    return (
                      <button
                        key={c.id}
                        data-idx={idx}
                        onMouseEnter={() => setActive(idx)}
                        onClick={c.run}
                        className={cn('flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-sm transition', idx === active ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-surface-2')}
                      >
                        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2', idx === active && 'text-accent')}>{c.icon}</span>
                        <span className="flex-1 truncate">{c.label}</span>
                        {c.hint && <span className="truncate text-xs text-subtle">{c.hint}</span>}
                        {idx === active && <CornerDownLeft size={14} className="text-subtle" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-subtle">
              <span className="flex items-center gap-1"><ArrowUp size={11} /><ArrowDown size={11} /> navigate</span>
              <span className="flex items-center gap-1"><CornerDownLeft size={11} /> select</span>
              <span className="ml-auto flex items-center gap-1"><Moon size={11} /> {flat.length} results</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
