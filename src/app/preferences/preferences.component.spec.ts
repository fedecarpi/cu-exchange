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
      quotations: ['oficial', 'ccl', 'mep', 'cripto'].map(name => ({ name, fetchURL: '' })),
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

  it('should toggle currencies up to the maximum', () => {
    component.toggleCurrency('mep');
    expect(component.showCurrencies).toEqual(['oficial', 'ccl', 'mep']);

    component.toggleCurrency('cripto');
    expect(component.showCurrencies.length).toBe(3);
    expect(component.maxReachedVisible).toBeTrue();

    component.toggleCurrency('oficial');
    expect(component.showCurrencies).toEqual(['ccl', 'mep']);
  });
});
