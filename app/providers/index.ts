import { ambitoProvider } from './ambito';
import { binanceProvider } from './binance';
import { data912Provider } from './data912';
import { Category, QuotationConfig, QuoteProvider, Source } from './types';

export * from './types';

export const PROVIDERS: Record<Source, QuoteProvider> = {
  ambito: ambitoProvider,
  data912: data912Provider,
  binance: binanceProvider
};

export const CATEGORY_SOURCES: Record<Category, Source> = {
  dolar: 'ambito',
  acciones: 'data912',
  cedears: 'data912',
  bonos: 'data912',
  cripto: 'binance'
};

const isCategory = (value: unknown): value is Category => typeof value === 'string' && value in CATEGORY_SOURCES;

/** Fills `category` and `source` on configs written before multi-asset support (all of them Ámbito dollars). */
export function normalizeQuotation(raw: any): QuotationConfig | null {
  if (!raw || typeof raw.name !== 'string' || !raw.name) {
    return null;
  }
  const category: Category = isCategory(raw.category) ? raw.category : 'dolar';
  const source: Source = raw.source in PROVIDERS ? raw.source : CATEGORY_SOURCES[category];
  if (source === 'ambito' && !raw.fetchURL) {
    return null;
  }
  return { ...raw, category, source };
}
