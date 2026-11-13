import { Directive, ElementRef, Input, NgZone, OnChanges, OnDestroy } from '@angular/core';

const formatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

@Directive({
  selector: '[appAnimatedNumber]'
})
export class AnimatedNumberDirective implements OnChanges, OnDestroy {
  @Input() appAnimatedNumber: number | null = null;
  @Input() animatedNumberDuration = 700;

  private current: number | null = null;
  private frame = 0;

  constructor(private el: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngOnChanges(): void {
    const target = this.appAnimatedNumber;
    cancelAnimationFrame(this.frame);

    if (target === null || target === undefined || !Number.isFinite(target)) {
      this.render(null);
      this.current = null;
      return;
    }

    const from = this.current;
    if (from === null || from === target || prefersReducedMotion()) {
      this.render(target);
      this.current = target;
      return;
    }

    const start = performance.now();
    this.zone.runOutsideAngular(() => {
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / this.animatedNumberDuration);
        const eased = 1 - Math.pow(1 - progress, 3);
        this.current = from + (target - from) * eased;
        this.render(this.current);
        if (progress < 1) {
          this.frame = requestAnimationFrame(step);
        } else {
          this.current = target;
        }
      };
      this.frame = requestAnimationFrame(step);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
  }

  private render(value: number | null): void {
    this.el.nativeElement.textContent = value === null ? '—' : formatter.format(value);
  }
}
