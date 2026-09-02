import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

interface Point { x: number; y: number }
interface FixtureRecord {
  schemaVersion: number;
  id: string;
  reviewStatus: 'draft' | 'approved';
  image: { file: string; width: number; height: number; source: string };
  expected: {
    cardLabel: string;
    textRegion: { corners: Point[] };
    north: { origin: Point; target: Point };
    stars: Array<{ id: string; color: 'gold' | 'red'; center: Point; radius: number }>;
  };
}

const fixtureRoot = path.resolve('tests/fixtures/real');
const inBounds = ({ x, y }: Point) => x >= 0 && x <= 1 && y >= 0 && y <= 1;

describe('real-photo expected outputs', () => {
  it('contains one complete normalized annotation per derived image', async () => {
    const annotationFiles = (await readdir(path.join(fixtureRoot, 'annotations'))).filter((file) => file.endsWith('.json')).sort();
    const imageFiles = (await readdir(path.join(fixtureRoot, 'images'))).filter((file) => file.endsWith('.jpg')).sort();
    expect(annotationFiles).toHaveLength(14);
    expect(imageFiles).toHaveLength(14);

    for (const annotationFile of annotationFiles) {
      const record = JSON.parse(await readFile(path.join(fixtureRoot, 'annotations', annotationFile), 'utf8')) as FixtureRecord;
      expect(annotationFile).toBe(`${record.id}.json`);
      expect(imageFiles).toContain(record.image.file);
      expect(record.schemaVersion).toBe(1);
      expect(record.image).toMatchObject({ width: 1200, height: 1600 });
      expect(record.expected.cardLabel).toMatch(/^[A-Z]+(?: [A-Z]+)*$/);
      expect(record.expected.textRegion.corners).toHaveLength(4);
      expect(record.expected.textRegion.corners.every(inBounds)).toBe(true);
      expect(inBounds(record.expected.north.origin)).toBe(true);
      expect(inBounds(record.expected.north.target)).toBe(true);
      expect(record.expected.north.target).not.toEqual(record.expected.north.origin);
      expect(record.expected.stars.length).toBeGreaterThan(0);
      expect(new Set(record.expected.stars.map((star) => star.id)).size).toBe(record.expected.stars.length);
      for (const star of record.expected.stars) {
        expect(['gold', 'red']).toContain(star.color);
        expect(inBounds(star.center)).toBe(true);
        expect(star.radius).toBeGreaterThan(0);
        expect(star.radius).toBeLessThan(0.15);
      }
    }
  });

  it('keeps camera and location metadata out of the derived JPEGs', async () => {
    const imageFiles = (await readdir(path.join(fixtureRoot, 'images'))).filter((file) => file.endsWith('.jpg'));
    for (const imageFile of imageFiles) {
      const image = await readFile(path.join(fixtureRoot, 'images', imageFile));
      const searchable = image.toString('latin1');
      expect(searchable).not.toContain('Exif');
      expect(searchable).not.toContain('GPS');
      expect(searchable).not.toContain('iPhone');
      expect(searchable).not.toContain('Apple');
    }
  });
});
