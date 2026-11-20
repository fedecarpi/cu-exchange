import axios from 'axios';
import { HistoryPoint, NormalizedQuote, QuotationConfig, QuoteProvider, REQUEST_TIMEOUT_MS, Trend, trendOf } from './types';

const AMBITO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Referer': 'https://www.ambito.com/',
  'Origin': 'https://www.ambito.com',
};

export function parseAmbitoNumber(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (typeof raw === 'number') {
    return raw;
  }
  let text = String(raw).replace('%', '').trim();
  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalize(name: string, raw: any): NormalizedQuote {
  const buy = parseAmbitoNumber(raw?.compra);
  const sell = parseAmbitoNumber(raw?.venta);
  const value = parseAmbitoNumber(raw?.valor) ?? buy ?? sell ?? 0;
  const variation = parseAmbitoNumber(raw?.variacion) ?? 0;
  const rawTrend = raw?.['class-variacion'];
  const trend: Trend = rawTrend === 'up' || rawTrend === 'down' || rawTrend === 'equal' ? rawTrend : trendOf(variation);
  const hasSpread = raw?.valor === undefined && buy !== null && sell !== null && buy !== sell;
  return { name, value, buy, sell, variation, trend, date: raw?.fecha ?? '', hasSpread, currency: 'ARS' };
}

function historyURLFor(quotation: QuotationConfig, from: string, to: string) {
  if (quotation.historyURL) {
    return quotation.historyURL.replace('{from}', from).replace('{to}', to);
  }
  if (quotation.fetchURL && /\/variacion\/?$/.test(quotation.fetchURL)) {
    return quotation.fetchURL.replace(/\/variacion\/?$/, `/historico-general/${from}/${to}`);
  }
  return null;
}

// Ambito returns [["Fecha","Compra","Venta"], ["dd/mm/yyyy","1.234,56",...], ...] with duplicates and no stable order.
function parseHistory(rows): HistoryPoint[] {
  if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) {
    return [];
  }
  const header = rows[0].map(h => String(h).toLowerCase());
  let column = header.indexOf('compra');
  if (column < 0) {
    column = header.length - 1;
  }
  const byDate = new Map<string, number>();
  rows.slice(1).forEach(row => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(row[0]));
    const value = parseAmbitoNumber(row[column]);
    if (match && value !== null) {
      byDate.set(`${match[3]}-${match[2]}-${match[1]}`, value);
    }
  });
  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export const ambitoProvider: QuoteProvider = {
  async fetchQuotes(quotations) {
    const withURL = quotations.filter(q => q.fetchURL);
    const results = await Promise.all(withURL.map(q =>
      axios.get(q.fetchURL, { timeout: REQUEST_TIMEOUT_MS })
        .then(resp => normalize(q.name, resp.data))
        .catch(() => null)
    ));
    const quotes: Record<string, NormalizedQuote> = {};
    results.forEach(quote => {
      if (quote) {
        quotes[quote.name] = quote;
      }
    });
    if (withURL.length > 0 && Object.keys(quotes).length === 0) {
      throw new Error('Ámbito did not return any quote');
    }
    return quotes;
  },

  async fetchHistory(quotation, from, to) {
    const url = historyURLFor(quotation, from, to);
    if (!url) {
      return [];
    }
    const resp = await axios.get(url, { headers: AMBITO_HEADERS, timeout: REQUEST_TIMEOUT_MS });
    return parseHistory(resp.data);
  }
};
