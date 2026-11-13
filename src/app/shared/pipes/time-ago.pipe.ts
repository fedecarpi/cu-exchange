import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Pipe({
  name: 'timeAgo'
})
export class TimeAgoPipe implements PipeTransform {
  constructor(private translate: TranslateService) {}

  // `now` is passed explicitly so the pipe can stay pure and re-evaluate on a ticker.
  transform(value: Date | null | undefined, now: number = Date.now()): string {
    if (!value) {
      return '';
    }
    const lang = this.translate.currentLang || this.translate.defaultLang || 'en';
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
    const seconds = Math.round((value.getTime() - now) / 1000);
    if (Math.abs(seconds) < 45) {
      return rtf.format(0, 'second');
    }
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) {
      return rtf.format(minutes, 'minute');
    }
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
      return rtf.format(hours, 'hour');
    }
    return rtf.format(Math.round(hours / 24), 'day');
  }
}
