export type Trend = 'up' | 'down' | 'equal';

export interface Quote {
  name: string;
  value: number;
  buy: number | null;
  sell: number | null;
  variation: number;
  trend: Trend;
  date: string;
  hasSpread: boolean;
}

export interface HistoryPoint {
  date: string;
  value: number;
}

export interface QuotationConfig {
  name: string;
  fetchURL: string;
  historyURL?: string;
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
