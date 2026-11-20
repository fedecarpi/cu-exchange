export type Trend = 'up' | 'down' | 'equal';

export type Category = 'dolar' | 'acciones' | 'cedears' | 'bonos' | 'cripto';

export type Source = 'ambito' | 'data912' | 'binance';

export type QuoteCurrency = 'ARS' | 'USD';

export interface Quote {
  name: string;
  value: number;
  buy: number | null;
  sell: number | null;
  variation: number;
  trend: Trend;
  date: string;
  hasSpread: boolean;
  currency: QuoteCurrency;
}

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface QuotationConfig {
  name: string;
  category: Category;
  source: Source;
  /** Ticker used by data912 and Binance. Defaults to `name`. */
  symbol?: string;
  /** Ámbito only. */
  fetchURL?: string;
  historyURL?: string;
}

export interface CatalogItem {
  /** Name the quotation gets once added to the config. */
  name: string;
  symbol: string;
  price: number;
  variation: number;
  currency: QuoteCurrency;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface AppPreferences {
  quotations: QuotationConfig[];
  defaultCurrency: string;
  showCurrencies: string[];
  theme?: ThemeMode;
}

export type QuotesStatus = 'idle' | 'loading' | 'refreshing' | 'ready' | 'error';

export type HistoryRange = '7D' | '1M' | '3M' | '6M' | '1A';

export const HISTORY_RANGES: { id: HistoryRange; days: number }[] = [
  { id: '7D', days: 7 },
  { id: '1M', days: 30 },
  { id: '3M', days: 90 },
  { id: '6M', days: 182 },
  { id: '1A', days: 365 }
];

export const CATEGORIES: { id: Category; label: string; icon: string; source: Source }[] = [
  { id: 'dolar', label: 'CATEGORIES.DOLAR', icon: 'bi-currency-dollar', source: 'ambito' },
  { id: 'acciones', label: 'CATEGORIES.ACCIONES', icon: 'bi-building', source: 'data912' },
  { id: 'cedears', label: 'CATEGORIES.CEDEARS', icon: 'bi-globe-americas', source: 'data912' },
  { id: 'bonos', label: 'CATEGORIES.BONOS', icon: 'bi-bank', source: 'data912' },
  { id: 'cripto', label: 'CATEGORIES.CRIPTO', icon: 'bi-currency-bitcoin', source: 'binance' }
];

export const MAX_SHOWN_PER_CATEGORY = 5;

export const categoryOf = (quotation: Partial<QuotationConfig> | undefined): Category => quotation?.category ?? 'dolar';

export const currencySymbol = (currency: QuoteCurrency | undefined): string => currency === 'USD' ? 'US$' : '$';

/** Keeps sub-dollar crypto prices readable instead of rounding them to 0,00. */
export const fractionDigitsFor = (value: number | null | undefined): number => {
  const abs = Math.abs(value ?? 0);
  if (abs === 0 || abs >= 1) {
    return 2;
  }
  return Math.min(8, Math.max(2, 1 - Math.floor(Math.log10(abs)) + 2));
};

const formatters = new Map<number, Intl.NumberFormat>();

export const formatPrice = (value: number): string => {
  const digits = fractionDigitsFor(value);
  let formatter = formatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: digits });
    formatters.set(digits, formatter);
  }
  return formatter.format(value);
};
