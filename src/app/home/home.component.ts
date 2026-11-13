import { animate, query, stagger, style, transition, trigger } from '@angular/animations';
import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, combineLatest } from 'rxjs';
import { distinctUntilChanged, map, takeUntil } from 'rxjs/operators';
import { ElectronService, Quote, QuotesService, QuotesStatus } from '../core/services';

const REFRESH_INTERVAL_MS = 50000;
const HISTORY_REFRESH_MS = 60 * 60 * 1000;
const CLOCK_TICK_MS = 30000;

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  animations: [
    trigger('listStagger', [
      transition('* => *', [
        query(':enter', [
          style({ opacity: 0, transform: 'translateY(6px)' }),
          stagger(60, animate('320ms cubic-bezier(0.22, 1, 0.36, 1)', style({ opacity: 1, transform: 'none' })))
        ], { optional: true })
      ])
    ]),
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('200ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLElement>;

  quotes: Quote[] = [];
  showCurrencies: string[] = [];
  histories: Record<string, number[] | null> = {};
  status: QuotesStatus = 'idle';
  lastUpdated: Date | null = null;
  now = Date.now();

  private destroy$ = new Subject<void>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private resizeObserver?: ResizeObserver;

  constructor(
    private quotesService: QuotesService,
    private electronService: ElectronService,
    private zone: NgZone
  ) {}

  get hasQuotes(): boolean {
    return this.quotes.length > 0;
  }

  get skeletonSlots(): number[] {
    return Array.from({ length: this.showCurrencies.length || 3 }, (_, i) => i);
  }

  ngOnInit(): void {
    document.documentElement.classList.add('translucent');
    this.quotesService.init();

    combineLatest([this.quotesService.quotes$, this.quotesService.preferences$])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([quotes, preferences]) => {
        this.showCurrencies = preferences?.showCurrencies ?? this.showCurrencies;
        this.quotes = this.showCurrencies.filter(name => quotes[name]).map(name => quotes[name]);
      });

    this.quotesService.preferences$
      .pipe(
        map(preferences => (preferences?.showCurrencies ?? []).join('|')),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.loadHistories());

    this.quotesService.status$.pipe(takeUntil(this.destroy$)).subscribe(status => this.status = status);
    this.quotesService.lastUpdated$.pipe(takeUntil(this.destroy$)).subscribe(date => {
      this.lastUpdated = date;
      this.now = Date.now();
    });

    this.quotesService.loadPreferences();
    this.quotesService.refresh();

    this.timers.push(
      setInterval(() => this.quotesService.refresh(), REFRESH_INTERVAL_MS),
      setInterval(() => this.loadHistories(true), HISTORY_REFRESH_MS),
      setInterval(() => this.now = Date.now(), CLOCK_TICK_MS)
    );
  }

  ngAfterViewInit(): void {
    if (!this.electronService.isElectron || typeof ResizeObserver === 'undefined') {
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(entries => {
        const height = entries[0]?.target.getBoundingClientRect().height;
        if (height) {
          this.electronService.ipcRenderer.send('resize-popup', height);
        }
      });
      this.resizeObserver.observe(this.container.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.timers.forEach(timer => clearInterval(timer));
    this.resizeObserver?.disconnect();
  }

  refresh(): void {
    this.quotesService.refresh();
  }

  openHistory(name: string): void {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.send('open-history', name);
    }
  }

  showPreferences(): void {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.send('show-preferences', null);
    }
  }

  exit(): void {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.send('close-app', null);
    }
  }

  trackByName(_index: number, quote: Quote): string {
    return quote.name;
  }

  private loadHistories(force = false): void {
    this.showCurrencies.forEach(name => {
      if (!force && this.histories[name] !== undefined) {
        return;
      }
      if (this.histories[name] === undefined) {
        this.histories = { ...this.histories, [name]: null };
      }
      this.quotesService.getHistory(name, '1M').then(points => this.zone.run(() => {
        this.histories = { ...this.histories, [name]: points.map(p => p.value) };
      }));
    });
  }
}
