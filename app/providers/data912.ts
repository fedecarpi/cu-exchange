import axios from 'axios';
import {
  CatalogItem, Category, HistoryPoint, NormalizedQuote, QuotationConfig, QuoteCurrency, QuoteProvider,
  REQUEST_TIMEOUT_MS, nowLabel, symbolOf, toNumber, trendOf
} from './types';

const BASE_URL = 'https://data912.com';
const LIVE_TTL_MS = 30 * 1000;
const HISTORY_TTL_MS = 60 * 60 * 1000;

const ENDPOINTS: Partial<Record<Category, { live: string; history: string }>> = {
  acciones: { live: 'arg_stocks', history: 'stocks' },
  cedears: { live: 'arg_cedears', history: 'cedears' },
  bonos: { live: 'arg_bonds', history: 'bonds' }
};

interface LiveRow {
  symbol: string;
  px_bid: number | null;
  px_ask: number | null;
  c: number | null;
  pct_change: number | null;
}

interface LiveSnapshot {
  timestamp: number;
  rows: Map<string, LiveRow>;
}

const liveCache = new Map<Category, LiveSnapshot>();
const pendingLive = new Map<Category, Promise<LiveSnapshot>>();
const historyCache = new Map<string, { timestamp: number; points: HistoryPoint[] }>();

function endpointsFor(category: Category) {
  const endpoints = ENDPOINTS[category];
  if (!endpoints) {
    throw new Error('data912 does not support category ' + category);
  }
  return endpoints;
}

async function loadLive(category: Category): Promise<LiveSnapshot> {
  const cached = liveCache.get(category);
  if (cached && Date.now() - cached.timestamp < LIVE_TTL_MS) {
    return cached;
  }
  const pending = pendingLive.get(category);
  if (pending) {
    return pending;
  }
  const request = axios.get(`${BASE_URL}/live/${endpointsFor(category).live}`, { timeout: REQUEST_TIMEOUT_MS })
    .then(resp => {
      const rows = new Map<string, LiveRow>();
      (Array.isArray(resp.data) ? resp.data : []).forEach(row => {
        if (row && typeof row.symbol === 'string') {
          rows.set(row.symbol.toUpperCase(), row);
        }
      });
      const snapshot = { timestamp: Date.now(), rows };
      liveCache.set(category, snapshot);
      pendingLive.delete(category);
      return snapshot;
    }, err => {
      pendingLive.delete(category);
      throw err;
    });
  pendingLive.set(category, request);
  return request;
}

// MEP (`D`) and CCL (`C`) species of CEDEARs and bonds trade in dollars; stocks like YPFD are pesos.
function currencyOf(category: Category, symbol: string, rows: Map<string, LiveRow>): QuoteCurrency {
  if (category === 'acciones' || symbol.length < 3) {
    return 'ARS';
  }
  const suffix = symbol.slice(-1);
  return (suffix === 'D' || suffix === 'C') && rows.has(symbol.slice(0, -1)) ? 'USD' : 'ARS';
}

function priceOf(row: LiveRow): number {
  return toNumber(row.c) || toNumber(row.px_bid) || toNumber(row.px_ask) || 0;
}

function normalize(name: string, category: Category, symbol: string, row: LiveRow, rows: Map<string, LiveRow>): NormalizedQuote {
  const buy = toNumber(row.px_bid) || null;
  const sell = toNumber(row.px_ask) || null;
  const variation = toNumber(row.pct_change) ?? 0;
  return {
    name,
    value: priceOf(row),
    buy,
    sell,
    variation,
    trend: trendOf(variation),
    date: nowLabel(),
    hasSpread: buy !== null && sell !== null && buy !== sell,
    currency: currencyOf(category, symbol, rows)
  };
}

async function loadHistory(category: Category, symbol: string): Promise<HistoryPoint[]> {
  const key = `${category}|${symbol}`;
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.timestamp < HISTORY_TTL_MS) {
    return cached.points;
  }
  const url = `${BASE_URL}/historical/${endpointsFor(category).history}/${encodeURIComponent(symbol)}`;
  const resp = await axios.get(url, { timeout: REQUEST_TIMEOUT_MS });
  const points = (Array.isArray(resp.data) ? resp.data : [])
    .map(row => ({ date: String(row?.date ?? '').slice(0, 10), value: toNumber(row?.c) }))
    .filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.value !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  historyCache.set(key, { timestamp: Date.now(), points });
  return points;
}

export const data912Provider: QuoteProvider = {
  async fetchQuotes(quotations: QuotationConfig[]) {
    const byCategory = new Map<Category, QuotationConfig[]>();
    quotations.forEach(q => byCategory.set(q.category, [...(byCategory.get(q.category) ?? []), q]));

    const quotes: Record<string, NormalizedQuote> = {};
    let failures = 0;
    await Promise.all(Array.from(byCategory.entries()).map(async ([category, items]) => {
      try {
        const { rows } = await loadLive(category);
        items.forEach(q => {
          const symbol = symbolOf(q);
          const row = rows.get(symbol);
          if (row) {
            quotes[q.name] = normalize(q.name, category, symbol, row, rows);
          }
        });
      } catch {
        failures++;
      }
    }));
    if (byCategory.size > 0 && failures === byCategory.size) {
      throw new Error('data912 did not return any quote');
    }
    return quotes;
  },

  async fetchHistory(quotation, from, to) {
    const points = await loadHistory(quotation.category, symbolOf(quotation));
    return points.filter(p => p.date >= from && p.date <= to);
  },

  async fetchCatalog(category) {
    const { rows } = await loadLive(category);
    const items: CatalogItem[] = [];
    rows.forEach((row, symbol) => {
      items.push({
        name: symbol,
        symbol,
        price: priceOf(row),
        variation: toNumber(row.pct_change) ?? 0,
        currency: currencyOf(category, symbol, rows)
      });
    });
    return items.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }
};
