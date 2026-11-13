import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ElectronService, QuotesService } from '../core/services';

export const MAX_SHOWN_CURRENCIES = 3;

@Component({
  selector: 'app-prefences',
  templateUrl: './preferences.component.html',
  styleUrls: ['./preferences.component.scss'],
  animations: [
    trigger('shake', [
      transition('* => *', [
        animate('360ms ease-in-out', keyframes([
          style({ transform: 'translateX(0)', offset: 0 }),
          style({ transform: 'translateX(-5px)', offset: 0.2 }),
          style({ transform: 'translateX(5px)', offset: 0.4 }),
          style({ transform: 'translateX(-3px)', offset: 0.6 }),
          style({ transform: 'translateX(3px)', offset: 0.8 }),
          style({ transform: 'translateX(0)', offset: 1 })
        ]))
      ])
    ]),
    trigger('fade', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-4px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'none' }))
      ]),
      transition(':leave', [animate('150ms ease-in', style({ opacity: 0 }))])
    ])
  ]
})
export class PreferencesComponent implements OnInit, OnDestroy {
  readonly max = MAX_SHOWN_CURRENCIES;
  readonly isMac = !!window.process && window.process.platform === 'darwin';

  loading = true;
  saved = false;
  currencies: string[] = [];
  defaultCurrency: string | null = null;
  showCurrencies: string[] = [];
  shakeCount = 0;
  maxReachedVisible = false;

  private destroy$ = new Subject<void>();
  private maxReachedTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private electronService: ElectronService,
    private quotesService: QuotesService
  ) {}

  ngOnInit(): void {
    this.quotesService.init();
    this.quotesService.preferences$.pipe(takeUntil(this.destroy$)).subscribe(preferences => {
      if (preferences) {
        this.defaultCurrency = preferences.defaultCurrency;
        this.currencies = preferences.quotations.map(q => q.name);
        this.showCurrencies = [...preferences.showCurrencies];
        this.loading = false;
      }
    });
    this.quotesService.loadPreferences();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    clearTimeout(this.maxReachedTimer);
  }

  isSelectedCurrency(cur: string): boolean {
    return this.showCurrencies.includes(cur);
  }

  toggleCurrency(cur: string): void {
    if (this.isSelectedCurrency(cur)) {
      this.showCurrencies = this.showCurrencies.filter(c => c !== cur);
      return;
    }
    if (this.showCurrencies.length >= this.max) {
      this.shakeCount++;
      this.maxReachedVisible = true;
      clearTimeout(this.maxReachedTimer);
      this.maxReachedTimer = setTimeout(() => this.maxReachedVisible = false, 2200);
      return;
    }
    this.showCurrencies = [...this.showCurrencies, cur];
  }

  cancel(): void {
    this.electronService.ipcRenderer.send('close-preference-win', null);
  }

  save(): void {
    if (this.saved) {
      return;
    }
    this.saved = true;
    setTimeout(() => {
      this.electronService.ipcRenderer.send('save-preferences', {
        defaultCurrency: this.defaultCurrency,
        showCurrencies: this.showCurrencies
      });
    }, 650);
  }
}
