import { describe, expect, it } from 'vitest';
import { mapStarToSector, orientStarsToCardNorth, ZODIAC_LABEL_FONT_SIZE, ZODIAC_STAR_RADIUS } from '../../src/lib/render';
import type { CapturePlane } from '../../src/lib/types';

describe('Zodiac sector mapping', () => {
  it('renders card labels large enough to read in a phone-sized preview', () => {
    expect(ZODIAC_LABEL_FONT_SIZE).toBeGreaterThanOrEqual(56);
  });
  it('uses one readable size for every token of each colour', () => {
    const smallGold = mapStarToSector({ x: 0.5, y: 0.5, size: 0.03, color: 'gold' }, 0, 1024, 900);
    const largeGold = mapStarToSector({ x: 0.5, y: 0.5, size: 0.2, color: 'gold' }, 0, 1024, 900);
    const smallRed = mapStarToSector({ x: 0.5, y: 0.5, size: 0.03, color: 'red' }, 0, 1024, 900);
    const largeRed = mapStarToSector({ x: 0.5, y: 0.5, size: 0.2, color: 'red' }, 0, 1024, 900);
    expect(smallGold.radius).toBe(largeGold.radius);
    expect(smallGold.radius).toBe(ZODIAC_STAR_RADIUS.gold);
    expect(smallRed.radius).toBe(largeRed.radius);
    expect(smallRed.radius).toBe(ZODIAC_STAR_RADIUS.red);
    expect(smallRed.radius).toBeGreaterThan(smallGold.radius);
  });

  it('keeps tokens in the roomier outer portion of each sector', () => {
    const center = 1024;
    const chartRadius = 900;
    const inner = mapStarToSector({ x: 0.5, y: 0, size: 0.06, color: 'gold' }, 0, center, chartRadius);
    const outer = mapStarToSector({ x: 0.5, y: 1, size: 0.06, color: 'gold' }, 0, center, chartRadius);
    expect(Math.hypot(inner.x - center, inner.y - center)).toBeCloseTo(chartRadius * 0.36);
    expect(Math.hypot(outer.x - center, outer.y - center)).toBeCloseTo(chartRadius * 0.86);
    expect(inner.radius).toBe(ZODIAC_STAR_RADIUS.gold);
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

  it('uses the card-above-constellation rule for quarter-turn and upside-down photos', () => {
    const plane: CapturePlane = { corners: [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }
    ] };
    const sideways = orientStarsToCardNorth({
      cardCenter: { x: 1.2, y: 0.5 },
      capturePlane: plane,
      stars: [
        { id: 'north', color: 'gold', x: 0.8, y: 0.5, size: 0.06, confidence: 1 },
        { id: 'south', color: 'gold', x: 0.2, y: 0.5, size: 0.06, confidence: 1 }
      ]
    });
    const upsideDown = orientStarsToCardNorth({
      cardCenter: { x: 0.5, y: 1.2 },
      capturePlane: plane,
      stars: [
        { id: 'north', color: 'gold', x: 0.5, y: 0.8, size: 0.06, confidence: 1 },
        { id: 'south', color: 'gold', x: 0.5, y: 0.2, size: 0.06, confidence: 1 }
      ]
    });
    expect(sideways[0].y).toBeLessThan(sideways[1].y);
    expect(upsideDown[0].y).toBeLessThan(upsideDown[1].y);
  });

  it('uniformly expands every multi-star constellation to the available span', () => {
    const stars = orientStarsToCardNorth({
      stars: [
        { id: 'left', color: 'gold', x: 0.45, y: 0.48, size: 0.06, confidence: 1 },
        { id: 'right', color: 'gold', x: 0.55, y: 0.52, size: 0.06, confidence: 1 }
      ]
    });
    const span = Math.max(
      Math.max(...stars.map(({ x }) => x)) - Math.min(...stars.map(({ x }) => x)),
      Math.max(...stars.map(({ y }) => y)) - Math.min(...stars.map(({ y }) => y))
    );
    expect(span).toBeCloseTo(0.78);
  });
});
