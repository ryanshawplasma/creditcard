/**
 * Smart card extraction — turn a pasted bank SMS / statement text, or a photo
 * of a card, into a pre-filled card draft the user can review and edit.
 *
 * Everything runs locally: text parsing is pure string work, and image OCR
 * uses tesseract.js (WASM) in-browser — the card image never leaves the device.
 * (The first OCR run downloads the ~few-MB language model; text paste is fully
 * offline.)
 */
import type { CardNetwork } from '@/types';

export interface CardExtract {
  name?: string;
  bankName?: string;
  network?: CardNetwork;
  last4?: string;
  fullCardNumber?: string;
  creditLimit?: number;
  availableLimit?: number;
  openingBalance?: number; // total amount due / outstanding
  minimumDue?: number;
  dueDay?: number;
  billingDay?: number;
  statementDay?: number;
  expiryMonth?: number;
  expiryYear?: number;
  rewardProgram?: string;
  found: string[]; // human-readable list of what was detected
  rawText: string;
}

// Known issuers — matched case-insensitively against the text.
const BANKS: { re: RegExp; name: string }[] = [
  { re: /\bhdfc\b/i, name: 'HDFC Bank' },
  { re: /\bicici\b/i, name: 'ICICI Bank' },
  { re: /\b(sbi|state bank)\b/i, name: 'State Bank of India' },
  { re: /\baxis\b/i, name: 'Axis Bank' },
  { re: /\bkotak\b/i, name: 'Kotak Mahindra Bank' },
  { re: /\b(amex|american express)\b/i, name: 'American Express' },
  { re: /\b(citi|citibank)\b/i, name: 'Citibank' },
  { re: /\bhsbc\b/i, name: 'HSBC' },
  { re: /\b(standard chartered|stanchart|scb)\b/i, name: 'Standard Chartered' },
  { re: /\bidfc\b/i, name: 'IDFC First Bank' },
  { re: /\brbl\b/i, name: 'RBL Bank' },
  { re: /\byes bank\b/i, name: 'YES Bank' },
  { re: /\bindusind\b/i, name: 'IndusInd Bank' },
  { re: /\bau (small|bank)\b/i, name: 'AU Small Finance Bank' },
  { re: /\bfederal\b/i, name: 'Federal Bank' },
  { re: /\b(bank of baroda|bob)\b/i, name: 'Bank of Baroda' },
  { re: /\bidbi\b/i, name: 'IDBI Bank' },
  { re: /\bdbs\b/i, name: 'DBS Bank' },
];

// Popular card product names → used to guess the card name / reward program.
const PRODUCTS = [
  'Regalia', 'Millennia', 'MoneyBack', 'Swiggy', 'Tata Neu', 'Amazon Pay', 'Flipkart',
  'SimplyCLICK', 'SimplySAVE', 'Cashback', 'Magnus', 'Atlas', 'Ace', 'Vistara',
  'Coral', 'Rubyx', 'Sapphiro', 'Emeralde', 'Platinum', 'Freedom', 'MakeMyTrip',
  'IRCTC', 'Diners Club', 'Infinia', 'Marquee', 'Select', 'Elite', 'Prime',
];

const NETWORK_WORDS: { re: RegExp; net: CardNetwork }[] = [
  { re: /\bvisa\b/i, net: 'Visa' },
  { re: /\bmaster ?card\b/i, net: 'Mastercard' },
  { re: /\brupay\b/i, net: 'RuPay' },
  { re: /\b(amex|american express)\b/i, net: 'Amex' },
  { re: /\bdiners\b/i, net: 'Diners' },
  { re: /\bdiscover\b/i, net: 'Discover' },
];

