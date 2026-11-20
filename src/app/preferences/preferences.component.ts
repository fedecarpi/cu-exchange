import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  CATEGORIES, CatalogItem, Category, ElectronService, MAX_SHOWN_PER_CATEGORY, QuotationConfig, QuotesService, ThemeMode,
  categoryOf, currencySymbol, formatPrice
} from '../core/services';

const MAX_SEARCH_RESULTS = 50;

interface CategoryGroup {
  id: Category;
  label: string;
  icon: string;
  names: string[];
  shown: number;
}

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
  readonly max = MAX_SHOWN_PER_CATEGORY;
  readonly isMac = !!window.process && window.process.platform === 'darwin';
  readonly themeOptions: { id: ThemeMode; icon: string; label: string }[] = [
    { id: 'system', icon: 'bi-circle-half', label: 'PREFERENCES.THEME_SYSTEM' },
    { id: 'light', icon: 'bi-sun', label: 'PREFERENCES.THEME_LIGHT' },
    { id: 'dark', icon: 'bi-moon', label: 'PREFERENCES.THEME_DARK' }
  ];
  readonly marketCategories = CATEGORIES.filter(c => c.id !== 'dolar');

  loading = true;
  saved = false;
  quotations: QuotationConfig[] = [];
  groups: CategoryGroup[] = [];
  defaultCurrency: string | null = null;
  showCurrencies: string[] = [];
  theme: ThemeMode = 'system';
  shakeCategory: Category | null = null;
  shakeCount = 0;
  maxReachedVisible = false;

  searchCategory: Category = 'acciones';
  query = '';
  catalog: Partial<Record<Category, CatalogItem[]>> = {};

  private destroy$ = new Subject<void>();
  private maxReachedTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private electronService: ElectronService,
    private quotesService: QuotesService,
    private zone: NgZone
  ) {}

  get catalogLoading(): boolean {
    return this.catalog[this.searchCategory] === undefined;
  }

  get results(): CatalogItem[] {
    const items = this.catalog[this.searchCategory] ?? [];
    const query = this.query.trim().toUpperCase();
    const added = new Set(this.quotations.map(q => q.name));
    return items
      .filter(item => !added.has(item.name) && (!query || item.name.includes(query) || item.symbol.includes(query)))
      .slice(0, MAX_SEARCH_RESULTS);
  }

  ngOnInit(): void {
    this.quotesService.init();
    this.quotesService.preferences$.pipe(takeUntil(this.destroy$)).subscribe(preferences => {
      if (preferences) {
        this.defaultCurrency = preferences.defaultCurrency;
        this.quotations = preferences.quotations.map(q => ({ ...q, category: categoryOf(q) }));
        this.showCurrencies = [...preferences.showCurrencies];
        this.theme = preferences.theme ?? 'system';
        this.updateGroups();
        this.loading = false;
      }
    });
    this.quotesService.loadPreferences();
    this.loadCatalog();
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
      this.updateGroups();
      return;
    }
    const category = this.categoryOf(cur);
    if (this.shownIn(category) >= this.max) {
      this.shakeCategory = category;
      this.shakeCount++;
      this.maxReachedVisible = true;
      clearTimeout(this.maxReachedTimer);
      this.maxReachedTimer = setTimeout(() => this.maxReachedVisible = false, 2200);
      return;
    }
    this.showCurrencies = [...this.showCurrencies, cur];
    this.updateGroups();
  }

  isRemovable(name: string): boolean {
    return this.categoryOf(name) !== 'dolar';
  }

  removeInstrument(name: string): void {
    this.quotations = this.quotations.filter(q => q.name !== name);
    this.showCurrencies = this.showCurrencies.filter(c => c !== name);
    if (this.defaultCurrency === name) {
      this.defaultCurrency = this.quotations[0]?.name ?? null;
    }
    this.updateGroups();
  }

  addInstrument(item: CatalogItem): void {
    const category = this.searchCategory;
    if (this.quotations.some(q => q.name === item.name)) {
      return;
    }
    const source = CATEGORIES.find(c => c.id === category)?.source ?? 'data912';
    this.quotations = [...this.quotations, { name: item.name, category, source, symbol: item.symbol }];
    if (this.shownIn(category) < this.max) {
      this.showCurrencies = [...this.showCurrencies, item.name];
    }
    this.updateGroups();
  }

  selectSearchCategory(category: Category): void {
    if (category !== this.searchCategory) {
      this.searchCategory = category;
      this.loadCatalog();
    }
  }

  priceLabel(item: CatalogItem): string {
    return `${currencySymbol(item.currency)} ${formatPrice(item.price)}`;
  }

  trackByName(_index: number, item: { name: string }): string {
    return item.name;
  }

  trackById(_index: number, group: CategoryGroup): Category {
    return group.id;
  }

  selectTheme(theme: ThemeMode): void {
    this.theme = theme;
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.send('preview-theme', theme);
    }
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
        quotations: this.quotations,
        defaultCurrency: this.defaultCurrency,
        showCurrencies: this.showCurrencies,
        theme: this.theme
      });
    }, 650);
  }

  private categoryOf(name: string): Category {
    return categoryOf(this.quotations.find(q => q.name === name));
  }

  private shownIn(category: Category): number {
    return this.showCurrencies.filter(name => this.categoryOf(name) === category).length;
  }

  private updateGroups(): void {
    this.groups = CATEGORIES
      .map(c => {
        const names = this.quotations.filter(q => q.category === c.id).map(q => q.name);
        return { id: c.id, label: c.label, icon: c.icon, names, shown: this.shownIn(c.id) };
      })
      .filter(group => group.names.length > 0);
  }

  private loadCatalog(): void {
    const category = this.searchCategory;
    if (this.catalog[category]) {
      return;
    }
    this.quotesService.getCatalog(category).then(items => this.zone.run(() => {
      this.catalog = { ...this.catalog, [category]: items };
    }));
  }
}
