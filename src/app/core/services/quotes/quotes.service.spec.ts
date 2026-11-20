import { formatPrice, fractionDigitsFor } from './quotes.models';
import { normalizeQuote, parseAmbitoNumber } from './quotes.service';

describe('QuotesService helpers', () => {
  it('should parse Ambito formatted numbers', () => {
    expect(parseAmbitoNumber('1.550,25')).toBe(1550.25);
    expect(parseAmbitoNumber('-0,40%')).toBe(-0.4);
    expect(parseAmbitoNumber('1550.5')).toBe(1550.5);
    expect(parseAmbitoNumber('')).toBeNull();
    expect(parseAmbitoNumber('n/a')).toBeNull();
  });

  it('should normalize a quote with buy and sell', () => {
    const raw: Record<string, string> = { compra: '1550,00', venta: '1570,00', fecha: '13/11/2026 - 16:05', variacion: '0,32%' };
    raw['class-variacion'] = 'up';
    const quote = normalizeQuote('informal', raw);
    expect(quote).toEqual({
      name: 'informal', value: 1550, buy: 1550, sell: 1570, variation: 0.32, trend: 'up', date: '13/11/2026 - 16:05', hasSpread: true,
      currency: 'ARS'
    });
  });

  it('should prefer `valor` and derive the trend when it is missing', () => {
    const quote = normalizeQuote('ahorro', { compra: '1518,35', venta: '3143,60', valor: '3143,60', variacion: '-1,00%' });
    expect(quote.value).toBe(3143.6);
    expect(quote.trend).toBe('down');
    expect(quote.hasSpread).toBeFalse();
  });

  it('should pass through quotes already normalized by the main process', () => {
    const quote = normalizeQuote('AL30D', {
      name: 'AL30D', value: 47.5, buy: 47.5, sell: 47.58, variation: -4.56, trend: 'down', date: '20/11/2026 - 18:07',
      hasSpread: true, currency: 'USD'
    });
    expect(quote).toEqual({
      name: 'AL30D', value: 47.5, buy: 47.5, sell: 47.58, variation: -4.56, trend: 'down', date: '20/11/2026 - 18:07',
      hasSpread: true, currency: 'USD'
    });
  });

  it('should keep significant decimals for small prices', () => {
    expect(fractionDigitsFor(1550)).toBe(2);
    expect(fractionDigitsFor(0.1099)).toBe(4);
    expect(formatPrice(0.001372)).toBe('0,001372');
    expect(formatPrice(58388.01)).toBe('58.388,01');
  });
});
