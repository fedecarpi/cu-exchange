import { Component } from '@angular/core';
import { ElectronService } from './core/services';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(
    private electronService: ElectronService,
    private translate: TranslateService
  ) {
    this.translate.addLangs(['en', 'es']);
    this.translate.setDefaultLang('en');
    const browserLang = this.translate.getBrowserLang();
    this.translate.use(browserLang === 'es' ? 'es' : 'en');

    if (electronService.isElectron && window.process.platform === 'darwin') {
      document.documentElement.classList.add('platform-mac');
    }

    // Electron may focus elements programmatically when a window opens; only show focus rings after keyboard use.
    const root = document.documentElement;
    window.addEventListener('keydown', event => {
      if (event.key === 'Tab') {
        root.classList.add('keyboard-nav');
      }
    }, true);
    window.addEventListener('mousedown', () => root.classList.remove('keyboard-nav'), true);
  }
}
