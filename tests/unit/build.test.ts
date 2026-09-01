import { describe, expect, it } from 'vitest';
import { isDifferentBuild, shortBuildHash } from '../../src/lib/build';

describe('build freshness', () => {
  it('shows a stable short hash while comparing the complete revision', () => {
    expect(shortBuildHash('1234567890abcdef')).toBe('12345678');
    expect(isDifferentBuild('1234567890abcdef', '1234567890abcdef')).toBe(false);
    expect(isDifferentBuild('fedcba0987654321', '1234567890abcdef')).toBe(true);
  });

  it('does not claim that unversioned development builds are stale', () => {
    expect(shortBuildHash('development')).toBe('development');
    expect(isDifferentBuild('abcdef12', 'development')).toBe(false);
    expect(isDifferentBuild('development', 'abcdef12')).toBe(false);
  });
});
