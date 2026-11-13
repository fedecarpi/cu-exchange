import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ElectronService } from '../electron/electron.service';
import { AppPreferences, HISTORY_RANGES, HistoryPoint, HistoryRange, Quote, QuotesStatus, Trend } from './quotes.models';

export const parseAmbitoNumber = (raw: unknown): number | null => {
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
};

export const normalizeQuote = (name: string, raw: any): Quote => {
  const buy = parseAmbitoNumber(raw?.compra);
  const sell = parseAmbitoNumber(raw?.venta);
  const value = parseAmbitoNumber(raw?.valor) ?? buy ?? sell ?? 0;
  const variation = parseAmbitoNumber(raw?.variacion) ?? 0;
  const rawTrend = raw?.['class-variacion'];
  const trend: Trend = rawTrend === 'up' || rawTrend === 'down' || rawTrend === 'equal'
    ? rawTrend
    : variation > 0 ? 'up' : variation < 0 ? 'down' : 'equal';
  const hasSpread = raw?.valor === undefined && buy !== null && sell !== null && buy !== sell;
  return { name, value, buy, sell, variation, trend, date: raw?.fecha ?? '', hasSpread };
};

const toIsoDate = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

@Injectable({
  providedIn: 'root'
})
export class QuotesService {
  readonly quotes$ = new BehaviorSubject<Record<string, Quote>>({});
  readonly status$ = new BehaviorSubject<QuotesStatus>('idle');
  readonly lastUpdated$ = new BehaviorSubject<Date | null>(null);
  readonly preferences$ = new BehaviorSubject<AppPreferences | null>(null);

  private listening = false;

  constructor(private electronService: ElectronService, private zone: NgZone) {}

  init(): void {
    if (this.listening || !this.electronService.isElectron) {
      return;
    }
    this.listening = true;
    const ipc = this.electronService.ipcRenderer;

    ipc.on('update-currency-values-ui', (_event, data: Record<string, any>) => {
      this.zone.run(() => {
        const quotes: Record<string, Quote> = {};
        Object.keys(data ?? {}).forEach(name => {
          quotes[name] = normalizeQuote(name, data[name]);
        });
        this.quotes$.next(quotes);
        this.lastUpdated$.next(new Date());
        this.status$.next('ready');
      });
    });

    ipc.on('currency-values-error', () => {
      this.zone.run(() => this.status$.next('error'));
    });

    ipc.on('load-json-properties', (_event, properties: AppPreferences) => {
      this.zone.run(() => {
        if (properties) {
          this.preferences$.next(properties);
        }
      });
    });
  }

  refresh(): void {
    if (!this.electronService.isElectron) {
      return;
    }
    const hasData = Object.keys(this.quotes$.value).length > 0;
    this.status$.next(hasData ? 'refreshing' : 'loading');
    this.electronService.ipcRenderer.send('get-currency-values', null);
  }

  loadPreferences(): void {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.send('load-preferences', null);
    }
  }

  async getHistory(name: string, range: HistoryRange): Promise<HistoryPoint[]> {
    if (!this.electronService.isElectron) {
      return [];
    }
    const days = HISTORY_RANGES.find(r => r.id === range)?.days ?? 30;
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);
    try {
      const points = await this.electronService.ipcRenderer.invoke('get-currency-history', {
        name,
        from: toIsoDate(from),
        to: toIsoDate(to)
      });
      return Array.isArray(points) ? points : [];
    } catch {
      return [];
    }
  }
}
