import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  TrendingUp, Wallet, CreditCard, Gift, ArrowUpRight, ArrowDownRight, Sparkles,
  AlertTriangle, Flame, PiggyBank, CalendarClock, Activity, ChevronRight, ShieldCheck,
} from 'lucide-react';
import { useData } from '@/store/data';
import { useUI } from '@/store/ui';
import { useAuth } from '@/store/auth';
import { Page, Stagger, StaggerItem } from '@/components/ui/Page';
import { Ring, ProgressBar } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/primitives';
import { CARD_GRADIENTS, money, relativeDays, percent } from '@/lib/format';
import { maskCardNumber } from '@/lib/crypto';
import { portfolioSummary, healthScore, monthlySpend, utilization } from '@/lib/analytics';
import { filterDue } from '@/lib/reminders';
import { cn } from '@/lib/utils';
import type { DueItem } from '@/types';

export function Dashboard() {
  const { cards, dueItems, payments, transactions, audit, ownersById } = useData();
  const { openPaymentModal, setAiOpen } = useUI();
  const { user } = useAuth();
  const navigate = useNavigate();

  const portfolio = useMemo(() => portfolioSummary(cards, dueItems), [cards, dueItems]);
  const health = useMemo(() => healthScore(cards, dueItems, payments), [cards, dueItems, payments]);
  const spend = useMemo(() => monthlySpend(transactions, 6), [transactions]);
  const due7 = filterDue(dueItems, 7);
  const due30 = filterDue(dueItems, 30);
  const overdue = dueItems.filter((d) => d.status === 'overdue');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const spendThisMonth = spend[spend.length - 1]?.amount ?? 0;
  const spendPrev = spend[spend.length - 2]?.amount ?? 0;
  const spendDelta = spendPrev ? ((spendThisMonth - spendPrev) / spendPrev) * 100 : 0;

  return (
    <Page>
      {/* Greeting */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h2 className="mt-0.5 text-2xl font-bold tracking-tight">
            {greeting}, {user?.displayName?.split(' ')[0]} 👋
          </h2>
        </div>
        <button onClick={() => setAiOpen(true)} className="group flex items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm shadow-soft transition hover:border-accent/50">
          <Sparkles size={16} className="text-accent" />
          <span className="text-muted group-hover:text-fg">Ask AI about your cards…</span>
        </button>
      </div>

      {/* Top stat tiles */}
      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StaggerItem>
          <StatTile
            label="Total outstanding" value={money(portfolio.totalOutstanding)} icon={Wallet} tone="accent"
            sub={`across ${portfolio.activeCards} active cards`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Available credit" value={money(portfolio.availableCredit)} icon={PiggyBank} tone="success"
            sub={`of ${money(portfolio.totalLimit, { compact: true })} total limit`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Credit utilization" value={percent(portfolio.overallUtilization)} icon={TrendingUp}
            tone={portfolio.overallUtilization >= 70 ? 'danger' : portfolio.overallUtilization >= 30 ? 'warning' : 'success'}
            sub={portfolio.overallUtilization > 30 ? 'above the 30% healthy mark' : 'within healthy range'}
          >
            <ProgressBar value={portfolio.overallUtilization} className="mt-2.5" />
          </StatTile>
        </StaggerItem>
        <StaggerItem>
          <StatTile
            label="Reward points" value={portfolio.totalRewardPoints.toLocaleString('en-IN')} icon={Gift} tone="info"
            sub="est. value ₹" delta={spendDelta}
          />
        </StaggerItem>
      </Stagger>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Upcoming payments */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold"><CalendarClock size={18} className="text-accent" /> Upcoming payments</h3>
              <p className="text-xs text-muted">What needs paying, sorted by urgency</p>
            </div>
            <button onClick={() => navigate('/payments')} className="flex items-center gap-1 text-sm text-accent hover:underline">View all <ChevronRight size={14} /></button>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2">
            <MiniStat label="Overdue" value={overdue.length} amount={overdue.reduce((s, d) => s + d.amount, 0)} tone="danger" />
            <MiniStat label="Next 7 days" value={due7.length} amount={due7.reduce((s, d) => s + d.amount, 0)} tone="warning" />
            <MiniStat label="Next 30 days" value={due30.length} amount={due30.reduce((s, d) => s + d.amount, 0)} tone="accent" />
          </div>

          <div className="space-y-1.5">
            {due30.length === 0 && overdue.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <ShieldCheck size={28} className="text-success" />
                <p className="text-sm text-muted">No payments due in the next 30 days. You’re all set.</p>
              </div>
            ) : (
              [...overdue, ...due30.filter((d) => d.status !== 'overdue')].slice(0, 6).map((item) => (
                <DueRow key={item.card.id} item={item} onPay={() => openPaymentModal(item.card.id)} ownerName={ownersById[item.card.ownerId]?.name} />
              ))
            )}
          </div>
        </motion.div>

        {/* Financial health */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card-surface p-5">
          <h3 className="flex items-center gap-2 text-base font-semibold"><Activity size={18} className="text-accent" /> Financial health</h3>
          <div className="mt-4 flex items-center gap-4">
            <Ring value={health.score} size={92} stroke={9}>
              <div className="text-center">
                <p className="text-2xl font-bold tabular-nums">{health.score}</p>
              </div>
            </Ring>
            <div>
              <Badge tone={health.grade === 'Excellent' || health.grade === 'Good' ? 'success' : health.grade === 'Fair' ? 'warning' : 'danger'}>{health.grade}</Badge>
              <p className="mt-2 text-xs text-muted">A blend of utilization, on-time payments, overdue items and fees.</p>
            </div>
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            {health.factors.slice(0, 4).map((f) => (
              <div key={f.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className={cn('h-1.5 w-1.5 rounded-full', f.positive ? 'bg-success' : 'bg-danger')} />
                  {f.label}
                </span>
                <span className={cn('font-medium tabular-nums', f.positive ? 'text-success' : 'text-danger')}>{f.impact > 0 ? '+' : ''}{f.impact}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Insights widgets */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <InsightWidget title="Cards near limit" icon={AlertTriangle} tone="danger" empty="No cards above 70%" onClick={() => navigate('/cards')}
          items={portfolio.nearLimit.slice(0, 3).map((c) => ({ id: c.id, name: c.name, right: percent(utilization(c)), color: c.color }))} />
        <InsightWidget title="Highest interest" icon={Flame} tone="warning" empty="No interest recorded" onClick={() => navigate('/cards')}
          items={portfolio.highestInterest ? [{ id: portfolio.highestInterest.id, name: portfolio.highestInterest.name, right: `${portfolio.highestInterest.interestRate}%`, color: portfolio.highestInterest.color }] : []} />
        <InsightWidget title="Largest balance" icon={Wallet} tone="accent" empty="All clear" onClick={() => navigate('/cards')}
          items={portfolio.largestBalance && portfolio.largestBalance.currentBalance > 0 ? [{ id: portfolio.largestBalance.id, name: portfolio.largestBalance.name, right: money(portfolio.largestBalance.currentBalance, { compact: true }), color: portfolio.largestBalance.color }] : []} />
        <InsightWidget title="Unused cards" icon={CreditCard} tone="success" empty="Every card is active" onClick={() => navigate('/cards')}
          items={portfolio.unusedCards.slice(0, 3).map((c) => ({ id: c.id, name: c.name, right: 'idle', color: c.color }))} />
      </div>

      {/* Spend chart + activity */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card-surface p-5 lg:col-span-2">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-base font-semibold">Monthly spending</h3>
            <span className={cn('flex items-center gap-1 text-xs font-medium', spendDelta >= 0 ? 'text-danger' : 'text-success')}>
              {spendDelta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {percent(Math.abs(spendDelta))} vs last month
            </span>
          </div>
          <p className="mb-3 text-2xl font-bold tabular-nums">{money(spendThisMonth)}</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spend} margin={{ left: -18, right: 6, top: 4 }}>
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => money(v, { compact: true })} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="amount" stroke="rgb(var(--accent))" strokeWidth={2.5} fill="url(#spendFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card-surface p-5">
          <h3 className="mb-3 text-base font-semibold">Recent activity</h3>
          <div className="space-y-3">
            {audit.slice(0, 7).map((log) => (
              <div key={log.id} className="flex items-start gap-2.5">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent/60" />
                <div className="min-w-0">
                  <p className="truncate text-xs text-fg">{humanizeAudit(log.action)}</p>
                  <p className="text-[11px] text-subtle">{relativeDays(log.at.slice(0, 10))} · {new Date(log.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
            ))}
            {audit.length === 0 && <p className="text-sm text-subtle">No activity yet.</p>}
          </div>
        </motion.div>
      </div>
    </Page>
  );
}

// ── Sub-components ────────────────────────────────────────
function StatTile({ label, value, icon: Icon, tone, sub, delta, children }: { label: string; value: string; icon: any; tone: 'accent' | 'success' | 'warning' | 'danger' | 'info'; sub?: string; delta?: number; children?: React.ReactNode }) {
  const toneBg = { accent: 'bg-accent/12 text-accent', success: 'bg-success/12 text-success', warning: 'bg-warning/12 text-warning', danger: 'bg-danger/12 text-danger', info: 'bg-info/12 text-info' }[tone];
  return (
    <div className="card-surface p-5">
      <div className="flex items-start justify-between">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', toneBg)}><Icon size={18} /></span>
        {delta !== undefined && (
          <span className={cn('flex items-center gap-0.5 text-xs font-medium', delta >= 0 ? 'text-success' : 'text-danger')}>
            {delta >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{percent(Math.abs(delta))}
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-xs font-medium text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-subtle">{sub}</p>}
      {children}
    </div>
  );
}

function MiniStat({ label, value, amount, tone }: { label: string; value: number; amount: number; tone: 'danger' | 'warning' | 'accent' }) {
  const c = { danger: 'text-danger', warning: 'text-warning', accent: 'text-accent' }[tone];
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', c)}>{value}</p>
      <p className="text-[11px] text-subtle">{money(amount, { compact: true })}</p>
    </div>
  );
}

function DueRow({ item, onPay, ownerName }: { item: DueItem; onPay: () => void; ownerName?: string }) {
  const toneColor = item.status === 'overdue' ? 'text-danger' : item.status === 'today' ? 'text-warning' : 'text-muted';
  return (
    <div className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-surface-2">
      <div className="h-9 w-14 shrink-0 rounded-lg" style={{ background: CARD_GRADIENTS[item.card.color] }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.card.name}</p>
        <p className="truncate text-xs text-subtle">{ownerName} · {maskCardNumber(item.card.last4).replace(/•/g, '·')}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums">{money(item.amount)}</p>
        <p className={cn('text-xs', toneColor)}>{item.status === 'overdue' ? `${Math.abs(item.daysUntil)}d late` : relativeDays(item.dueDate)}</p>
      </div>
      <button onClick={onPay} className="ml-1 rounded-lg bg-accent/12 px-2.5 py-1.5 text-xs font-medium text-accent opacity-0 transition group-hover:opacity-100">Pay</button>
    </div>
  );
}

function InsightWidget({ title, icon: Icon, tone, items, empty, onClick }: { title: string; icon: any; tone: 'danger' | 'warning' | 'accent' | 'success'; items: { id: string; name: string; right: string; color: string }[]; empty: string; onClick: () => void }) {
  const toneC = { danger: 'text-danger', warning: 'text-warning', accent: 'text-accent', success: 'text-success' }[tone];
  return (
    <button onClick={onClick} className="card-surface p-4 text-left transition hover:border-border-strong">
      <div className="mb-3 flex items-center gap-2">
        <Icon size={16} className={toneC} />
        <span className="text-sm font-medium">{title}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-subtle">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-2">
              <div className="h-5 w-8 shrink-0 rounded" style={{ background: CARD_GRADIENTS[it.color] }} />
              <span className="min-w-0 flex-1 truncate text-xs text-muted">{it.name}</span>
              <span className={cn('text-xs font-semibold tabular-nums', toneC)}>{it.right}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-elevated px-3 py-2 text-xs shadow-lift">
      <p className="font-medium text-fg">{label}</p>
      <p className="text-muted">{money(payload[0].value)}</p>
    </div>
  );
}

function humanizeAudit(action: string): string {
  const map: Record<string, string> = {
    'account.create': 'Vault created',
    'login.success': 'Signed in',
    'login.failed': 'Failed sign-in attempt',
    'logout': 'Signed out',
    'session.autolock': 'Vault auto-locked',
    'card.create': 'Added a new card',
    'card.update': 'Updated a card',
    'card.delete': 'Removed a card',
    'card.status': 'Changed card status',
    'payment.record': 'Recorded a payment',
    'payment.delete': 'Deleted a payment',
    'txn.add': 'Logged a transaction',
    'owner.create': 'Added a person',
    'owner.update': 'Updated a person',
    'document.add': 'Attached a document',
    'settings.update': 'Updated settings',
    'backup.import': 'Imported a backup',
  };
  return map[action] ?? action;
}
