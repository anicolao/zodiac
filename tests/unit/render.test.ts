import { describe, expect, it } from 'vitest';
import { mapStarToSector } from '../../src/lib/render';

describe('Zodiac sector mapping', () => {
  it('preserves relative token size in the final art', () => {
    const small = mapStarToSector({ x: 0.5, y: 0.5, size: 0.06, color: 'gold' }, 0, 1024, 900);
    const large = mapStarToSector({ x: 0.5, y: 0.5, size: 0.14, color: 'red' }, 0, 1024, 900);
    expect(large.radius).toBeGreaterThan(small.radius * 2);
    expect(large.x).toBe(small.x);
    expect(large.y).toBe(small.y);
  });
});
