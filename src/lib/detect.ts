import type { CapturePlane, DetectedStar, Point, StarColor } from './types';

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

interface Component {
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  sumX: number;
  sumY: number;
  corners: [Point, Point, Point, Point];
}

function components(mask: Uint8Array, width: number, height: number): Component[] {
  const visited = new Uint8Array(mask.length);
  const found: Component[] = [];
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
    let topLeft = { x: width, y: height };
    let topRight = { x: 0, y: height };
    let bottomRight = { x: 0, y: 0 };
    let bottomLeft = { x: width, y: 0 };
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
      if (x + y < topLeft.x + topLeft.y) topLeft = { x, y };
      if (x - y > topRight.x - topRight.y) topRight = { x, y };
      if (x + y > bottomRight.x + bottomRight.y) bottomRight = { x, y };
      if (x - y < bottomLeft.x - bottomLeft.y) bottomLeft = { x, y };
      const neighbors = [index - 1, index + 1, index - width, index + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) continue;
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
    found.push({ area, minX, maxX, minY, maxY, sumX, sumY, corners: [topLeft, topRight, bottomRight, bottomLeft] });
  }
  return found;
}

function detectCapturePlane(pixels: Uint8ClampedArray, width: number, height: number): CapturePlane | undefined {
  const dark = new Uint8Array(width * height);
  for (let index = 0; index < dark.length; index += 1) {
    const r = pixels[index * 4];
    const g = pixels[index * 4 + 1];
    const b = pixels[index * 4 + 2];
    if (0.2126 * r + 0.7152 * g + 0.0722 * b < 45 && Math.max(r, g, b) < 72) dark[index] = 1;
  }
  const candidates = components(closeMask(dark, width, height), width, height)
    .filter((component) =>
      component.area > width * height * 0.08 &&
      component.maxX - component.minX > width * 0.24 &&
      component.maxY - component.minY > height * 0.18
    )
    .sort((left, right) => right.area - left.area);
  const surface = candidates[0];
  if (!surface) return undefined;
  const corners = surface.corners.map(({ x, y }) => ({ x: x / width, y: y / height })) as CapturePlane['corners'];
  const area = corners.reduce((sum, point, index) => {
    const next = corners[(index + 1) % corners.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0) / 2;
  return Math.abs(area) >= 0.06 ? { corners } : undefined;
}

export interface DetectionResult {
  stars: DetectedStar[];
  capturePlane?: CapturePlane;
}

export function detectConstellation(source: HTMLCanvasElement): DetectionResult {
  const analysisWidth = 420;
  const analysisHeight = Math.round((source.height / source.width) * analysisWidth);
  const canvas = document.createElement('canvas');
  canvas.width = analysisWidth;
  canvas.height = analysisHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { stars: [] };
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
  return {
    stars: stars.sort((left, right) => left.y - right.y || left.x - right.x),
    capturePlane: detectCapturePlane(pixels, analysisWidth, analysisHeight)
  };
}

export function detectStars(source: HTMLCanvasElement): DetectedStar[] {
  return detectConstellation(source).stars;
}
