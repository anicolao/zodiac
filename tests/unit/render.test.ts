import { describe, expect, it } from 'vitest';
import { mapStarToSector, normalizeComparableTokenSizes, orientStarsToCardNorth } from '../../src/lib/render';

describe('Zodiac sector mapping', () => {
  it('preserves relative token size in the final art', () => {
    const small = mapStarToSector({ x: 0.5, y: 0.5, size: 0.06, color: 'gold' }, 0, 1024, 900);
    const large = mapStarToSector({ x: 0.5, y: 0.5, size: 0.14, color: 'red' }, 0, 1024, 900);
    expect(large.radius).toBeGreaterThan(small.radius * 2);
    expect(large.radius).toBeLessThan(56);
    expect(large.x).toBe(small.x);
    expect(large.y).toBe(small.y);
  });

  it('keeps tokens in the roomier outer portion of each sector', () => {
    const center = 1024;
    const chartRadius = 900;
    const inner = mapStarToSector({ x: 0.5, y: 0, size: 0.06, color: 'gold' }, 0, center, chartRadius);
    const outer = mapStarToSector({ x: 0.5, y: 1, size: 0.06, color: 'gold' }, 0, center, chartRadius);
    expect(Math.hypot(inner.x - center, inner.y - center)).toBeCloseTo(chartRadius * 0.36);
    expect(Math.hypot(outer.x - center, outer.y - center)).toBeCloseTo(chartRadius * 0.86);
    expect(inner.radius).toBeLessThan(24);
  });

  it('preserves a square constellation instead of narrowing its inner edge', () => {
    const center = 1024;
    const radius = 900;
    const points = [
      mapStarToSector({ x: 0.25, y: 0.25, size: 0.06, color: 'gold' }, 2, center, radius),
      mapStarToSector({ x: 0.75, y: 0.25, size: 0.06, color: 'gold' }, 2, center, radius),
      mapStarToSector({ x: 0.25, y: 0.75, size: 0.06, color: 'gold' }, 2, center, radius)
    ];
    expect(Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y))
      .toBeCloseTo(Math.hypot(points[2].x - points[0].x, points[2].y - points[0].y));
  });

  it('places the top of every lower constellation toward the centre', () => {
    for (const sector of [2, 3, 4]) {
      const top = mapStarToSector({ x: 0.5, y: 0, size: 0.06, color: 'gold' }, sector, 1024, 900);
      const bottom = mapStarToSector({ x: 0.5, y: 1, size: 0.06, color: 'gold' }, sector, 1024, 900);
      expect(Math.hypot(top.x - 1024, top.y - 1024)).toBeLessThan(Math.hypot(bottom.x - 1024, bottom.y - 1024));
    }
  });

  it('turns the card-defined north direction toward the top of the constellation', () => {
    const stars = orientStarsToCardNorth({
      cardRotationDegrees: 90,
      imageAspectRatio: 1,
      stars: [
        { id: 'north', color: 'gold', x: 0.7, y: 0.5, size: 0.06, confidence: 1 },
        { id: 'south', color: 'red', x: 0.3, y: 0.5, size: 0.1, confidence: 1 }
      ]
    });
    expect(stars[0].x).toBeCloseTo(0.5);
    expect(stars[0].y).toBeLessThan(0.5);
    expect(stars[1].y).toBeGreaterThan(0.5);
  });

  it('evens out perspective noise for same-colour tokens without losing distinct sizes', () => {
    const stars = normalizeComparableTokenSizes([
      { id: 'near', color: 'gold', x: 0, y: 0, size: 0.11, confidence: 1 },
      { id: 'middle', color: 'gold', x: 0, y: 0, size: 0.1, confidence: 1 },
      { id: 'far', color: 'gold', x: 0, y: 0, size: 0.08, confidence: 1 },
      { id: 'large', color: 'gold', x: 0, y: 0, size: 0.2, confidence: 1 }
    ]);
    expect(stars.slice(0, 3).map(({ size }) => size)).toEqual([0.11, 0.11, 0.11]);
    expect(stars[3].size).toBe(0.2);
  });
});
