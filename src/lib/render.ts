import type { Capture, DetectedStar, GameSession } from './types';
import { homographyToUnitSquare, projectPoint } from './geometry';

export const OUTPUT_SIZE = 2048;
export const ZODIAC_LABEL_FONT_SIZE = 56;
const GOLD = '#f3b83f';
const RED = '#d83b2d';
const NIGHT = '#031426';

export interface RenderedStar {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export function normalizeComparableTokenSizes(stars: DetectedStar[]): DetectedStar[] {
  const medians = new Map<string, number>();
  for (const color of ['gold', 'red'] as const) {
    const sizes = stars.filter((star) => star.color === color).map((star) => star.size).sort((left, right) => left - right);
    if (sizes.length) medians.set(color, sizes[Math.floor(sizes.length / 2)]);
  }
  return stars.map((star) => {
    const median = medians.get(star.color) ?? star.size;
    return Math.abs(star.size - median) / Math.max(median, 0.001) <= 0.35
      ? { ...star, size: median }
      : star;
  });
}

function rectifyStars(capture: Pick<Capture, 'stars' | 'capturePlane' | 'imageAspectRatio'>): DetectedStar[] {
  if (!capture.capturePlane) return capture.stars;
  const homography = homographyToUnitSquare(capture.capturePlane);
  if (!homography) return capture.stars;
  const aspectRatio = capture.imageAspectRatio ?? 1;
  const corrected = capture.stars.map((star) => {
    const center = projectPoint(homography, star);
    const horizontal = projectPoint(homography, { x: star.x + star.size / 2, y: star.y });
    const vertical = projectPoint(homography, { x: star.x, y: star.y + star.size * aspectRatio / 2 });
    const correctedSize = Math.hypot(horizontal.x - center.x, horizontal.y - center.y) +
      Math.hypot(vertical.x - center.x, vertical.y - center.y);
    return { ...star, ...center, size: correctedSize };
  });
  return normalizeComparableTokenSizes(corrected);
}

function rectifiedCardRotation(capture: Pick<Capture, 'cardRotationDegrees' | 'cardTextCenter' | 'capturePlane' | 'imageAspectRatio'>): number | undefined {
  if (capture.cardRotationDegrees === undefined) return undefined;
  if (!capture.capturePlane || !capture.cardTextCenter) return capture.cardRotationDegrees;
  const homography = homographyToUnitSquare(capture.capturePlane);
  if (!homography) return capture.cardRotationDegrees;
  const aspectRatio = capture.imageAspectRatio ?? 1;
  const angle = capture.cardRotationDegrees * Math.PI / 180;
  const center = projectPoint(homography, capture.cardTextCenter);
  const direction = projectPoint(homography, {
    x: capture.cardTextCenter.x + Math.cos(angle) * 0.04,
    y: capture.cardTextCenter.y + Math.sin(angle) * 0.04 * aspectRatio
  });
  return Math.atan2(direction.y - center.y, direction.x - center.x) * 180 / Math.PI;
}

export function orientStarsToCardNorth(capture: Pick<Capture, 'stars' | 'cardRotationDegrees' | 'cardTextCenter' | 'capturePlane' | 'imageAspectRatio'>): DetectedStar[] {
  if (capture.cardRotationDegrees === undefined || capture.stars.length < 2) {
    return capture.stars;
  }
  const stars = rectifyStars(capture);
  const centerX = stars.reduce((sum, star) => sum + star.x, 0) / stars.length;
  const centerY = stars.reduce((sum, star) => sum + star.y, 0) / stars.length;
  const aspectRatio = capture.capturePlane ? 1 : capture.imageAspectRatio ?? 1;
  const rotation = -(rectifiedCardRotation(capture) ?? 0) * Math.PI / 180;
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);
  const rotated = stars.map((star) => {
    const x = (star.x - centerX) * aspectRatio;
    const y = star.y - centerY;
    return { star, x: x * cosine - y * sine, y: x * sine + y * cosine };
  });
  const minX = Math.min(...rotated.map(({ x }) => x));
  const maxX = Math.max(...rotated.map(({ x }) => x));
  const minY = Math.min(...rotated.map(({ y }) => y));
  const maxY = Math.max(...rotated.map(({ y }) => y));
  const span = Math.max(maxX - minX, maxY - minY, 0.001);
  const midpointX = (minX + maxX) / 2;
  const midpointY = (minY + maxY) / 2;
  return rotated.map(({ star, x, y }) => ({
    ...star,
    x: 0.5 + (x - midpointX) / span * 0.72,
    y: 0.5 + (y - midpointY) / span * 0.72
  }));
}

