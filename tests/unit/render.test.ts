import { describe, expect, it } from 'vitest';
import { mapStarToSector, orientStarsToCardNorth } from '../../src/lib/render';

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
    expect(Math.hypot(inner.x - center, inner.y - center)).toBeCloseTo(chartRadius * 0.38);
    expect(Math.hypot(outer.x - center, outer.y - center)).toBeCloseTo(chartRadius * 0.8);
    expect(inner.radius).toBeLessThan(24);
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
});
