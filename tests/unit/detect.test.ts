import { describe, expect, it } from 'vitest';
import { classifyTokenPixel } from '../../src/lib/detect';

describe('token color classification', () => {
  it('separates the game tokens from neutral and wooden colors', () => {
    expect(classifyTokenPixel({ r: 180, g: 42, b: 28 })).toBe('red');
    expect(classifyTokenPixel({ r: 241, g: 182, b: 24 })).toBe('gold');
    expect(classifyTokenPixel({ r: 155, g: 103, b: 58 })).toBeUndefined();
    expect(classifyTokenPixel({ r: 235, g: 231, b: 218 })).toBeUndefined();
  });
});
