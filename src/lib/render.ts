import type { Capture, DetectedStar, GameSession } from './types';

export const OUTPUT_SIZE = 2048;
const GOLD = '#f3b83f';
const RED = '#d83b2d';
const NIGHT = '#031426';

export interface RenderedStar {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export function mapStarToSector(
  star: Pick<DetectedStar, 'x' | 'y' | 'size' | 'color'>,
  sector: number,
  center: number,
  chartRadius: number
): RenderedStar {
  const sectorCenter = -Math.PI / 2 + sector * (Math.PI / 3);
  const angle = sectorCenter + (star.x - 0.5) * (Math.PI / 3) * 0.7;
  const radius = chartRadius * (0.38 + star.y * 0.42);
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
    radius: Math.max(10, Math.min(56, star.size * chartRadius * 0.42)),
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
  context.font = '600 42px Georgia, serif';
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
    for (const star of capture.stars) {
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
