import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { TrendingUp, Landmark, Gift, Flame } from 'lucide-react';
import { useData } from '@/store/data';
import { Page, PageHeader } from '@/components/ui/Page';
import { Segmented } from '@/components/ui/primitives';
import { money } from '@/lib/format';
import {
  monthlySpend, spendByCategory, spendByCard, spendByOwner, spendByBank, utilizationTrend,
} from '@/lib/analytics';

const PIE_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#0ea5e9', '#8b5cf6', '#f43f5e', '#14b8a6', '#eab308', '#64748b'];

function ChartTooltip({ active, payload, label, prefix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-elevated px-3 py-2 text-xs shadow-lift">
      {label && <p className="mb-0.5 font-medium text-fg">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-muted">{p.name}: {prefix === '%' ? `${p.value}%` : money(p.value)}</p>
      ))}
    </div>
  );
}

export function AnalyticsPage() {
  const { cards, transactions, payments, owners, banks } = useData();
  const [range, setRange] = useState<6 | 12>(6);

  const spend = useMemo(() => monthlySpend(transactions, range), [transactions, range]);
  const byCategory = useMemo(() => spendByCategory(transactions), [transactions]);
  const byCard = useMemo(() => spendByCard(transactions, cards), [transactions, cards]);
  const byOwner = useMemo(() => spendByOwner(transactions, cards, owners), [transactions, cards, owners]);
  const byBank = useMemo(() => spendByBank(transactions, cards, banks), [transactions, cards, banks]);
  const utilTrend = useMemo(() => utilizationTrend(cards, payments, range), [cards, payments, range]);

  const totalSpent = transactions.reduce((s, t) => s + t.amount, 0);
  const interestEstimate = cards.reduce((s, c) => s + (c.currentBalance * (c.interestRate ?? 0)) / 100, 0);
  const annualFees = cards.reduce((s, c) => s + (c.annualFee ?? 0), 0);
  const rewardPoints = cards.reduce((s, c) => s + (c.rewardPoints ?? 0), 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <Page>
      <PageHeader
        title="Analytics"
        subtitle="Spending, utilization and cost of credit"
        actions={<Segmented value={String(range) as any} onChange={(v) => setRange(Number(v) as 6 | 12)} options={[{ value: '6', label: '6M' }, { value: '12', label: '12M' }]} />}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={TrendingUp} tone="accent" label="Total tracked spend" value={money(totalSpent)} />
        <Kpi icon={Flame} tone="danger" label="Est. annual interest" value={money(Math.round(interestEstimate))} sub="if balances carried 1 yr" />
        <Kpi icon={Landmark} tone="warning" label="Annual fees" value={money(annualFees)} />
        <Kpi icon={Gift} tone="info" label="Reward points" value={rewardPoints.toLocaleString('en-IN')} />
      </div>

      {/* Spend + utilization */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Monthly spending" subtitle={`Total paid ${money(totalPaid)} across all cards`}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={spend} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="a1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => money(v, { compact: true })} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="amount" name="Spend" stroke="rgb(var(--accent))" strokeWidth={2.5} fill="url(#a1)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Utilization trend" subtitle="Approximate credit utilization over time">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={utilTrend} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip prefix="%" />} />
              <Line type="monotone" dataKey="utilization" name="Utilization" stroke="rgb(var(--accent))" strokeWidth={2.5} dot={{ r: 3, fill: 'rgb(var(--accent))' }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Category + card */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Spend by category">
          {byCategory.length === 0 ? <NoData /> : (
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
              <div className="h-[200px] w-full sm:h-[240px] sm:w-[55%]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byCategory} dataKey="amount" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                      {byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full flex-1 space-y-1.5">
                {byCategory.slice(0, 6).map((c, i) => (
                  <div key={c.category} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="flex-1 text-muted">{c.category}</span>
                    <span className="font-medium tabular-nums">{money(c.amount, { compact: true })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Spend by card">
          {byCard.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byCard} layout="vertical" margin={{ left: 40, right: 12 }}>
                <XAxis type="number" tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => money(v, { compact: true })} />
                <YAxis type="category" dataKey="name" tick={{ fill: 'rgb(var(--muted))', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--surface-2))' }} />
                <Bar dataKey="amount" name="Spend" radius={[0, 6, 6, 0]}>
                  {byCard.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Owner + bank */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Spend by person">
          {byOwner.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byOwner} margin={{ left: -12, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => money(v, { compact: true })} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--surface-2))' }} />
                <Bar dataKey="amount" name="Spend" radius={[6, 6, 0, 0]}>
                  {byOwner.map((o, i) => <Cell key={i} fill={o.color ?? PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Spend by bank">
          {byBank.length === 0 ? <NoData /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byBank} margin={{ left: -12, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border))" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgb(var(--subtle))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => money(v, { compact: true })} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgb(var(--surface-2))' }} />
                <Bar dataKey="amount" name="Spend" radius={[6, 6, 0, 0]}>
                  {byBank.map((b, i) => <Cell key={i} fill={b.color ?? PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </Page>
  );
}

function Kpi({ icon: Icon, tone, label, value, sub }: { icon: any; tone: 'accent' | 'danger' | 'warning' | 'info'; label: string; value: string; sub?: string }) {
  const bg = { accent: 'bg-accent/12 text-accent', danger: 'bg-danger/12 text-danger', warning: 'bg-warning/12 text-warning', info: 'bg-info/12 text-info' }[tone];
  return (
    <div className="card-surface p-5">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}><Icon size={18} /></span>
      <p className="mt-3 text-xl font-bold tabular-nums">{value}</p>
      <p className="text-xs font-medium text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-subtle">{sub}</p>}
    </div>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="card-surface p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function NoData() {
  return <div className="flex h-40 items-center justify-center text-sm text-subtle">No data to display yet.</div>;
}
