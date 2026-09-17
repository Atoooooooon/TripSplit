import { Currency, DEFAULT_EXCHANGE_RATES } from '../types';

/**
 * Returns number of decimal places for a currency.
 * KRW and JPY typically use 0 decimal places.
 * CNY, USD, EUR, THB use 2 decimal places.
 */
export function getCurrencyDecimals(currency: Currency): number {
  switch (currency) {
    case 'KRW':
    case 'JPY':
      return 0;
    default:
      return 2;
  }
}

/**
 * Multiplier to convert to the smallest currency unit (integer cents).
 */
export function getCurrencyMultiplier(currency: Currency): number {
  return Math.pow(10, getCurrencyDecimals(currency));
}

/**
 * Round currency to its standard decimal precision safely.
 */
export function roundCurrency(amount: number, currency: Currency): number {
  const mult = getCurrencyMultiplier(currency);
  return Math.round(amount * mult) / mult;
}

/**
 * Splits a total amount equally among N members without losing any remainder cents.
 * Ensures sum(shares) === totalAmount exactly.
 *
 * E.g., 100 CNY divided among 3 members:
 * [33.34, 33.33, 33.33] (sum = 100.00)
 */
export function splitEqually(totalAmount: number, memberCount: number, currency: Currency): number[] {
  if (memberCount <= 0) return [];
  if (memberCount === 1) return [roundCurrency(totalAmount, currency)];

  const mult = getCurrencyMultiplier(currency);
  const totalCents = Math.round(totalAmount * mult);

  const baseCents = Math.floor(totalCents / memberCount);
  const remainderCents = totalCents - baseCents * memberCount;

  const shares: number[] = [];
  for (let i = 0; i < memberCount; i++) {
    // Distribute remainder cents to first few members
    const shareCents = i < remainderCents ? baseCents + 1 : baseCents;
    shares.push(shareCents / mult);
  }

  return shares;
}

/**
 * Formats a currency amount nicely with its symbol.
 */
export function formatMoney(amount: number, currency: Currency = 'CNY', showSymbol: boolean = true): string {
  const decimals = getCurrencyDecimals(currency);
  const formatted = Math.abs(amount).toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const sign = amount < 0 ? '-' : '';
  if (!showSymbol) return `${sign}${formatted}`;

  const symbols: Record<Currency, string> = {
    CNY: '¥',
    USD: '$',
    JPY: '¥',
    KRW: '₩',
    EUR: '€',
    THB: '฿',
  };

  return `${sign}${symbols[currency] || '¥'}${formatted}`;
}

/**
 * Converts an amount from expense currency to trip settlement currency.
 * Exchange rate represents: 1 SettlementCurrency = rate ExpenseCurrency
 * Therefore: SettlementAmount = ExpenseAmount / rate
 */
export function convertCurrency(
  amount: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  customRate?: number
): { settlementAmount: number; exchangeRate: number } {
  if (fromCurrency === toCurrency) {
    return { settlementAmount: roundCurrency(amount, toCurrency), exchangeRate: 1.0 };
  }

  // If a custom rate was provided, use it
  if (customRate && customRate > 0) {
    const settlementAmount = roundCurrency(amount / customRate, toCurrency);
    return { settlementAmount, exchangeRate: customRate };
  }

  // Default exchange rate calculation via CNY bridge
  const fromRateToCNY = DEFAULT_EXCHANGE_RATES[fromCurrency] || 1;
  const toRateToCNY = DEFAULT_EXCHANGE_RATES[toCurrency] || 1;

  // 1 toCurrency in CNY = 1 / toRateToCNY
  // 1 toCurrency in fromCurrency = (1 / toRateToCNY) * fromRateToCNY = fromRateToCNY / toRateToCNY
  const exchangeRate = fromRateToCNY / toRateToCNY;
  const settlementAmount = roundCurrency(amount / exchangeRate, toCurrency);

  return { settlementAmount, exchangeRate };
}
