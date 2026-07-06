import type { Bank, Card, DueItem, Owner, SpendCategory } from '@/types';
import { money, percent } from './format';
import { utilization, bestCardForCategory, portfolioSummary } from './analytics';
import { filterDue } from './reminders';

export interface AIContext {
  cards: Card[];
  owners: Owner[];
  banks: Bank[];
  dueItems: DueItem[];
}

export interface AIAnswer {
  text: string;
  cards?: Card[];
  bullets?: string[];
}

const CATEGORIES: SpendCategory[] = [
  'Shopping', 'Dining', 'Travel', 'Fuel', 'Groceries',
  'Bills', 'Entertainment', 'Health', 'Education', 'Other',
];

/**
 * A deterministic natural-language query engine over the local portfolio.
 * It matches intents by keyword, extracts entities (owner names, banks,
 * categories, utilization thresholds) and answers from real data — no
 * external API, works fully offline.
 */
export function askAI(raw: string, ctx: AIContext): AIAnswer {
  const q = raw.toLowerCase().trim();
  const { cards, owners, banks, dueItems } = ctx;
  const bankOf = (c: Card) => banks.find((b) => b.id === c.bankId);

  if (!q) return { text: 'Ask me anything about your cards — try “what’s due this week?”' };

  // ── Overdue ──────────────────────────────────────────────
  if (/overdue|late|missed|past due/.test(q)) {
    const overdue = dueItems.filter((d) => d.status === 'overdue');
    if (!overdue.length) return { text: 'Nothing overdue right now. You’re all caught up. ✅' };
    const total = overdue.reduce((s, d) => s + d.amount, 0);
    return {
      text: `${overdue.length} account${overdue.length > 1 ? 's are' : ' is'} overdue, totalling ${money(total)}.`,
      cards: overdue.map((d) => d.card),
      bullets: overdue.map(
        (d) => `${d.card.name} — ${money(d.amount)}, ${Math.abs(d.daysUntil)} day(s) late`,
      ),
    };
  }

  // ── Due this week / soon ────────────────────────────────
  if (/(due).*(week|7 day|soon|coming)|this week|upcoming/.test(q)) {
    const soon = filterDue(dueItems, 7);
    if (!soon.length) return { text: 'No payments are due in the next 7 days. 🎉' };
    const total = soon.reduce((s, d) => s + d.amount, 0);
    return {
      text: `${soon.length} payment${soon.length > 1 ? 's' : ''} due this week — ${money(total)} in total.`,
      cards: soon.map((d) => d.card),
      bullets: soon.map((d) => `${d.card.name} — ${money(d.amount)} ${d.daysUntil === 0 ? 'today' : `in ${d.daysUntil}d`}`),
    };
  }

  // ── Utilization threshold ("crossed 70%") ───────────────
  const utilMatch = q.match(/(\d{1,3})\s*%/);
  if (/utiliz|usage|limit/.test(q) && utilMatch) {
    const threshold = Number(utilMatch[1]);
    const hits = cards.filter((c) => c.status === 'Active' && utilization(c) >= threshold);
    if (!hits.length) return { text: `No cards are above ${threshold}% utilization.` };
    return {
      text: `${hits.length} card${hits.length > 1 ? 's have' : ' has'} crossed ${threshold}% utilization.`,
      cards: hits,
      bullets: hits.map((c) => `${c.name} — ${percent(utilization(c))}`),
    };
  }

  // ── Highest / lowest annual fee ─────────────────────────
  if (/annual fee|yearly fee/.test(q)) {
    const withFee = cards.filter((c) => c.annualFee);
    if (!withFee.length) return { text: 'None of your cards charge an annual fee.' };
    const highest = [...withFee].sort((a, b) => (b.annualFee ?? 0) - (a.annualFee ?? 0))[0];
    const bank = bankOf(highest);
    return {
      text: `${bank?.name ?? highest.name}’s ${highest.name} has the highest annual fee at ${money(highest.annualFee!)}.`,
      cards: [highest],
      bullets: withFee
        .sort((a, b) => (b.annualFee ?? 0) - (a.annualFee ?? 0))
        .map((c) => `${c.name} — ${money(c.annualFee ?? 0)}`),
    };
  }

  // ── Highest interest ────────────────────────────────────
  if (/interest|apr|rate/.test(q)) {
    const withRate = cards.filter((c) => c.interestRate);
    if (!withRate.length) return { text: 'No interest rates recorded on your cards.' };
    const highest = [...withRate].sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))[0];
    return {
      text: `${highest.name} carries the highest interest at ${highest.interestRate}% p.a. — prioritise clearing it.`,
      cards: [highest],
      bullets: withRate
        .sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0))
        .map((c) => `${c.name} — ${c.interestRate}% p.a.`),
    };
  }

  // ── Best card for a category ────────────────────────────
  const category = CATEGORIES.find((c) => q.includes(c.toLowerCase()));
  if (/best card|which card|use for|reward/.test(q) && category) {
    const ranked = bestCardForCategory(cards, category);
    if (!ranked.length) return { text: `No reward cards available for ${category}.` };
    const top = ranked[0];
    return {
      text: `For ${category}, use ${top.card.name} — best effective reward rate (${top.effectiveRate.toFixed(1)}×).`,
      cards: ranked.slice(0, 3).map((r) => r.card),
      bullets: ranked.slice(0, 3).map((r) => `${r.card.name} — ${r.effectiveRate.toFixed(1)}× effective`),
    };
  }

  // ── Owner balance ("how much does Ryan owe?") ───────────
  if (/owe|balance|outstanding|owes/.test(q)) {
    const owner = owners.find((o) => q.includes(o.name.toLowerCase().split(' ')[0]));
    if (owner) {
      const theirCards = cards.filter((c) => c.ownerId === owner.id);
      const total = theirCards.reduce((s, c) => s + c.currentBalance, 0);
      return {
        text: `${owner.name} owes ${money(total)} across ${theirCards.length} card${theirCards.length > 1 ? 's' : ''}.`,
        cards: theirCards.filter((c) => c.currentBalance > 0),
        bullets: theirCards
          .filter((c) => c.currentBalance > 0)
          .map((c) => `${c.name} — ${money(c.currentBalance)}`),
      };
    }
    const summary = portfolioSummary(cards, dueItems);
    return {
      text: `Total outstanding across all cards is ${money(summary.totalOutstanding)} of ${money(summary.totalLimit)} available.`,
    };
  }

  // ── Cards for a specific owner ──────────────────────────
  const ownerMatch = owners.find((o) => q.includes(o.name.toLowerCase().split(' ')[0]));
  if (ownerMatch && /(card|have|own)/.test(q)) {
    const theirCards = cards.filter((c) => c.ownerId === ownerMatch.id);
    return {
      text: `${ownerMatch.name} has ${theirCards.length} card${theirCards.length > 1 ? 's' : ''}.`,
      cards: theirCards,
    };
  }

  // ── Expiring ────────────────────────────────────────────
  if (/expir/.test(q)) {
    const expiring = cards.filter((c) => {
      const exp = new Date(c.expiryYear, c.expiryMonth, 0);
      return exp <= new Date(new Date().setMonth(new Date().getMonth() + 3));
    });
    if (!expiring.length) return { text: 'No cards expiring in the next 3 months.' };
    return {
      text: `${expiring.length} card${expiring.length > 1 ? 's are' : ' is'} expiring soon.`,
      cards: expiring,
      bullets: expiring.map((c) => `${c.name} — ${String(c.expiryMonth).padStart(2, '0')}/${c.expiryYear}`),
    };
  }

  // ── Rewards total ───────────────────────────────────────
  if (/point|miles|cashback/.test(q)) {
    const total = cards.reduce((s, c) => s + (c.rewardPoints ?? 0), 0);
    return {
      text: `You’ve accumulated ${total.toLocaleString()} reward points/miles across your portfolio.`,
      bullets: cards
        .filter((c) => c.rewardPoints)
        .sort((a, b) => (b.rewardPoints ?? 0) - (a.rewardPoints ?? 0))
        .map((c) => `${c.name} — ${(c.rewardPoints ?? 0).toLocaleString()}`),
    };
  }

  // ── Pay-first suggestion ────────────────────────────────
  if (/pay first|which.*pay|priorit|reduce/.test(q)) {
    const ranked = [...cards]
      .filter((c) => c.currentBalance > 0)
      .sort((a, b) => (b.interestRate ?? 0) * b.currentBalance - (a.interestRate ?? 0) * a.currentBalance);
    if (!ranked.length) return { text: 'All balances are clear — nothing to prioritise.' };
    const top = ranked[0];
    return {
      text: `Pay ${top.name} first — it has the costliest carry (${top.interestRate ?? 0}% on ${money(top.currentBalance)}).`,
      cards: ranked.slice(0, 3),
      bullets: ranked.slice(0, 3).map((c) => `${c.name} — ${money(c.currentBalance)} @ ${c.interestRate ?? 0}%`),
    };
  }

  // ── Fallback: portfolio snapshot ────────────────────────
  const summary = portfolioSummary(cards, dueItems);
  return {
    text: `Here’s a quick snapshot — ${summary.activeCards} active cards, ${money(summary.totalOutstanding)} outstanding (${percent(summary.overallUtilization)} utilization), ${summary.overdueCount} overdue. Try asking about a person, a due date, interest, rewards or utilization.`,
  };
}

export const AI_SUGGESTIONS = [
  'Which cards are due this week?',
  'Show overdue cards',
  'Which cards have crossed 70% utilization?',
  'Which bank charges the highest annual fee?',
  'Which card should I pay first?',
  'Best card for dining',
];
