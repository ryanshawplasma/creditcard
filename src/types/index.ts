/**
 * Domain model for CreditVault AI.
 *
 * The schema is intentionally normalized (owners ← cards ← payments /
 * transactions / documents / reminders) and forward-compatible so future
 * liability modules (loans, insurance, investments, FDs, …) can be added
 * as sibling entities without reshaping existing tables.
 */

export type ISODate = string; // 'YYYY-MM-DD'
export type ISODateTime = string; // full ISO 8601 timestamp

export type CardNetwork = 'Visa' | 'Mastercard' | 'RuPay' | 'Amex' | 'Discover' | 'Diners';
export type CardStatus = 'Active' | 'Closed' | 'Blocked';
export type Relationship = 'Family' | 'Employee' | 'Friend' | 'Business' | 'Self';
export type RewardType = 'Points' | 'Cashback' | 'Miles' | 'None';
export type SpendCategory =
  | 'Shopping'
  | 'Dining'
  | 'Travel'
  | 'Fuel'
  | 'Groceries'
  | 'Bills'
  | 'Entertainment'
  | 'Health'
  | 'Education'
  | 'Other';

export type PaymentMode =
  | 'UPI'
  | 'NetBanking'
  | 'AutoDebit'
  | 'NEFT'
  | 'IMPS'
  | 'Cash'
  | 'Cheque'
  | 'Card';

export interface Owner {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  department?: string;
  relationship: Relationship;
  photo?: string; // data URL
  notes?: string;
  color: string; // hex accent used across the UI
  favorite?: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Bank {
  id: string;
  name: string;
  shortName?: string;
  color: string;
  supportPhone?: string;
  website?: string;
}

/**
 * Sensitive fields (full card number, CVV) are NEVER stored in plaintext.
 * They live only in `secure` as an AES-GCM ciphertext blob keyed by a
 * password-derived master key. The list UI only ever needs `last4`.
 */
export interface EncryptedBlob {
  iv: string; // base64
  ciphertext: string; // base64
}

export interface CardSecure {
  cardNumber?: EncryptedBlob;
  cvv?: EncryptedBlob;
  secureNotes?: EncryptedBlob;
}

export interface Card {
  id: string;
  name: string; // e.g. "Amazon Pay ICICI"
  bankId: string;
  network: CardNetwork;
  ownerId: string;
  last4: string;

  expiryMonth: number; // 1-12
  expiryYear: number; // full year

  creditLimit: number;
  cashLimit?: number;
  /** Outstanding at the moment the card was added, before tracked activity. */
  baselineBalance: number;
  currentBalance: number; // outstanding — auto-updated by payments/transactions

  billingDay: number; // day of month the cycle closes
  statementDay: number; // day statement is generated
  dueDay: number; // day of month payment is due

  interestRate?: number; // annual %
  annualFee?: number;
  annualFeeMonth?: number; // month the annual fee hits

  rewardType: RewardType;
  rewardProgram?: string;
  rewardPoints?: number;
  rewardRate?: number; // points/₹ or % cashback base rate

  /** Category multipliers used by the "best card to use" engine. */
  rewardBoosts?: Partial<Record<SpendCategory, number>>;

  autoDebit: boolean;
  linkedBank?: string;

  status: CardStatus;
  color: string; // gradient key / hex
  icon?: string; // emoji or lucide name
  image?: string; // uploaded card art data URL
  notes?: string;

  pinned?: boolean;
  tags?: string[];

  secure?: CardSecure;

  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Payment {
  id: string;
  cardId: string;
  amount: number;
  date: ISODate;
  paidById?: string; // owner id
  mode: PaymentMode;
  reference?: string;
  bank?: string;
  screenshot?: string; // data URL
  notes?: string;
  createdAt: ISODateTime;
}

export interface Transaction {
  id: string;
  cardId: string;
  amount: number;
  date: ISODate;
  merchant: string;
  category: SpendCategory;
  notes?: string;
  isEMI?: boolean;
  emiId?: string;
  createdAt: ISODateTime;
}

export interface EMIPlan {
  id: string;
  cardId: string;
  description: string;
  principal: number;
  monthlyAmount: number;
  totalMonths: number;
  paidMonths: number;
  interestRate?: number;
  startDate: ISODate;
  createdAt: ISODateTime;
}

export type DocumentKind =
  | 'Statement'
  | 'Agreement'
  | 'KYC'
  | 'Receipt'
  | 'Photo'
  | 'Other';

export interface DocumentFile {
  id: string;
  name: string;
  kind: DocumentKind;
  mime: string;
  size: number;
  dataUrl: string;
  cardId?: string;
  ownerId?: string;
  createdAt: ISODateTime;
}

export type ReminderChannel = 'Desktop' | 'Email' | 'Telegram' | 'SMS';

export interface ReminderRule {
  id: string;
  /** Days before due date to fire. */
  offsets: number[];
  timeOfDay: ('Morning' | 'Evening')[];
  channels: ReminderChannel[];
  includeDueToday: boolean;
  includeOverdue: boolean;
}

export interface DismissedReminder {
  id: string; // `${cardId}:${dueDate}:${offset}`
  cardId: string;
  dueDate: ISODate;
  offset: number;
  dismissedAt: ISODateTime;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  detail?: string;
  at: ISODateTime;
}

export interface AppUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  /** PBKDF2 verifier — never the password itself. */
  pwHash: string;
  pwSalt: string;
  /** Salt used to derive the AES master key for field encryption. */
  keySalt: string;
  createdAt: ISODateTime;
}

export interface Settings {
  id: 'app'; // singleton
  theme: 'dark' | 'light';
  accent: string; // accent key
  currency: string;
  locale: string;
  sessionTimeoutMin: number;
  reminder: ReminderRule;
  telegram?: { botToken?: string; chatId?: string; enabled: boolean };
  email?: { address?: string; enabled: boolean };
  dashboardOrder?: string[];
}

/** A computed, non-persisted view of an upcoming obligation. */
export interface DueItem {
  card: Card;
  owner?: Owner;
  bank?: Bank;
  dueDate: ISODate;
  amount: number;
  daysUntil: number;
  status: 'overdue' | 'today' | 'soon' | 'upcoming';
  minimumDue: number;
}
