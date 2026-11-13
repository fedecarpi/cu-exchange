import { animate, style, transition, trigger } from '@angular/animations';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ColorType,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
  LineStyle,
  MouseEventParams,
  Time,
  createChart
} from 'lightweight-charts';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ElectronService, HISTORY_RANGES, HistoryPoint, HistoryRange, Quote, QuotesService } from '../core/services';

interface HistoryStats {
  first: number;
  last: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  average: number;
}

interface TooltipState {
  x: number;
  y: number;
  flip: boolean;
  date: string;
  value: number;
}

const priceFormatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

const timeToDate = (time: Time): Date => {
  if (typeof time === 'number') {
    return new Date(time * 1000);
  }
  if (typeof time === 'string') {
    const [y, m, d] = time.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(time.year, time.month - 1, time.day);
};

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
  animations: [
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(4px)' }),
        animate('240ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'none' }))
      ]),
      transition(':leave', [animate('120ms ease-in', style({ opacity: 0 }))])
    ])
  ]
})
export class HistoryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartContainer', { static: true }) chartContainer!: ElementRef<HTMLElement>;

  readonly ranges = HISTORY_RANGES;
  readonly isMac = !!window.process && window.process.platform === 'darwin';

  currency = '';
  currencies: string[] = [];
  range: HistoryRange = '1M';
  points: HistoryPoint[] = [];
  stats: HistoryStats | null = null;
  quote: Quote | null = null;
  loading = true;
  tooltip: TooltipState | null = null;

  private chart?: IChartApi;
  private series?: ISeriesApi<'Area'>;
  private requestId = 0;
  private destroy$ = new Subject<void>();
  private colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  private readonly onColorSchemeChange: () => void;

  constructor(
    private route: ActivatedRoute,
    private quotesService: QuotesService,
    private electronService: ElectronService,
    private zone: NgZone
  ) {
    this.onColorSchemeChange = () => this.applyTheme();
  }

  get rangeIndex(): number {
    return Math.max(0, this.ranges.findIndex(r => r.id === this.range));
  }

  get trend(): 'up' | 'down' | 'equal' {
    if (!this.stats || this.stats.change === 0) {
      return 'equal';
    }
    return this.stats.change > 0 ? 'up' : 'down';
  }

  ngOnInit(): void {
    this.quotesService.init();

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.selectCurrency(params.get('currency') ?? '');
    });

    this.quotesService.preferences$.pipe(takeUntil(this.destroy$)).subscribe(preferences => {
      if (preferences) {
        this.currencies = preferences.quotations.map(q => q.name);
      }
    });

    this.quotesService.quotes$.pipe(takeUntil(this.destroy$)).subscribe(quotes => {
      this.quote = quotes[this.currency] ?? null;
    });

    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.on('history-select-currency', (_event, name: string) => {
        this.zone.run(() => this.selectCurrency(name));
      });
    }

    this.quotesService.loadPreferences();
    this.quotesService.refresh();
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => this.createChart());
    this.colorSchemeQuery.addEventListener('change', this.onColorSchemeChange);
    this.renderSeries();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.colorSchemeQuery.removeEventListener('change', this.onColorSchemeChange);
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.removeAllListeners('history-select-currency');
    }
    this.chart?.remove();
  }

  selectCurrency(name: string): void {
    if (!name || name === this.currency) {
      return;
    }
    this.currency = name;
    this.quote = this.quotesService.quotes$.value[name] ?? null;
    this.loadHistory();
  }

  selectRange(range: HistoryRange): void {
    if (range !== this.range) {
      this.range = range;
      this.loadHistory();
    }
  }

  retry(): void {
    this.loadHistory();
  }

  formatPrice(value: number): string {
    return priceFormatter.format(value);
  }

  private async loadHistory(): Promise<void> {
    const id = ++this.requestId;
    this.loading = true;
    this.tooltip = null;
    const points = await this.quotesService.getHistory(this.currency, this.range);
    if (id !== this.requestId) {
      return;
    }
    this.zone.run(() => {
      this.points = points;
      this.stats = this.computeStats(points);
      this.loading = false;
      this.renderSeries();
    });
  }

  private computeStats(points: HistoryPoint[]): HistoryStats | null {
    if (points.length === 0) {
      return null;
    }
    const values = points.map(p => p.value);
    const first = values[0];
    const last = values[values.length - 1];
    const change = last - first;
    return {
      first,
      last,
      change,
      changePct: first ? (change / first) * 100 : 0,
      high: Math.max(...values),
      low: Math.min(...values),
      average: values.reduce((sum, v) => sum + v, 0) / values.length
    };
  }

  private cssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  private createChart(): void {
    this.chart = createChart(this.chartContainer.nativeElement, {
      autoSize: true,
      handleScroll: false,
      handleScale: false,
      crosshair: {
        mode: CrosshairMode.Magnet,
        vertLine: { labelVisible: false, style: LineStyle.Dashed, width: 1 },
        horzLine: { labelVisible: false, style: LineStyle.Dashed, width: 1 }
      },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.15, bottom: 0.08 } },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
      localization: {
        locale: 'es-AR',
        priceFormatter: (price: number) => priceFormatter.format(price)
      }
    });
    this.series = this.chart.addAreaSeries({
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderWidth: 2
    });
    this.chart.subscribeCrosshairMove(param => this.onCrosshairMove(param));
    this.applyTheme();
  }

  private applyTheme(): void {
    if (!this.chart || !this.series) {
      return;
    }
    const lineColor = this.cssVar(this.trend === 'down' ? '--down' : this.trend === 'up' ? '--up' : '--accent');
    this.chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: this.cssVar('--text-subtle'),
        fontFamily: this.cssVar('--font-sans'),
        fontSize: 11
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: this.cssVar('--border') }
      },
      crosshair: {
        vertLine: { color: this.cssVar('--border-strong') },
        horzLine: { color: this.cssVar('--border-strong') }
      }
    });
    this.series.applyOptions({
      lineColor,
      topColor: this.withAlpha(lineColor, 0.28),
      bottomColor: this.withAlpha(lineColor, 0),
      crosshairMarkerBorderColor: this.cssVar('--bg'),
      crosshairMarkerBackgroundColor: lineColor
    });
  }

  private withAlpha(hex: string, alpha: number): string {
    const match = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!match) {
      return hex;
    }
    const [r, g, b] = [0, 2, 4].map(i => parseInt(match[1].slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private renderSeries(): void {
    if (!this.chart || !this.series) {
      return;
    }
    this.series.setData(this.points.map(p => ({ time: p.date as Time, value: p.value })));
    this.applyTheme();
    this.chart.timeScale().fitContent();
  }

  private onCrosshairMove(param: MouseEventParams): void {
    const data = this.series ? param.seriesData.get(this.series) as { value?: number } | undefined : undefined;
    const next = param.point && param.time && data?.value !== undefined
      ? {
        x: param.point.x,
        y: param.point.y,
        flip: param.point.x > this.chartContainer.nativeElement.clientWidth - 160,
        date: dateFormatter.format(timeToDate(param.time)),
        value: data.value
      }
      : null;
    this.zone.run(() => this.tooltip = next);
  }
}
