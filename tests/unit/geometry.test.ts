import { describe, expect, it } from 'vitest';
import { homographyToUnitSquare, projectPoint } from '../../src/lib/geometry';

describe('photograph perspective correction', () => {
  it('maps a photographed trapezoid back to a square', () => {
    const homography = homographyToUnitSquare({ corners: [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
      { x: 0.7, y: 0.8 },
      { x: 0.3, y: 0.8 }
    ] });
    expect(homography).toBeDefined();
    if (!homography) return;
    const corners = [
      projectPoint(homography, { x: 0.2, y: 0.2 }),
      projectPoint(homography, { x: 0.8, y: 0.2 }),
      projectPoint(homography, { x: 0.7, y: 0.8 }),
      projectPoint(homography, { x: 0.3, y: 0.8 })
    ];
    expect(corners[0].x).toBeCloseTo(0);
    expect(corners[0].y).toBeCloseTo(0);
    expect(corners[1].x).toBeCloseTo(1);
    expect(corners[1].y).toBeCloseTo(0);
    expect(corners[2].x).toBeCloseTo(1);
    expect(corners[2].y).toBeCloseTo(1);
    expect(corners[3].x).toBeCloseTo(0);
    expect(corners[3].y).toBeCloseTo(1);
  });
});
