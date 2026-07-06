import { useMemo, useState } from 'react';
import { Gift, Sparkles, TrendingUp, Award } from 'lucide-react';
import { useData } from '@/store/data';
import { Page, PageHeader } from '@/components/ui/Page';
import { Badge } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/feedback';
import { money, CARD_GRADIENTS } from '@/lib/format';
import { bestCardForCategory } from '@/lib/analytics';
import type { SpendCategory } from '@/types';

const CATEGORIES: { key: SpendCategory; icon: string }[] = [
  { key: 'Dining', icon: '🍽️' }, { key: 'Travel', icon: '✈️' }, { key: 'Shopping', icon: '🛍️' },
  { key: 'Fuel', icon: '⛽' }, { key: 'Groceries', icon: '🛒' }, { key: 'Bills', icon: '🧾' },
  { key: 'Entertainment', icon: '🎬' }, { key: 'Health', icon: '💊' },
];

export function RewardsPage() {
  const { cards } = useData();
  const [category, setCategory] = useState<SpendCategory>('Dining');

  const rewardCards = cards.filter((c) => c.rewardType !== 'None' && c.status === 'Active');
  const totalPoints = rewardCards.reduce((s, c) => s + (c.rewardPoints ?? 0), 0);
  // Rough valuation: 1 point ≈ ₹0.25 (typical Indian card baseline).
  const estValue = Math.round(totalPoints * 0.25);

  const ranked = useMemo(() => bestCardForCategory(cards, category), [cards, category]);
  const topByPoints = [...rewardCards].sort((a, b) => (b.rewardPoints ?? 0) - (a.rewardPoints ?? 0));

  const typeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of rewardCards) map.set(c.rewardType, (map.get(c.rewardType) ?? 0) + (c.rewardPoints ?? 0));
    return Array.from(map, ([type, points]) => ({ type, points }));
  }, [rewardCards]);

  if (rewardCards.length === 0) {
    return (
      <Page>
        <PageHeader title="Rewards" subtitle="Track points, cashback and the best card to use" />
        <EmptyState icon={<Gift size={26} />} title="No reward cards yet" description="Add a card with a reward program to start tracking points and cashback." />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Rewards" subtitle="Points, cashback and the smartest card for every spend" />

      {/* Top summary */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card-surface relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12 text-accent"><Gift size={18} /></span>
          <p className="mt-3 text-3xl font-bold tabular-nums">{totalPoints.toLocaleString('en-IN')}</p>
          <p className="text-xs text-muted">Total reward points / miles</p>
        </div>
        <div className="card-surface p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success/12 text-success"><TrendingUp size={18} /></span>
          <p className="mt-3 text-3xl font-bold tabular-nums">{money(estValue)}</p>
          <p className="text-xs text-muted">Estimated redemption value</p>
        </div>
        <div className="card-surface p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info/12 text-info"><Award size={18} /></span>
          <div className="mt-3 space-y-1.5">
            {typeBreakdown.map((t) => (
              <div key={t.type} className="flex items-center justify-between text-sm">
                <span className="text-muted">{t.type}</span>
                <span className="font-semibold tabular-nums">{t.points.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Best card to use */}
      <div className="mt-6 card-surface p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-semibold"><Sparkles size={18} className="text-accent" /> Best card to use</h3>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${category === c.key ? 'border-accent bg-accent/12 text-accent' : 'border-border bg-surface-2 text-muted hover:text-fg'}`}
            >
              <span>{c.icon}</span> {c.key}
            </button>
          ))}
        </div>

        {ranked.length === 0 ? (
          <p className="text-sm text-subtle">No reward cards available for {category}.</p>
        ) : (
          <div className="space-y-2">
            {ranked.slice(0, 5).map((r, i) => (
              <div key={r.card.id} className={`flex items-center gap-3 rounded-xl border p-3 ${i === 0 ? 'border-accent/40 bg-accent/5' : 'border-border bg-surface-2'}`}>
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-accent text-accent-fg' : 'bg-elevated text-muted'}`}>{i + 1}</span>
                <div className="flex h-8 w-12 items-center justify-center rounded-md text-xs" style={{ background: CARD_GRADIENTS[r.card.color] }}>{r.card.icon}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.card.name}</p>
                  <p className="truncate text-xs text-subtle">{r.card.rewardProgram} · {r.card.rewardType}</p>
                </div>
                {i === 0 && <Badge tone="accent">Recommended</Badge>}
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-accent">{r.effectiveRate.toFixed(1)}×</p>
                  <p className="text-[11px] text-subtle">on {category.toLowerCase()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Points by card */}
      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold">Points by card</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {topByPoints.map((c) => {
            const share = totalPoints ? ((c.rewardPoints ?? 0) / totalPoints) * 100 : 0;
            return (
              <div key={c.id} className="card-surface p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-12 items-center justify-center rounded-md text-xs" style={{ background: CARD_GRADIENTS[c.color] }}>{c.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-subtle">{c.rewardProgram}</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums">{(c.rewardPoints ?? 0).toLocaleString('en-IN')}</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
