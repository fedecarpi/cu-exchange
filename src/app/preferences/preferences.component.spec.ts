import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { PreferencesComponent } from './preferences.component';
import { ElectronService, QuotesService } from '../core/services';
import { SharedModule } from '../shared/shared.module';

describe('PreferencesComponent', () => {
  let component: PreferencesComponent;
  let fixture: ComponentFixture<PreferencesComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [PreferencesComponent],
      imports: [TranslateModule.forRoot(), SharedModule, NoopAnimationsModule],
      providers: [{ provide: ElectronService, useValue: { isElectron: false } }]
    }).compileComponents();

    fixture = TestBed.createComponent(PreferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    TestBed.inject(QuotesService).preferences$.next({
      quotations: [
        ...['oficial', 'ccl', 'mep', 'cripto', 'mayorista', 'nacion'].map(name => ({
          name, category: 'dolar' as const, source: 'ambito' as const, fetchURL: ''
        })),
        { name: 'GGAL', category: 'acciones', source: 'data912', symbol: 'GGAL' }
      ],
      defaultCurrency: 'ccl',
      showCurrencies: ['oficial', 'ccl']
    });
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.loading).toBeFalse();
  });

  it('should render the title in a h1 tag', () => {
    const compiled: HTMLElement = fixture.nativeElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('PREFERENCES.TITLE');
  });

  it('should change the theme selection', () => {
    expect(component.theme).toBe('system');
    component.selectTheme('dark');
    expect(component.theme).toBe('dark');
  });

  it('should toggle currencies up to the maximum per category', () => {
    ['mep', 'cripto', 'mayorista'].forEach(c => component.toggleCurrency(c));
    expect(component.showCurrencies).toEqual(['oficial', 'ccl', 'mep', 'cripto', 'mayorista']);

    component.toggleCurrency('nacion');
    expect(component.showCurrencies.length).toBe(5);
    expect(component.maxReachedVisible).toBeTrue();

    component.toggleCurrency('GGAL');
    expect(component.showCurrencies).toContain('GGAL');

    component.toggleCurrency('oficial');
    expect(component.showCurrencies).not.toContain('oficial');
  });

  it('should add and remove market instruments', () => {
    component.selectSearchCategory('cedears');
    component.addInstrument({ name: 'AAPL', symbol: 'AAPL', price: 30880, variation: 2.1, currency: 'ARS' });
    expect(component.quotations.find(q => q.name === 'AAPL')).toEqual(
      { name: 'AAPL', category: 'cedears', source: 'data912', symbol: 'AAPL' }
    );
    expect(component.showCurrencies).toContain('AAPL');
    expect(component.groups.map(g => g.id)).toEqual(['dolar', 'acciones', 'cedears']);

    component.removeInstrument('AAPL');
    expect(component.quotations.some(q => q.name === 'AAPL')).toBeFalse();
    expect(component.showCurrencies).not.toContain('AAPL');
    expect(component.isRemovable('ccl')).toBeFalse();
  });
});
