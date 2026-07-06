import { format, parseISO, subMonths } from 'date-fns';
import type {
  Bank,
  Card,
  DueItem,
  Owner,
  Payment,
  SpendCategory,
  Transaction,
} from '@/types';
import { isExpiringSoon } from './cycle';

export function utilization(card: Card): number {
  if (!card.creditLimit) return 0;
  return (card.currentBalance / card.creditLimit) * 100;
}

export interface Portfolio {
  totalLimit: number;
  totalOutstanding: number;
  availableCredit: number;
  overallUtilization: number;
  activeCards: number;
  totalRewardPoints: number;
  totalAnnualFees: number;
  overdueCount: number;
  expiringSoon: number;
  largestBalance?: Card;
  highestInterest?: Card;
  nearLimit: Card[];
  unusedCards: Card[];
}

export function portfolioSummary(cards: Card[], dueItems: DueItem[]): Portfolio {
  const active = cards.filter((c) => c.status === 'Active');
  const totalLimit = active.reduce((s, c) => s + c.creditLimit, 0);
  const totalOutstanding = active.reduce((s, c) => s + c.currentBalance, 0);
  const nearLimit = active.filter((c) => utilization(c) >= 70).sort((a, b) => utilization(b) - utilization(a));
  const unusedCards = active.filter((c) => c.currentBalance === 0);

  return {
    totalLimit,
    totalOutstanding,
    availableCredit: Math.max(0, totalLimit - totalOutstanding),
    overallUtilization: totalLimit ? (totalOutstanding / totalLimit) * 100 : 0,
    activeCards: active.length,
    totalRewardPoints: active.reduce((s, c) => s + (c.rewardPoints ?? 0), 0),
    totalAnnualFees: active.reduce((s, c) => s + (c.annualFee ?? 0), 0),
    overdueCount: dueItems.filter((d) => d.status === 'overdue').length,
    expiringSoon: active.filter((c) => isExpiringSoon(c)).length,
    largestBalance: [...active].sort((a, b) => b.currentBalance - a.currentBalance)[0],
    highestInterest: [...active]
      .filter((c) => c.interestRate)
      .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0],
    nearLimit,
    unusedCards,
  };
}

/** Financial-health score (0–100) blending utilization, on-time payments,
 * overdue items and fee load — with human-readable factors. */
export interface HealthScore {
  score: number;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Needs work';
  factors: { label: string; impact: number; positive: boolean }[];
}

export function healthScore(
  cards: Card[],
  dueItems: DueItem[],
  payments: Payment[],
): HealthScore {
  let score = 100;
  const factors: HealthScore['factors'] = [];

  const active = cards.filter((c) => c.status === 'Active');
  const util = active.length
    ? active.reduce((s, c) => s + c.creditLimit, 0) > 0
      ? (active.reduce((s, c) => s + c.currentBalance, 0) /
          active.reduce((s, c) => s + c.creditLimit, 0)) *
        100
      : 0
    : 0;

  // Utilization band
  if (util > 80) {
    score -= 32;
    factors.push({ label: `Utilization very high (${util.toFixed(0)}%)`, impact: -32, positive: false });
  } else if (util > 50) {
    score -= 18;
    factors.push({ label: `Utilization elevated (${util.toFixed(0)}%)`, impact: -18, positive: false });
  } else if (util > 30) {
    score -= 8;
    factors.push({ label: `Utilization above 30% (${util.toFixed(0)}%)`, impact: -8, positive: false });
  } else {
    factors.push({ label: `Utilization healthy (${util.toFixed(0)}%)`, impact: +6, positive: true });
  }

  // Overdue accounts
  const overdue = dueItems.filter((d) => d.status === 'overdue').length;
  if (overdue > 0) {
    const impact = -Math.min(30, overdue * 12);
    score += impact;
    factors.push({ label: `${overdue} overdue account${overdue > 1 ? 's' : ''}`, impact, positive: false });
  } else {
    factors.push({ label: 'No overdue accounts', impact: +8, positive: true });
  }

  // Near-limit cards
  const nearLimit = active.filter((c) => utilization(c) >= 90).length;
  if (nearLimit > 0) {
    const impact = -nearLimit * 6;
    score += impact;
    factors.push({ label: `${nearLimit} card(s) near limit`, impact, positive: false });
  }

  // Payment activity (rewarded)
  const recentPayments = payments.filter(
    (p) => parseISO(p.date) >= subMonths(new Date(), 3),
  ).length;
  if (recentPayments >= 3) {
    factors.push({ label: 'Consistent recent payments', impact: +6, positive: true });
    score += 6;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade: HealthScore['grade'] =
    score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 45 ? 'Fair' : 'Needs work';

  return { score, grade, factors: factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)) };
}

