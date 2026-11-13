import { animate, keyframes, style, transition, trigger } from '@angular/animations';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { Quote } from '../../../core/services';

const flashTo = (color: string) => [
  animate('900ms ease-out', keyframes([
    style({ boxShadow: `inset 0 0 0 1px ${color}, 0 0 0 0 ${color}`, offset: 0 }),
    style({ boxShadow: `inset 0 0 0 1px ${color}, 0 0 14px 0 ${color}`, offset: 0.25 }),
    style({ boxShadow: 'inset 0 0 0 1px transparent, 0 0 0 0 transparent', offset: 1 })
  ]))
];

@Component({
  selector: 'app-currency-card',
  templateUrl: './currency-card.component.html',
  styleUrls: ['./currency-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('flash', [
      transition((_from, to) => typeof to === 'string' && to.startsWith('up'), flashTo('rgba(34, 197, 94, 0.45)')),
      transition((_from, to) => typeof to === 'string' && to.startsWith('down'), flashTo('rgba(244, 63, 94, 0.45)'))
    ])
  ]
})
export class CurrencyCardComponent implements OnChanges {
  @Input() quote!: Quote;
  /** `null` while loading, empty when the currency has no history available. */
  @Input() history: number[] | null = null;
  @Output() opened = new EventEmitter<string>();

  flashState = 'idle';
  private flashCount = 0;

  get trendIcon(): string {
    switch (this.quote?.trend) {
      case 'up': return 'bi-caret-up-fill';
      case 'down': return 'bi-caret-down-fill';
      default: return 'bi-dash';
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    const change = changes.quote;
    if (change && !change.firstChange && change.previousValue && change.currentValue) {
      const prev = (change.previousValue as Quote).value;
      const next = (change.currentValue as Quote).value;
      if (prev !== next) {
        this.flashState = `${next > prev ? 'up' : 'down'}-${++this.flashCount}`;
      }
    }
  }

  open(): void {
    this.opened.emit(this.quote.name);
  }
}