/** Infer the card network from the leading digits (IIN/BIN). */
export function detectNetwork(cardNumber: string): CardNetwork | undefined {
  const n = cardNumber.replace(/\D/g, '');
  if (!n) return undefined;
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^3(0[0-5]|095|6|8|9)/.test(n)) return 'Diners';
  if (/^(60|65|81|82|508|353|356)/.test(n)) return 'RuPay';
  if (/^4/.test(n)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(n)) return 'Mastercard';
  if (/^(6011|64[4-9])/.test(n)) return 'Discover';
  return undefined;
}

function toInt(s: string): number {
  // Strip comma thousands-separators (incl. Indian grouping), keep the decimal
  // point, then round — so "12,340.00" → 12340, not 1234000.
  return Math.round(parseFloat(s.replace(/,/g, '')) || 0);
}

function firstMatch(text: string, res: RegExp[]): RegExpMatchArray | null {
  for (const re of res) {
    const m = text.match(re);
    if (m) return m;
  }
  return null;
}

/** Parse a bank SMS / statement / freeform note into a card draft. */
export function parseCardText(rawText: string): CardExtract {
  const text = rawText.replace(/ /g, ' ');
  const out: CardExtract = { found: [], rawText };

  // ── Full card number (spaced/grouped) ──────────────────
  const fullMatch = text.match(/\b(\d[\d\s-]{11,21}\d)\b/);
  if (fullMatch) {
    const digits = fullMatch[1].replace(/\D/g, '');
    if (digits.length >= 13 && digits.length <= 19) {
      out.fullCardNumber = digits;
      out.last4 = digits.slice(-4);
      out.network = detectNetwork(digits);
      out.found.push(`Card number •••• ${out.last4}`);
    }
  }

  // ── Last 4 (masked / "ending") ─────────────────────────
  if (!out.last4) {
    const m = firstMatch(text, [
      /ending(?:\s*(?:with|in))?\s*[:\-]?\s*(?:[xX*]+\s*)?(\d{4})\b/,
      /(?:[xX*]{2,}\s*)(\d{4})\b/,
      /card(?:\s*(?:no|number))?\.?\s*[:\-]?\s*(?:[xX*]+\s*)?(\d{4})\b/i,
    ]);
    if (m) {
      out.last4 = m[1];
      out.found.push(`Last 4 digits ${m[1]}`);
    }
  }

  // ── Bank ───────────────────────────────────────────────
  for (const b of BANKS) {
    if (b.re.test(text)) {
      out.bankName = b.name;
      out.found.push(`Bank: ${b.name}`);
      break;
    }
  }

  // ── Network keyword (overrides only if BIN gave nothing) ─
  if (!out.network) {
    for (const w of NETWORK_WORDS) {
      if (w.re.test(text)) {
        out.network = w.net;
        break;
      }
    }
  }

  // ── Product / card name ────────────────────────────────
  for (const p of PRODUCTS) {
    if (new RegExp(`\\b${p.replace(/ /g, '\\s*')}\\b`, 'i').test(text)) {
      out.rewardProgram = p;
      const bankShort = out.bankName?.split(' ')[0] ?? '';
      out.name = `${bankShort} ${p}`.trim();
      out.found.push(`Card: ${out.name}`);
      break;
    }
  }

  // ── Amounts ────────────────────────────────────────────
  const total = firstMatch(text, [
    /(?:total\s*(?:amount\s*)?due|total\s*outstanding|current\s*(?:outstanding|balance)|amount\s*payable|closing\s*balance)\s*(?:is|of|[:\-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)/i,
  ]);
  if (total) {
    out.openingBalance = toInt(total[1]);
    out.found.push(`Outstanding ₹${out.openingBalance.toLocaleString('en-IN')}`);
  }

  const minDue = text.match(/min(?:imum)?\.?\s*(?:amount\s*)?due\s*(?:is|of|[:\-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)/i);
  if (minDue) out.minimumDue = toInt(minDue[1]);

  const creditLimit = text.match(/(?:total\s*)?credit\s*limit\s*(?:is|of|[:\-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+)/i);
  if (creditLimit) {
    out.creditLimit = toInt(creditLimit[1]);
    out.found.push(`Credit limit ₹${out.creditLimit.toLocaleString('en-IN')}`);
  }
  const avlLimit = text.match(/(?:avl\.?|available)\s*(?:credit\s*)?limit\s*(?:is|of|[:\-])?\s*(?:rs\.?|inr|₹)?\s*([\d,]+)/i);
  if (avlLimit) out.availableLimit = toInt(avlLimit[1]);
  // "Avl Credit Limit" also matches the credit-limit pattern — if that's the
  // same number and the text is clearly about *available* limit, it's not the
  // total limit. Drop it so we can infer the real total below.
  if (out.creditLimit && out.creditLimit === out.availableLimit && /\b(avl|available)\b/i.test(text)) {
    out.creditLimit = undefined;
    out.found = out.found.filter((f) => !f.startsWith('Credit limit'));
  }
  // If only available limit + outstanding known, infer the total limit.
  if (!out.creditLimit && out.availableLimit && out.openingBalance) {
    out.creditLimit = out.availableLimit + out.openingBalance;
    out.found.push(`Credit limit ≈ ₹${out.creditLimit.toLocaleString('en-IN')} (inferred)`);
  }

  // ── Dates (day-of-month is what the app needs) ─────────
  const due = firstMatch(text, [
    /(?:payment\s*)?due\s*date\s*(?:is|[:\-])?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/i,
    /(?:payment\s*)?due\s*(?:date\s*)?(?:is|on|by)?\s*[:\-]?\s*(\d{1,2})(?:st|nd|rd|th)/i,
    /pay\s*by\s*[:\-]?\s*(\d{1,2})[\/\-.](\d{1,2})/i,
  ]);
  if (due) {
    out.dueDay = clampDay(Number(due[1]));
    out.found.push(`Due day: ${out.dueDay}`);
  }

  const stmt = text.match(/statement\s*(?:date|generated)?\s*(?:is|on|[:\-])?\s*(\d{1,2})[\/\-.](\d{1,2})/i);
  if (stmt) out.statementDay = clampDay(Number(stmt[1]));

  const bill = text.match(/(?:billing|bill)\s*date\s*(?:is|on|[:\-])?\s*(\d{1,2})/i);
  if (bill) out.billingDay = clampDay(Number(bill[1]));

  // ── Expiry ─────────────────────────────────────────────
  const exp = text.match(/(?:valid\s*(?:thru|till|upto|through)|exp(?:iry)?(?:\s*date)?)\s*[:\-]?\s*(\d{1,2})\s*[\/\-]\s*(\d{2,4})/i);
  if (exp) {
    out.expiryMonth = clampMonth(Number(exp[1]));
    const y = Number(exp[2]);
    out.expiryYear = y < 100 ? 2000 + y : y;
    out.found.push(`Expiry ${String(out.expiryMonth).padStart(2, '0')}/${out.expiryYear}`);
  }

  return out;
}

function clampDay(n: number): number {
  return Math.max(1, Math.min(31, n || 1));
}
function clampMonth(n: number): number {
  return Math.max(1, Math.min(12, n || 1));
}

/** Run in-browser OCR on a card image, then parse the recognised text. */
export async function extractFromImage(
  file: File,
  onProgress?: (pct: number, status: string) => void,
): Promise<CardExtract> {
  const Tesseract = await import('tesseract.js');
  const worker = await Tesseract.createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      onProgress?.(Math.round((m.progress ?? 0) * 100), m.status);
    },
  });
  try {
    const { data } = await worker.recognize(file);
    const parsed = parseCardText(data.text);
    // A photographed card face rarely carries statement text, but often shows
    // the number, holder name and expiry — parseCardText already handles those.
    if (!parsed.found.length) parsed.found.push('No fields detected — please fill them in.');
    return parsed;
  } finally {
    await worker.terminate();
  }
}