/** Monthly spend series for the last N months. */
export function monthlySpend(transactions: Transaction[], months = 6) {
  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    buckets.set(format(subMonths(new Date(), i), 'MMM yy'), 0);
  }
  for (const t of transactions) {
    const key = format(parseISO(t.date), 'MMM yy');
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + t.amount);
  }
  return Array.from(buckets, ([month, amount]) => ({ month, amount }));
}

export function spendByCategory(transactions: Transaction[]) {
  const map = new Map<SpendCategory, number>();
  for (const t of transactions) map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  return Array.from(map, ([category, amount]) => ({ category, amount })).sort(
    (a, b) => b.amount - a.amount,
  );
}

export function spendByCard(transactions: Transaction[], cards: Card[]) {
  const map = new Map<string, number>();
  for (const t of transactions) map.set(t.cardId, (map.get(t.cardId) ?? 0) + t.amount);
  return cards
    .map((c) => ({ name: c.name, amount: map.get(c.id) ?? 0, color: c.color }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function spendByOwner(transactions: Transaction[], cards: Card[], owners: Owner[]) {
  const cardOwner = new Map(cards.map((c) => [c.id, c.ownerId]));
  const map = new Map<string, number>();
  for (const t of transactions) {
    const oid = cardOwner.get(t.cardId);
    if (oid) map.set(oid, (map.get(oid) ?? 0) + t.amount);
  }
  return owners
    .map((o) => ({ name: o.name, amount: map.get(o.id) ?? 0, color: o.color }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function spendByBank(transactions: Transaction[], cards: Card[], banks: Bank[]) {
  const cardBank = new Map(cards.map((c) => [c.id, c.bankId]));
  const map = new Map<string, number>();
  for (const t of transactions) {
    const bid = cardBank.get(t.cardId);
    if (bid) map.set(bid, (map.get(bid) ?? 0) + t.amount);
  }
  return banks
    .map((b) => ({ name: b.shortName ?? b.name, amount: map.get(b.id) ?? 0, color: b.color }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function utilizationTrend(cards: Card[], payments: Payment[], months = 6) {
  // Reconstruct approximate utilization by adding back payments made after each month.
  const totalLimit = cards.reduce((s, c) => s + c.creditLimit, 0) || 1;
  const currentOutstanding = cards.reduce((s, c) => s + c.currentBalance, 0);
  const series: { month: string; utilization: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = subMonths(new Date(), i);
    const paidSince = payments
      .filter((p) => parseISO(p.date) >= monthStart)
      .reduce((s, p) => s + p.amount, 0);
    const approx = currentOutstanding + paidSince;
    series.push({
      month: format(monthStart, 'MMM yy'),
      utilization: Math.min(100, Math.round((approx / totalLimit) * 100)),
    });
  }
  return series;
}

/** "Best card to use" for a category, ranked by reward boost × base rate. */
export function bestCardForCategory(cards: Card[], category: SpendCategory) {
  return cards
    .filter((c) => c.status === 'Active' && c.rewardType !== 'None')
    .map((c) => {
      const boost = c.rewardBoosts?.[category] ?? 1;
      const effective = (c.rewardRate ?? 1) * boost;
      return { card: c, effectiveRate: effective, boost };
    })
    .sort((a, b) => b.effectiveRate - a.effectiveRate);
}
