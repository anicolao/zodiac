import type { DetectedStar, StarColor } from './types';

interface RGB {
  r: number;
  g: number;
  b: number;
}
function hsv({ r, g, b }: RGB) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return { h: hue, s: max ? delta / max : 0, v: max };
}

export function classifyTokenPixel(rgb: RGB): StarColor | undefined {
  const color = hsv(rgb);
  if ((color.h <= 16 || color.h >= 346) && color.s >= 0.38 && color.v >= 0.28) return 'red';
  if (color.h >= 38 && color.h <= 67 && color.s >= 0.48 && color.v >= 0.48) return 'gold';
  return undefined;
}

function closeMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  const dilated = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      for (let offsetY = -1; offsetY <= 1 && !dilated[index]; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (mask[index + offsetY * width + offsetX]) {
            dilated[index] = 1;
            break;
          }
        }
      }
    }
  }
  const closed = new Uint8Array(mask.length);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      let solid = true;
      for (let offsetY = -1; offsetY <= 1 && solid; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!dilated[index + offsetY * width + offsetX]) {
            solid = false;
            break;
          }
        }
      }
      if (solid) closed[index] = 1;
    }
  }
  return closed;
}

function components(mask: Uint8Array, width: number, height: number) {
  const visited = new Uint8Array(mask.length);
  const found: Array<{ area: number; minX: number; maxX: number; minY: number; maxY: number; sumX: number; sumY: number }> = [];
  const queue: number[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    visited[start] = 1;
    queue.length = 0;
    queue.push(start);
    let area = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      area += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) continue;
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
    found.push({ area, minX, maxX, minY, maxY, sumX, sumY });
  }
  return found;
}

export function detectStars(source: HTMLCanvasElement): DetectedStar[] {
  const analysisWidth = 420;
  const analysisHeight = Math.round((source.height / source.width) * analysisWidth);
  const canvas = document.createElement('canvas');
  canvas.width = analysisWidth;
  canvas.height = analysisHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return [];
  context.drawImage(source, 0, 0, source.width, source.height, 0, 0, analysisWidth, analysisHeight);
  const pixels = context.getImageData(0, 0, analysisWidth, analysisHeight).data;
  const masks: Record<StarColor, Uint8Array> = {
    gold: new Uint8Array(analysisWidth * analysisHeight),
    red: new Uint8Array(analysisWidth * analysisHeight)
  };
  for (let index = 0; index < masks.gold.length; index += 1) {
    const color = classifyTokenPixel({
      r: pixels[index * 4],
      g: pixels[index * 4 + 1],
      b: pixels[index * 4 + 2]
    });
    if (color) masks[color][index] = 1;
  }

  const stars: DetectedStar[] = [];
  for (const color of ['gold', 'red'] as const) {
    const mask = closeMask(masks[color], analysisWidth, analysisHeight);
    for (const component of components(mask, analysisWidth, analysisHeight)) {
      const boxWidth = component.maxX - component.minX + 1;
      const boxHeight = component.maxY - component.minY + 1;
      const boxArea = boxWidth * boxHeight;
      const fill = component.area / boxArea;
      const aspect = boxWidth / boxHeight;
      if (
        component.area < 42 ||
        component.area > 5600 ||
        boxWidth < 9 ||
        boxHeight < 9 ||
        boxWidth > analysisWidth * 0.3 ||
        boxHeight > analysisHeight * 0.38 ||
        fill < 0.24 ||
        fill > 0.82 ||
        aspect < 0.55 ||
        aspect > 1.55
      ) continue;
      stars.push({
        id: crypto.randomUUID(),
        color,
        x: component.sumX / component.area / analysisWidth,
        y: component.sumY / component.area / analysisHeight,
        size: Math.max(boxWidth, boxHeight) / analysisWidth,
        confidence: Math.min(0.99, 0.68 + Math.min(component.area / 1400, 0.25))
      });
    }
  }
  return stars.sort((left, right) => left.y - right.y || left.x - right.x);
}
