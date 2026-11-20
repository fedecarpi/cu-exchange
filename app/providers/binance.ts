import axios from 'axios';
import { CatalogItem, HistoryPoint, NormalizedQuote, QuotationConfig, QuoteProvider, REQUEST_TIMEOUT_MS, nowLabel, symbolOf, toNumber, trendOf } from './types';

const BASE_URL = 'https://api.binance.com/api/v3';
const QUOTE_ASSET = 'USDT';
const CATALOG_TTL_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Ticker {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  bidPrice: string;
  askPrice: string;
  count: number;
}

let catalogCache: { timestamp: number; items: CatalogItem[] } | null = null;

const nameFor = (symbol: string) => symbol.endsWith(QUOTE_ASSET) ? symbol.slice(0, -QUOTE_ASSET.length) : symbol;

function normalize(name: string, ticker: Ticker): NormalizedQuote {
  const buy = toNumber(ticker.bidPrice) || null;
  const sell = toNumber(ticker.askPrice) || null;
  const variation = toNumber(ticker.priceChangePercent) ?? 0;
  return {
    name,
    value: toNumber(ticker.lastPrice) ?? 0,
    buy,
    sell,
    variation,
    trend: trendOf(variation),
    date: nowLabel(),
    hasSpread: false,
    currency: 'USD'
  };
}

async function fetchTickers(symbols: string[]): Promise<Ticker[]> {
  const resp = await axios.get(`${BASE_URL}/ticker/24hr`, {
    params: { symbols: JSON.stringify(symbols) },
    timeout: REQUEST_TIMEOUT_MS
  });
  return Array.isArray(resp.data) ? resp.data : [];
}

const toIsoDate = (time: number) => new Date(time).toISOString().slice(0, 10);

export const binanceProvider: QuoteProvider = {
  async fetchQuotes(quotations: QuotationConfig[]) {
    const quotes: Record<string, NormalizedQuote> = {};
    if (quotations.length === 0) {
      return quotes;
    }
    const symbols = Array.from(new Set(quotations.map(symbolOf)));
    let tickers: Ticker[];
    try {
      tickers = await fetchTickers(symbols);
    } catch (err) {
      // A single unknown symbol makes Binance reject the whole batch.
      if (err?.response?.status !== 400) {
        throw err;
      }
      const single = await Promise.all(symbols.map(s => fetchTickers([s]).catch((): Ticker[] => [])));
      tickers = single.reduce((all, list) => all.concat(list), []);
    }
    const bySymbol = new Map(tickers.map(t => [t.symbol, t] as [string, Ticker]));
    quotations.forEach(q => {
      const ticker = bySymbol.get(symbolOf(q));
      if (ticker) {
        quotes[q.name] = normalize(q.name, ticker);
      }
    });
    return quotes;
  },

  async fetchHistory(quotation, from, to) {
    const startTime = new Date(`${from}T00:00:00Z`).getTime();
    const endTime = new Date(`${to}T23:59:59Z`).getTime();
    const resp = await axios.get(`${BASE_URL}/klines`, {
      params: {
        symbol: symbolOf(quotation),
        interval: '1d',
        startTime,
        endTime,
        limit: Math.min(1000, Math.ceil((endTime - startTime) / DAY_MS) + 1)
      },
      timeout: REQUEST_TIMEOUT_MS
    });
    // Each kline is [openTime, open, high, low, close, ...].
    return (Array.isArray(resp.data) ? resp.data : [])
      .map(k => ({ date: toIsoDate(Number(k[0])), value: toNumber(k[4]) }))
      .filter(p => p.value !== null);
  },

  async fetchCatalog() {
    if (catalogCache && Date.now() - catalogCache.timestamp < CATALOG_TTL_MS) {
      return catalogCache.items;
    }
    const resp = await axios.get(`${BASE_URL}/ticker/24hr`, { timeout: REQUEST_TIMEOUT_MS });
    const items: CatalogItem[] = (Array.isArray(resp.data) ? resp.data : [])
      .filter((t: Ticker) => t.symbol.endsWith(QUOTE_ASSET) && t.count > 0 && toNumber(t.lastPrice))
      .map((t: Ticker) => ({
        name: nameFor(t.symbol),
        symbol: t.symbol,
        price: toNumber(t.lastPrice) ?? 0,
        variation: toNumber(t.priceChangePercent) ?? 0,
        currency: 'USD' as const
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    catalogCache = { timestamp: Date.now(), items };
    return items;
  }
};
