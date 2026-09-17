export type Currency = 'CNY' | 'USD' | 'JPY' | 'KRW' | 'EUR' | 'THB';

export type Category = 
  | '餐饮'
  | '交通'
  | '住宿'
  | '门票'
  | '购物'
  | '娱乐'
  | '机票'
  | '咖啡'
  | '超市'
  | '其他';

export const CATEGORY_EMOJIS: Record<Category, string> = {
  '餐饮': '🍜',
  '交通': '🚕',
  '住宿': '🏨',
  '门票': '🎫',
  '购物': '🛍',
  '娱乐': '🍺',
  '机票': '✈️',
  '咖啡': '☕',
  '超市': '🛒',
  '其他': '📦',
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  CNY: '¥',
  USD: '$',
  JPY: '¥',
  KRW: '₩',
  EUR: '€',
  THB: '฿',
};

export const CURRENCY_NAMES: Record<Currency, string> = {
  CNY: '人民币 CNY',
  USD: '美元 USD',
  JPY: '日元 JPY',
  KRW: '韩元 KRW',
  EUR: '欧元 EUR',
  THB: '泰铢 THB',
};

// Default exchange rates relative to 1 CNY
export const DEFAULT_EXCHANGE_RATES: Record<Currency, number> = {
  CNY: 1.0,
  USD: 0.138,       // 1 CNY = 0.138 USD (1 USD ≈ 7.24 CNY)
  JPY: 21.3,        // 1 CNY = 21.3 JPY
  KRW: 190.0,       // 1 CNY = 190 KRW
  EUR: 0.128,       // 1 CNY = 0.128 EUR (1 EUR ≈ 7.8 CNY)
  THB: 5.05,        // 1 CNY = 5.05 THB
};

export type SplitType = 'equal' | 'exact' | 'ratio' | 'custom';

export interface TripMember {
  id: string;
  tripId: string;
  name: string;
  isCurrentUser: boolean;
  avatarColor: string;
  createdAt: string;
}

export interface ExpensePayer {
  id?: string;
  expenseId?: string;
  memberId: string;
  amount: number; // In expense currency
}

export interface ExpenseParticipant {
  id?: string;
  expenseId?: string;
  memberId: string;
  share: number; // In expense currency
  shareRatio?: number;
}

export interface Expense {
  id: string;
  tripId: string;
  title: string;
  category: Category;
  amount: number; // In expense currency
  currency: Currency;
  settlementAmount: number; // In trip's settlement currency
  exchangeRate: number; // 1 SettlementCurrency = X ExpenseCurrency
  date: string; // YYYY-MM-DD
  splitType: SplitType;
  notes?: string;
  payers: ExpensePayer[];
  participants: ExpenseParticipant[];
  createdAt: string;
  updatedAt?: string;
}

export interface Settlement {
  id: string;
  tripId: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number; // In trip's settlement currency
  currency: Currency;
  settledAt: string;
  note?: string;
  expenseId?: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  settlementCurrency: Currency;
  accessCode: string;
  members: TripMember[];
  expenses?: Expense[];
  settlements?: Settlement[];
  createdAt: string;
  updatedAt?: string;
}

export interface DebtTransfer {
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: number; // In settlement currency
  currency: Currency;
  isSimplified?: boolean;
  explanation?: string;
  originalDirectAmount?: number;
}

export interface MemberBalance {
  memberId: string;
  memberName: string;
  isCurrentUser: boolean;
  avatarColor: string;
  totalPaid: number; // In settlement currency
  totalShare: number; // In settlement currency
  netBalance: number; // totalPaid - totalShare + settlementsReceived - settlementsPaid
}

export interface AiExpenseDraft {
  title: string;
  category: Category;
  amount: number;
  currency: Currency;
  date: string;
  splitType: SplitType;
  payers: { memberName: string; memberId?: string; amount: number }[];
  participants: { memberName: string; memberId?: string; share: number; shareRatio?: number }[];
  rawText?: string;
  needClarification?: boolean;
  clarificationQuestion?: string;
  clarificationOptions?: string[];
  exchangeRate?: number;
  notes?: string;
}

export interface AiTripDraft {
  name: string;
  destination: string;
  creatorName?: string;
  members: string[];
  startDate: string;
  endDate: string;
  settlementCurrency: Currency;
  accessCode?: string;
}

export interface TripSummary {
  totalExpense: number; // In settlement currency
  myPaid: number;       // In settlement currency
  myShare: number;      // In settlement currency
  myNetBalance: number; // In settlement currency (+ others owe me, - I owe others)
  billCount: number;
  memberCount: number;
}