export function mapStarToSector(
  star: Pick<DetectedStar, 'x' | 'y' | 'size' | 'color'>,
  sector: number,
  center: number,
  chartRadius: number
): RenderedStar {
  const sectorCenter = -Math.PI / 2 + sector * (Math.PI / 3);
  const radialDistance = chartRadius * (0.61 + (star.y - 0.5) * 0.5);
  const tangentDistance = chartRadius * (star.x - 0.5) * 0.5;
  const radialX = Math.cos(sectorCenter);
  const radialY = Math.sin(sectorCenter);
  return {
    x: center + radialX * radialDistance - radialY * tangentDistance,
    y: center + radialY * radialDistance + radialX * tangentDistance,
    radius: Math.max(9, Math.min(50, star.size * chartRadius * 0.34)),
    color: star.color === 'red' ? RED : GOLD
  };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function drawFivePointStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  outer: number,
  fill: string
) {
  const inner = outer * 0.45;
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + point * (Math.PI / 5);
    const radius = point % 2 ? inner : outer;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (point === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fillStyle = fill;
  context.shadowColor = fill;
  context.shadowBlur = outer * 0.18;
  context.fill();
  context.shadowBlur = 0;
}

function drawArcLabel(
  context: CanvasRenderingContext2D,
  text: string,
  center: number,
  radius: number,
  sector: number
) {
  const normalized = text.toUpperCase();
  const sectorCenter = -Math.PI / 2 + sector * (Math.PI / 3);
  const bottom = Math.sin(sectorCenter) > 0.2;
  const letters = [...normalized];
  const spacing = Math.min(0.045, 0.58 / Math.max(normalized.length, 1));
  const firstAngle = bottom
    ? sectorCenter + ((letters.length - 1) * spacing) / 2
    : sectorCenter - ((letters.length - 1) * spacing) / 2;
  context.fillStyle = GOLD;
  context.font = `600 ${ZODIAC_LABEL_FONT_SIZE}px Georgia, serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (let index = 0; index < letters.length; index += 1) {
    const angle = bottom ? firstAngle - index * spacing : firstAngle + index * spacing;
    context.save();
    context.translate(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
    context.rotate(angle + (bottom ? -Math.PI / 2 : Math.PI / 2));
    context.fillText(letters[index], 0, 0);
    context.restore();
  }
}

function drawOrnament(context: CanvasRenderingContext2D, x: number, y: number, rotation: number) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.strokeStyle = GOLD;
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(-24, 0);
  context.quadraticCurveTo(-8, -5, 0, -28);
  context.quadraticCurveTo(8, -5, 24, 0);
  context.quadraticCurveTo(8, 5, 0, 28);
  context.quadraticCurveTo(-8, 5, -24, 0);
  context.stroke();
  context.restore();
}

function sessionSeed(captures: Capture[]): number {
  return captures.reduce(
    (seed, capture) =>
      [...capture.cardLabel].reduce((value, character) => value * 31 + character.charCodeAt(0), seed),
    2166136261
  );
}

export async function renderZodiac(session: GameSession): Promise<Blob> {
  if (session.captures.length !== 6) throw new Error('Six captures are required.');
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable on this device.');
  const center = OUTPUT_SIZE / 2;
  const radius = OUTPUT_SIZE * 0.455;

  const sky = context.createRadialGradient(center, center, 0, center, center, OUTPUT_SIZE * 0.72);
  sky.addColorStop(0, '#08213b');
  sky.addColorStop(0.65, NIGHT);
  sky.addColorStop(1, '#010811');
  context.fillStyle = sky;
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const random = seededRandom(sessionSeed(session.captures));
  for (let index = 0; index < 720; index += 1) {
    const x = random() * OUTPUT_SIZE;
    const y = random() * OUTPUT_SIZE;
    const size = 0.7 + random() * 2.3;
    context.globalAlpha = 0.38 + random() * 0.58;
    context.fillStyle = random() > 0.88 ? '#f7d48a' : '#f4f7ff';
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;

  context.strokeStyle = GOLD;
  context.lineWidth = 5;
  for (const inset of [0, 20, 116]) {
    context.beginPath();
    context.arc(center, center, radius - inset, 0, Math.PI * 2);
    context.stroke();
  }
  context.lineWidth = 4;
  for (let sector = 0; sector < 6; sector += 1) {
    const angle = -Math.PI / 2 - Math.PI / 6 + sector * (Math.PI / 3);
    context.beginPath();
    context.moveTo(center, center);
    context.lineTo(center + Math.cos(angle) * (radius - 116), center + Math.sin(angle) * (radius - 116));
    context.stroke();
    drawOrnament(
      context,
      center + Math.cos(angle) * (radius - 10),
      center + Math.sin(angle) * (radius - 10),
      angle
    );
  }

  session.captures.forEach((capture, sector) => {
    drawArcLabel(context, capture.cardLabel, center, radius - 63, sector);
    for (const star of orientStarsToCardNorth(capture)) {
      const mapped = mapStarToSector(star, sector, center, radius - 116);
      drawFivePointStar(context, mapped.x, mapped.y, mapped.radius, mapped.color);
    }
  });

  context.fillStyle = GOLD;
  context.beginPath();
  context.arc(center, center, 7, 0, Math.PI * 2);
  context.fill();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The Zodiac could not be exported.'))),
      'image/png'
    );
  });
}
