import { describe, expect, it } from 'vitest';
import { normalizeCardLabel } from '../../src/lib/ocr';

describe('card label normalization', () => {
  it('selects the large uppercase card name from noisy local OCR', () => {
    expect(normalizeCardLabel('***\nHOT  AIR\nBALLOON\n')).toBe('HOT AIR BALLOON');
    expect(normalizeCardLabel('  CASTLE  47 ')).toBe('CASTLE');
    expect(normalizeCardLabel('SAILBOAT B')).toBe('SAILBOAT');
  });
});
