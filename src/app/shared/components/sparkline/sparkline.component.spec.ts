import { SparklineComponent } from './sparkline.component';

describe('SparklineComponent', () => {
  it('should build paths and an upward trend', () => {
    const component = new SparklineComponent();
    component.points = [10, 12, 11, 15];
    component.ngOnChanges();
    expect(component.linePath.startsWith('M')).toBeTrue();
    expect(component.areaPath.endsWith('Z')).toBeTrue();
    expect(component.trend).toBe('up');
  });

  it('should render nothing with fewer than two points', () => {
    const component = new SparklineComponent();
    component.points = [10];
    component.ngOnChanges();
    expect(component.linePath).toBe('');
    expect(component.lastPoint).toBeNull();
  });
});
