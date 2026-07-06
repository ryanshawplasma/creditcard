import { format, subDays } from 'date-fns';
import type {
  Bank,
  Card,
  DocumentFile,
  EMIPlan,
  Owner,
  Payment,
  SpendCategory,
  Transaction,
} from '@/types';
import { db, recomputeCardBalance } from './db';
import { encryptField } from './crypto';
import { nowISO, uid } from './utils';

const MERCHANTS: Record<SpendCategory, string[]> = {
  Shopping: ['Amazon', 'Flipkart', 'Myntra', 'IKEA', 'Croma'],
  Dining: ['Zomato', 'Swiggy', 'Starbucks', 'Barbeque Nation', 'Social'],
  Travel: ['MakeMyTrip', 'IndiGo', 'Uber', 'IRCTC', 'Airbnb'],
  Fuel: ['HP Petrol', 'Indian Oil', 'Shell', 'BPCL'],
  Groceries: ['BigBasket', 'Blinkit', 'DMart', 'Zepto'],
  Bills: ['Airtel', 'Tata Power', 'Jio Fiber', 'ACT Broadband'],
  Entertainment: ['Netflix', 'BookMyShow', 'Spotify', 'PVR'],
  Health: ['Apollo Pharmacy', 'PharmEasy', 'Cult.fit', '1mg'],
  Education: ['Coursera', 'Udemy', 'Unacademy'],
  Other: ['Google', 'Apple', 'PayPal'],
};

const CATS = Object.keys(MERCHANTS) as SpendCategory[];

function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.floor(seed)) % arr.length];
}

/**
 * Generate coherent activity for a card so that
 *   sum(transactions) − sum(payments) === outstanding.
 * Balances therefore derive from real seeded transactions & payments,
 * exactly as they would from live use.
 */
function genActivity(
  cardId: string,
  ownerId: string,
  grossSpend: number,
  outstanding: number,
  favouredCats: SpendCategory[],
): { transactions: Transaction[]; payments: Payment[] } {
  const transactions: Transaction[] = [];
  const payments: Payment[] = [];

  // Transactions sum EXACTLY to grossSpend (last absorbs the remainder, and
  // we always leave ≥₹1 per remaining txn so every amount stays positive).
  const nTxn = 8 + (Math.floor(grossSpend / 20000) % 8);
  let remaining = grossSpend;
  for (let i = 0; i < nTxn; i++) {
    const isLast = i === nTxn - 1;
    let amount: number;
    if (isLast) {
      amount = remaining;
    } else {
      const frac = 0.08 + ((i * 37 + grossSpend) % 17) / 100; // 0.08–0.24
      const cap = remaining - (nTxn - 1 - i); // reserve ≥₹1 for the rest
      amount = Math.max(1, Math.min(cap, Math.round(remaining * frac)));
    }
    remaining -= amount;
    const category =
      i % 3 === 0 && favouredCats.length ? pick(favouredCats, i) : pick(CATS, i * 7 + grossSpend);
    transactions.push({
      id: uid('txn_'),
      cardId,
      amount,
      date: format(subDays(new Date(), 4 + i * 11), 'yyyy-MM-dd'),
      merchant: pick(MERCHANTS[category], i * 3 + amount),
      category,
      createdAt: nowISO(),
    });
  }

  // Payments sum EXACTLY to (grossSpend − outstanding).
  const toPay = grossSpend - outstanding;
  if (toPay > 0) {
    const p1 = Math.round(toPay * 0.5);
    const p2 = Math.round(toPay * 0.3);
    const chunks = [p1, p2, toPay - p1 - p2];
    chunks.forEach((amount, i) => {
      if (amount <= 0) return;
      payments.push({
        id: uid('pay_'),
        cardId,
        amount,
        date: format(subDays(new Date(), 20 + i * 28), 'yyyy-MM-dd'),
        paidById: ownerId,
        mode: i === 0 ? 'UPI' : i === 1 ? 'NetBanking' : 'AutoDebit',
        reference: `TXN${Math.floor(100000 + Math.random() * 899999)}`,
        createdAt: nowISO(),
      });
    });
  }
  return { transactions, payments };
}

