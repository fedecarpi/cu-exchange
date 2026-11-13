import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { HomeComponent } from './home.component';
import { ElectronService, QuotesService } from '../core/services';
import { SharedModule } from '../shared/shared.module';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let quotesService: QuotesService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [HomeComponent],
      imports: [TranslateModule.forRoot(), SharedModule, NoopAnimationsModule],
      providers: [{ provide: ElectronService, useValue: { isElectron: false } }]
    }).compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    quotesService = TestBed.inject(QuotesService);
    fixture.detectChanges();
  });

  afterEach(() => fixture.destroy());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render skeletons while there are no quotes', () => {
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelectorAll('.skeleton-card').length).toBe(3);
  });

  it('should render a card per selected currency once quotes arrive', () => {
    quotesService.preferences$.next({
      quotations: [],
      defaultCurrency: 'oficial',
      showCurrencies: ['oficial', 'ccl']
    });
    quotesService.quotes$.next({
      oficial: { name: 'oficial', value: 1000, buy: 1000, sell: 1050, variation: 0.5, trend: 'up', date: '', hasSpread: true },
      ccl: { name: 'ccl', value: 1200, buy: 1200, sell: 1200, variation: -0.4, trend: 'down', date: '', hasSpread: false }
    });
    fixture.detectChanges();

    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelectorAll('app-currency-card').length).toBe(2);
  });
});
