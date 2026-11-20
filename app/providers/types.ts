export type Category = 'dolar' | 'acciones' | 'cedears' | 'bonos' | 'cripto';
export type Source = 'ambito' | 'data912' | 'binance';
export type Trend = 'up' | 'down' | 'equal';
export type QuoteCurrency = 'ARS' | 'USD';

export interface QuotationConfig {
  name: string;
  category: Category;
  source: Source;
  symbol?: string;
  fetchURL?: string;
  historyURL?: string;
}

export interface NormalizedQuote {
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

export interface CatalogItem {
  /** Name the quotation gets once added to the config. */
  name: string;
  symbol: string;
  price: number;
  variation: number;
  currency: QuoteCurrency;
}

export interface QuoteProvider {
  fetchQuotes(quotations: QuotationConfig[]): Promise<Record<string, NormalizedQuote>>;
  fetchHistory(quotation: QuotationConfig, from: string, to: string): Promise<HistoryPoint[]>;
  fetchCatalog?(category: Category): Promise<CatalogItem[]>;
}

export const REQUEST_TIMEOUT_MS = 15000;

export const trendOf = (variation: number): Trend => variation > 0 ? 'up' : variation < 0 ? 'down' : 'equal';

export const symbolOf = (quotation: QuotationConfig): string => (quotation.symbol || quotation.name).toUpperCase();

export const nowLabel = (): string => {
  const date = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} - ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const toNumber = (raw: unknown): number | null => {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};
