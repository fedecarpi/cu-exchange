import { ChangeDetectionStrategy, Component, Input, OnChanges } from '@angular/core';

let nextId = 0;

@Component({
  selector: 'app-sparkline',
  templateUrl: './sparkline.component.html',
  styleUrls: ['./sparkline.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SparklineComponent implements OnChanges {
  @Input() points: number[] = [];
  @Input() width = 72;
  @Input() height = 28;

  readonly gradientId = `spark-gradient-${nextId++}`;
  linePath = '';
  areaPath = '';
  trend: 'up' | 'down' | 'equal' = 'equal';
  lastPoint: { x: number; y: number } | null = null;

  ngOnChanges(): void {
    const values = this.points ?? [];
    if (values.length < 2) {
      this.linePath = '';
      this.areaPath = '';
      this.lastPoint = null;
      return;
    }

    const padding = 3;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = (this.width - padding * 2) / (values.length - 1);
    const coords = values.map((v, i) => ({
      x: padding + i * stepX,
      y: max === min
        ? this.height / 2
        : padding + (1 - (v - min) / span) * (this.height - padding * 2)
    }));

    this.linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ');
    const first = coords[0];
    const last = coords[coords.length - 1];
    this.areaPath = `${this.linePath} L${last.x.toFixed(2)},${this.height} L${first.x.toFixed(2)},${this.height} Z`;
    this.lastPoint = last;

    const delta = values[values.length - 1] - values[0];
    this.trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'equal';
  }
}