export async function seedDatabase(masterKey: CryptoKey, selfName: string, selfEmail: string) {
  const ts = nowISO();

  // ── Banks ──────────────────────────────────────────────
  const banks: Bank[] = [
    { id: 'bank_hdfc', name: 'HDFC Bank', shortName: 'HDFC', color: '#004b8d', supportPhone: '1800 202 6161', website: 'hdfcbank.com' },
    { id: 'bank_icici', name: 'ICICI Bank', shortName: 'ICICI', color: '#b02a30', supportPhone: '1800 1080', website: 'icicibank.com' },
    { id: 'bank_sbi', name: 'State Bank of India', shortName: 'SBI', color: '#2d6cdf', supportPhone: '1860 180 1290', website: 'sbicard.com' },
    { id: 'bank_axis', name: 'Axis Bank', shortName: 'Axis', color: '#97144d', supportPhone: '1860 419 5555', website: 'axisbank.com' },
    { id: 'bank_amex', name: 'American Express', shortName: 'Amex', color: '#016fd0', supportPhone: '1800 419 2122', website: 'americanexpress.com' },
    { id: 'bank_kotak', name: 'Kotak Mahindra Bank', shortName: 'Kotak', color: '#ed1c24', supportPhone: '1860 266 2666', website: 'kotak.com' },
  ];

  // ── Owners ─────────────────────────────────────────────
  const owners: Owner[] = [
    { id: 'own_self', name: selfName, relationship: 'Self', email: selfEmail, phone: '+91 98200 11223', color: '#6366f1', favorite: true, createdAt: ts, updatedAt: ts, notes: 'Primary account holder' },
    { id: 'own_priya', name: 'Priya Shaw', relationship: 'Family', email: 'priya@example.com', phone: '+91 98200 44556', color: '#ec4899', createdAt: ts, updatedAt: ts },
    { id: 'own_arjun', name: 'Arjun Mehta', relationship: 'Employee', department: 'Operations', email: 'arjun@example.com', phone: '+91 90040 88991', color: '#10b981', createdAt: ts, updatedAt: ts },
    { id: 'own_neha', name: 'Neha Kapoor', relationship: 'Friend', email: 'neha@example.com', phone: '+91 99870 22110', color: '#f59e0b', createdAt: ts, updatedAt: ts },
    { id: 'own_vikram', name: 'Vikram Rao', relationship: 'Business', department: 'Finance', email: 'vikram@example.com', phone: '+91 98455 77332', color: '#0ea5e9', createdAt: ts, updatedAt: ts },
  ];

  type Spec = Omit<Card, 'createdAt' | 'updatedAt' | 'secure' | 'currentBalance' | 'baselineBalance'> & {
    fullNumber: string;
    grossSpend: number;
    outstanding: number;
    favouredCats: SpendCategory[];
  };

  const specs: Spec[] = [
    {
      id: 'card_regalia', name: 'HDFC Regalia Gold', bankId: 'bank_hdfc', network: 'Visa', ownerId: 'own_self',
      last4: '4589', fullNumber: '4023 6789 1234 4589', expiryMonth: 11, expiryYear: 2027,
      creditLimit: 500000, cashLimit: 150000, billingDay: 18, statementDay: 18, dueDay: 6,
      interestRate: 42.0, annualFee: 2500, annualFeeMonth: 9, rewardType: 'Points', rewardProgram: 'Reward Points',
      rewardPoints: 48210, rewardRate: 4, rewardBoosts: { Dining: 5, Travel: 5, Shopping: 2 },
      autoDebit: true, linkedBank: 'HDFC Savings ••4501', status: 'Active', color: 'gold', icon: '👑',
      pinned: true, tags: ['Premium', 'Travel'], grossSpend: 210000, outstanding: 128500, favouredCats: ['Travel', 'Dining'],
    },
    {
      id: 'card_amazon', name: 'Amazon Pay ICICI', bankId: 'bank_icici', network: 'Visa', ownerId: 'own_self',
      last4: '7712', fullNumber: '4375 1122 9087 7712', expiryMonth: 3, expiryYear: 2026,
      creditLimit: 220000, cashLimit: 60000, billingDay: 2, statementDay: 2, dueDay: 20,
      interestRate: 43.2, annualFee: 0, rewardType: 'Cashback', rewardProgram: 'Amazon Pay Cashback',
      rewardPoints: 12640, rewardRate: 5, rewardBoosts: { Shopping: 5, Bills: 2, Groceries: 2 },
      autoDebit: true, linkedBank: 'ICICI Savings ••8890', status: 'Active', color: 'ocean', icon: '📦',
      pinned: true, tags: ['Cashback', 'Shopping'], grossSpend: 96000, outstanding: 41200, favouredCats: ['Shopping', 'Groceries'],
    },
    {
      id: 'card_magnus', name: 'Axis Magnus', bankId: 'bank_axis', network: 'Mastercard', ownerId: 'own_self',
      last4: '3021', fullNumber: '5241 8890 1276 3021', expiryMonth: 8, expiryYear: 2028,
      creditLimit: 750000, cashLimit: 200000, billingDay: 25, statementDay: 25, dueDay: 14,
      interestRate: 41.5, annualFee: 12500, annualFeeMonth: 4, rewardType: 'Miles', rewardProgram: 'Edge Rewards',
      rewardPoints: 92340, rewardRate: 12, rewardBoosts: { Travel: 5, Dining: 3, Shopping: 2 },
      autoDebit: false, status: 'Active', color: 'graphite', icon: '✈️',
      tags: ['Travel', 'Premium'], grossSpend: 430000, outstanding: 356000, favouredCats: ['Travel'],
    },
    {
      id: 'card_amexplat', name: 'Amex Platinum Travel', bankId: 'bank_amex', network: 'Amex', ownerId: 'own_self',
      last4: '1008', fullNumber: '3782 822463 11008', expiryMonth: 6, expiryYear: 2026,
      creditLimit: 400000, billingDay: 10, statementDay: 10, dueDay: 28,
      interestRate: 42.0, annualFee: 5000, annualFeeMonth: 7, rewardType: 'Points', rewardProgram: 'Membership Rewards',
      rewardPoints: 63400, rewardRate: 3, rewardBoosts: { Travel: 5, Dining: 3 },
      autoDebit: true, linkedBank: 'HDFC Savings ••4501', status: 'Active', color: 'arctic', icon: '💠',
      tags: ['Travel'], grossSpend: 118000, outstanding: 0, favouredCats: ['Travel', 'Dining'],
    },
    {
      id: 'card_sbicashback', name: 'SBI Cashback', bankId: 'bank_sbi', network: 'Mastercard', ownerId: 'own_priya',
      last4: '6634', fullNumber: '5412 7788 2210 6634', expiryMonth: 1, expiryYear: 2027,
      creditLimit: 180000, cashLimit: 40000, billingDay: 5, statementDay: 5, dueDay: 24,
      interestRate: 45.0, annualFee: 999, annualFeeMonth: 11, rewardType: 'Cashback', rewardProgram: 'Cashback',
      rewardPoints: 8900, rewardRate: 5, rewardBoosts: { Shopping: 5, Bills: 1 },
      autoDebit: false, status: 'Active', color: 'plum', icon: '🛍️',
      tags: ['Cashback'], grossSpend: 185000, outstanding: 150000, favouredCats: ['Shopping', 'Entertainment'],
    },
    {
      id: 'card_millennia', name: 'HDFC Millennia', bankId: 'bank_hdfc', network: 'Mastercard', ownerId: 'own_neha',
      last4: '9245', fullNumber: '5522 3344 1120 9245', expiryMonth: 9, expiryYear: 2025,
      creditLimit: 150000, cashLimit: 30000, billingDay: 12, statementDay: 12, dueDay: 1,
      interestRate: 43.2, annualFee: 1000, annualFeeMonth: 5, rewardType: 'Cashback', rewardProgram: 'CashPoints',
      rewardPoints: 5400, rewardRate: 5, rewardBoosts: { Shopping: 5, Dining: 2 },
      autoDebit: false, status: 'Active', color: 'rose', icon: '🌸',
      tags: ['Cashback'], grossSpend: 165000, outstanding: 141000, favouredCats: ['Dining', 'Entertainment'],
    },
    {
      id: 'card_sapphiro', name: 'ICICI Sapphiro', bankId: 'bank_icici', network: 'Visa', ownerId: 'own_vikram',
      last4: '5170', fullNumber: '4001 5566 7788 5170', expiryMonth: 4, expiryYear: 2029,
      creditLimit: 600000, cashLimit: 180000, billingDay: 22, statementDay: 22, dueDay: 11,
      interestRate: 40.8, annualFee: 6500, annualFeeMonth: 2, rewardType: 'Points', rewardProgram: 'ICICI Rewards',
      rewardPoints: 41200, rewardRate: 4, rewardBoosts: { Travel: 4, Dining: 3, Shopping: 2 },
      autoDebit: true, linkedBank: 'ICICI Current ••2201', status: 'Active', color: 'midnight', icon: '💼',
      tags: ['Business'], grossSpend: 288000, outstanding: 196400, favouredCats: ['Travel', 'Bills'],
    },
    {
      id: 'card_simplyclick', name: 'SBI SimplyCLICK', bankId: 'bank_sbi', network: 'Visa', ownerId: 'own_arjun',
      last4: '8802', fullNumber: '4111 2233 4455 8802', expiryMonth: 12, expiryYear: 2026,
      creditLimit: 120000, cashLimit: 25000, billingDay: 8, statementDay: 8, dueDay: 27,
      interestRate: 45.0, annualFee: 499, annualFeeMonth: 6, rewardType: 'Points', rewardProgram: 'Reward Points',
      rewardPoints: 3100, rewardRate: 5, rewardBoosts: { Shopping: 10, Bills: 1 },
      autoDebit: false, status: 'Active', color: 'forest', icon: '🖱️',
      tags: ['Online'], grossSpend: 41000, outstanding: 22800, favouredCats: ['Shopping', 'Education'],
    },
    {
      id: 'card_flipkart', name: 'Axis Flipkart', bankId: 'bank_axis', network: 'Mastercard', ownerId: 'own_arjun',
      last4: '2394', fullNumber: '5432 1100 8876 2394', expiryMonth: 2, expiryYear: 2028,
      creditLimit: 160000, cashLimit: 35000, billingDay: 15, statementDay: 15, dueDay: 4,
      interestRate: 44.0, annualFee: 500, annualFeeMonth: 8, rewardType: 'Cashback', rewardProgram: 'Flipkart Cashback',
      rewardPoints: 6700, rewardRate: 5, rewardBoosts: { Shopping: 5, Groceries: 4 },
      autoDebit: true, linkedBank: 'Axis Savings ••7781', status: 'Active', color: 'ember', icon: '🛒',
      tags: ['Shopping'], grossSpend: 63000, outstanding: 51900, favouredCats: ['Shopping', 'Groceries'],
    },
    {
      id: 'card_kotak811', name: 'Kotak 811 #DreamDifferent', bankId: 'bank_kotak', network: 'RuPay', ownerId: 'own_priya',
      last4: '7050', fullNumber: '6070 1234 5678 7050', expiryMonth: 5, expiryYear: 2027,
      creditLimit: 90000, cashLimit: 18000, billingDay: 28, statementDay: 28, dueDay: 17,
      interestRate: 46.8, annualFee: 0, rewardType: 'Points', rewardProgram: 'Kotak Rewards',
      rewardPoints: 1800, rewardRate: 2, rewardBoosts: { Groceries: 3, Bills: 2 },
      autoDebit: false, status: 'Active', color: 'aurora', icon: '⭐',
      tags: ['Everyday'], grossSpend: 33000, outstanding: 19400, favouredCats: ['Groceries', 'Bills'],
    },
  ];

  const cards: Card[] = [];
  const allTxns: Transaction[] = [];
  const allPays: Payment[] = [];

  for (const spec of specs) {
    const { fullNumber, grossSpend, outstanding, favouredCats, ...rest } = spec;
    const secure = { cardNumber: await encryptField(masterKey, fullNumber) };
    cards.push({
      ...rest,
      baselineBalance: 0,
      currentBalance: outstanding,
      secure,
      createdAt: ts,
      updatedAt: ts,
    });
    const activity = genActivity(spec.id, spec.ownerId, grossSpend, outstanding, favouredCats);
    allTxns.push(...activity.transactions);
    allPays.push(...activity.payments);
  }

  // ── EMIs ───────────────────────────────────────────────
  const emis: EMIPlan[] = [
    { id: uid('emi_'), cardId: 'card_magnus', description: 'MacBook Pro 14"', principal: 199900, monthlyAmount: 17491, totalMonths: 12, paidMonths: 4, interestRate: 13, startDate: format(subDays(new Date(), 120), 'yyyy-MM-dd'), createdAt: ts },
    { id: uid('emi_'), cardId: 'card_regalia', description: 'Sony A7 IV Camera', principal: 245000, monthlyAmount: 41400, totalMonths: 6, paidMonths: 2, interestRate: 14, startDate: format(subDays(new Date(), 62), 'yyyy-MM-dd'), createdAt: ts },
    { id: uid('emi_'), cardId: 'card_sapphiro', description: 'Office Furniture', principal: 120000, monthlyAmount: 10500, totalMonths: 12, paidMonths: 7, interestRate: 12, startDate: format(subDays(new Date(), 210), 'yyyy-MM-dd'), createdAt: ts },
  ];

  // ── A sample document ──────────────────────────────────
  const docs: DocumentFile[] = [
    {
      id: uid('doc_'), name: 'HDFC Regalia - Statement (latest).txt', kind: 'Statement',
      mime: 'text/plain', size: 640, cardId: 'card_regalia', ownerId: 'own_self',
      dataUrl:
        'data:text/plain;base64,' +
        btoa(
          'HDFC BANK - REGALIA GOLD CREDIT CARD STATEMENT\nStatement Date: 18\nPayment Due Date: 6th\nTotal Amount Due: 128,500.00\nMinimum Amount Due: 6,425.00\nAvailable Credit Limit: 371,500.00\n\nThank you for banking with HDFC.',
        ),
      createdAt: ts,
    },
  ];

  await db.transaction(
    'rw',
    [db.banks, db.owners, db.cards, db.transactions, db.payments, db.emis, db.documents],
    async () => {
      await db.banks.bulkAdd(banks);
      await db.owners.bulkAdd(owners);
      await db.cards.bulkAdd(cards);
      await db.transactions.bulkAdd(allTxns);
      await db.payments.bulkAdd(allPays);
      await db.emis.bulkAdd(emis);
      await db.documents.bulkAdd(docs);
    },
  );

  // Reconcile balances from the seeded activity so they are provably correct.
  for (const c of cards) await recomputeCardBalance(c.id);
}
