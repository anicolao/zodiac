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
    textRegion: { center: Point; width: number; height: number; rotationDegrees: number };
    stars: Array<{ id: string; color: 'gold' | 'red'; center: Point; radius: number }>;
  };
}

const fixtureRoot = path.resolve('tests/fixtures/real');
const inBounds = ({ x, y }: Point) => x >= 0 && x <= 1 && y >= 0 && y <= 1;

function rectangleCorners(record: FixtureRecord): Point[] {
  const region = record.expected.textRegion;
  const rotation = region.rotationDegrees * Math.PI / 180;
  const right = { x: Math.cos(rotation), y: Math.sin(rotation) };
  const down = { x: -Math.sin(rotation), y: Math.cos(rotation) };
  const halfWidth = region.width * record.image.width / 2;
  const halfHeight = region.height * record.image.width / 2;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([horizontal, vertical]) => ({
    x: region.center.x + (right.x * halfWidth * horizontal + down.x * halfHeight * vertical) / record.image.width,
    y: region.center.y + (right.y * halfWidth * horizontal + down.y * halfHeight * vertical) / record.image.height
  }));
}

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
      expect(record.schemaVersion).toBe(2);
      expect(record.image).toMatchObject({ width: 1200, height: 1600 });
      expect(record.expected.cardLabel).toMatch(/^[A-Z]+(?: [A-Z]+)*$/);
      const textRegion = record.expected.textRegion;
      expect(inBounds(textRegion.center)).toBe(true);
      expect(textRegion.width).toBeGreaterThan(0);
      expect(textRegion.height).toBeGreaterThan(0);
      expect(Number.isFinite(textRegion.rotationDegrees)).toBe(true);
      expect(rectangleCorners(record).every(inBounds)).toBe(true);
      expect(record.expected).not.toHaveProperty('north');
      const rotation = textRegion.rotationDegrees * Math.PI / 180;
      const right = { x: Math.cos(rotation), y: Math.sin(rotation) };
      const north = { x: Math.sin(rotation), y: -Math.cos(rotation) };
      expect(right.x * north.x + right.y * north.y).toBeCloseTo(0, 12);
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
