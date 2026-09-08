import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { CapturePlane, Point } from './types';

export interface RecognizedTextRegion {
  center: { x: number; y: number };
  width: number;
  height: number;
  rotationDegrees: number;
}

export interface RecognizedCard {
  label: string;
  textRegion?: RecognizedTextRegion;
  cardCenter?: Point;
  dieValue?: number;
  words?: string[];
}

interface CardLocation {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotationDegrees: number;
}

interface AxisAlignedCard {
  x: number;
  y: number;
  width: number;
  height: number;
}

let workerPromise: Promise<Worker> | undefined;

async function worker(): Promise<Worker> {
  if (!workerPromise) {
    const manifestHref = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.href;
    const assetRoot = new URL('.', manifestHref ?? location.href).href.replace(/\/$/, '');
    workerPromise = createWorker('eng', 1, {
      workerPath: `${assetRoot}/ocr/worker.min.js`,
      corePath: `${assetRoot}/ocr/core/tesseract-core-lstm.wasm.js`,
      langPath: `${assetRoot}/ocr/lang`,
      logger: () => undefined
    }).then(async (instance) => {
      await instance.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ',
        preserve_interword_spaces: '1'
      });
      return instance;
    });
  }
  return workerPromise;
}

export function normalizeCardLabel(text: string): string {
  const lines = text
    .toUpperCase()
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/[^A-Z ]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 1)
        .join(' ')
        .trim()
    )
    .filter((line) => line.replaceAll(' ', '').length >= 3 && line.length <= 28);
  const combined = lines.join(' ').replace(/\s+/g, ' ').trim();
  if (combined.length <= 28) return combined;
  return lines.sort((left, right) => right.replaceAll(' ', '').length - left.replaceAll(' ', '').length)[0] ?? '';
}

function normalizeRotation(degrees: number): number {
  return ((degrees + 90 + 180) % 180) - 90;
}

function locateAxisAlignedCard(source: HTMLCanvasElement): AxisAlignedCard | undefined {
  const context = source.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;
  const frame = context.getImageData(0, 0, source.width, source.height).data;
  const isCardPixel = (x: number, y: number) => {
    const index = (y * source.width + x) * 4;
    const red = frame[index];
    const green = frame[index + 1];
    const blue = frame[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    return luminance > 178 && Math.max(red, green, blue) - Math.min(red, green, blue) < 82;
  };
  const rows: number[] = [];
  for (let y = Math.floor(source.height * 0.46); y < source.height; y += 3) {
    let bright = 0;
    let sampled = 0;
    for (let x = 0; x < source.width; x += 4) {
      sampled += 1;
      if (isCardPixel(x, y)) bright += 1;
    }
    if (bright / sampled > 0.28) rows.push(y);
  }
  if (rows.length < 8) return undefined;
  const minY = Math.max(0, rows[0] - 6);
  const maxY = Math.min(source.height - 1, rows[rows.length - 1] + 6);
  const columns: number[] = [];
  for (let x = 0; x < source.width; x += 3) {
    let bright = 0;
    let sampled = 0;
    for (let y = minY; y <= maxY; y += 4) {
      sampled += 1;
      if (isCardPixel(x, y)) bright += 1;
    }
    if (bright / sampled > 0.42) columns.push(x);
  }
  if (columns.length < 8) return undefined;
  return {
    x: Math.max(0, columns[0] - 6),
    y: minY,
    width: Math.min(source.width - columns[0], columns[columns.length - 1] - columns[0] + 12),
    height: maxY - minY + 1
  };
}

function locateCard(source: HTMLCanvasElement): CardLocation | undefined {
  const width = 300;
  const height = Math.max(1, Math.round(source.height / source.width * width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(source, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) {
    const red = frame[index * 4];
    const green = frame[index * 4 + 1];
    const blue = frame[index * 4 + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const range = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (luminance > 145 && blue >= red - 35 && green >= red - 40 && range < 125) mask[index] = 1;
  }

  const visited = new Uint8Array(mask.length);
  const queue: number[] = [];
  const candidates: Array<CardLocation & { score: number }> = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    visited[start] = 1;
    queue.length = 0;
    queue.push(start);
    const points: Array<{ x: number; y: number }> = [];
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumYY = 0;
    let sumXY = 0;
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      points.push({ x, y });
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumYY += y * y;
      sumXY += x * y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const neighbor of [index - 1, index + 1, index - width, index + width]) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) continue;
        if (Math.abs(neighbor % width - x) > 1) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }

    const area = points.length;
    if (area < width * height * 0.005 || area > width * height * 0.14) continue;
    const borderTouches = Number(minX <= 3) + Number(minY <= 3) + Number(maxX >= width - 4) + Number(maxY >= height - 4);
    if (borderTouches > 1) continue;
    const meanX = sumX / area;
    const meanY = sumY / area;
    const covarianceXX = sumXX / area - meanX * meanX;
    const covarianceYY = sumYY / area - meanY * meanY;
    const covarianceXY = sumXY / area - meanX * meanY;
    let rotation = Math.atan2(2 * covarianceXY, covarianceXX - covarianceYY) / 2;
    let right = { x: Math.cos(rotation), y: Math.sin(rotation) };
    let down = { x: -Math.sin(rotation), y: Math.cos(rotation) };
    const projected = () => {
      let minRight = Infinity;
      let maxRight = -Infinity;
      let minDown = Infinity;
      let maxDown = -Infinity;
      for (const point of points) {
        const horizontal = point.x * right.x + point.y * right.y;
        const vertical = point.x * down.x + point.y * down.y;
        minRight = Math.min(minRight, horizontal);
        maxRight = Math.max(maxRight, horizontal);
        minDown = Math.min(minDown, vertical);
        maxDown = Math.max(maxDown, vertical);
      }
      return { minRight, maxRight, minDown, maxDown };
    };
    let bounds = projected();
    if (bounds.maxRight - bounds.minRight < bounds.maxDown - bounds.minDown) {
      rotation += Math.PI / 2;
      right = { x: Math.cos(rotation), y: Math.sin(rotation) };
      down = { x: -Math.sin(rotation), y: Math.cos(rotation) };
      bounds = projected();
    }
    const cardWidth = bounds.maxRight - bounds.minRight + 1;
    const cardHeight = bounds.maxDown - bounds.minDown + 1;
    const aspect = cardWidth / cardHeight;
    const fill = area / (cardWidth * cardHeight);
    if (aspect < 1.15 || aspect > 2.65 || fill < 0.28) continue;
    const centerRight = (bounds.minRight + bounds.maxRight) / 2;
    const centerDown = (bounds.minDown + bounds.maxDown) / 2;
    const scale = source.width / width;
    candidates.push({
      centerX: (right.x * centerRight + down.x * centerDown) * scale,
      centerY: (right.y * centerRight + down.y * centerDown) * scale,
      width: cardWidth * scale,
      height: cardHeight * scale,
      rotationDegrees: normalizeRotation(rotation * 180 / Math.PI),
      score: area * fill * (borderTouches ? 0.72 : 1)
    });
  }
  return candidates.sort((left, right) => right.score - left.score)[0];
}

function fallbackCardCrop(source: HTMLCanvasElement, located?: AxisAlignedCard): HTMLCanvasElement {
  const crop = document.createElement('canvas');
  const card = located ?? locateAxisAlignedCard(source) ?? {
    x: source.width * 0.12,
    y: source.height * 0.58,
    width: source.width * 0.76,
    height: source.height * 0.34
  };
  const sourceX = Math.round(card.x + card.width * 0.08);
  const sourceY = Math.round(card.y + card.height * 0.2);
  const sourceWidth = Math.round(card.width * 0.84);
  const sourceHeight = Math.round(card.height * 0.62);
  crop.width = 1100;
  crop.height = Math.max(260, Math.round((sourceHeight / sourceWidth) * crop.width));
  const context = crop.getContext('2d', { willReadFrequently: true });
  if (!context) return crop;
  context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, crop.width, crop.height);
  const frame = context.getImageData(0, 0, crop.width, crop.height);
  for (let index = 0; index < frame.data.length; index += 4) {
    const luminance = 0.2126 * frame.data[index] + 0.7152 * frame.data[index + 1] + 0.0722 * frame.data[index + 2];
    const value = luminance < 145 ? 0 : 255;
    frame.data[index] = value;
    frame.data[index + 1] = value;
    frame.data[index + 2] = value;
  }
  context.putImageData(frame, 0, 0);
  return crop;
}

function alignedCardCrop(source: HTMLCanvasElement, card: CardLocation) {
  const padding = 1.08;
  const width = 1000;
  const height = Math.max(360, Math.round(width * card.height / card.width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) return undefined;
  const scale = width / (card.width * padding);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.translate(width / 2, height / 2);
  context.rotate(-card.rotationDegrees * Math.PI / 180);
  context.scale(scale, scale);
  context.drawImage(source, -card.centerX, -card.centerY);
  context.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas, scale };
}

function textCrop(aligned: HTMLCanvasElement, threshold: number) {
  const sourceX = Math.round(aligned.width * 0.07);
  const sourceY = Math.round(aligned.height * 0.2);
  const sourceWidth = Math.round(aligned.width * 0.86);
  const sourceHeight = Math.round(aligned.height * 0.6);
  const width = 1200;
  const height = Math.max(260, Math.round(sourceHeight / sourceWidth * width));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(aligned, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  const frame = context.getImageData(0, 0, width, height);
  for (let index = 0; index < frame.data.length; index += 4) {
    const luminance = 0.2126 * frame.data[index] + 0.7152 * frame.data[index + 1] + 0.0722 * frame.data[index + 2];
    const value = luminance < threshold ? 0 : 255;
    frame.data[index] = value;
    frame.data[index + 1] = value;
    frame.data[index + 2] = value;
  }
  context.putImageData(frame, 0, 0);
  return { canvas, sourceX, sourceY, sourceWidth, sourceHeight };
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (
      (currentPoint.y > point.y) !== (previousPoint.y > point.y) &&
      point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) /
        (previousPoint.y - currentPoint.y || Number.EPSILON) + currentPoint.x
    ) inside = !inside;
  }
  return inside;
}

function listCardOrientation(source: HTMLCanvasElement, card: CardLocation, plane: CapturePlane) {
  const matCenter = plane.corners.reduce((center, point) => ({
    x: center.x + point.x / plane.corners.length,
    y: center.y + point.y / plane.corners.length
  }), { x: 0, y: 0 });
  const cardCenter = { x: card.centerX, y: card.centerY };
  const towardMat = {
    x: matCenter.x * source.width - cardCenter.x,
    y: matCenter.y * source.height - cardCenter.y
  };
  let downAngle = card.rotationDegrees * Math.PI / 180;
  if (Math.cos(downAngle) * towardMat.x + Math.sin(downAngle) * towardMat.y < 0) downAngle += Math.PI;
  const distance = Math.hypot(towardMat.x, towardMat.y) || 1;
  const alignment = Math.abs((Math.cos(downAngle) * towardMat.x + Math.sin(downAngle) * towardMat.y) / distance);
  return {
    alignment,
    rotationRadians: Math.PI / 2 - downAngle,
  };
}

function alignedListCard(source: HTMLCanvasElement, card: CardLocation, rotationRadians: number) {
  const width = 900;
  const height = Math.round(width * card.width / card.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) return undefined;
  const scale = width / (card.height * 1.08);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.translate(width / 2, height / 2);
  context.rotate(rotationRadians);
  context.scale(scale, scale);
  context.drawImage(source, -card.centerX, -card.centerY);
  context.setTransform(1, 0, 0, 1, 0, 0);
  return { canvas, scale };
}

function listTextCrop(aligned: HTMLCanvasElement, threshold: number) {
  const sourceX = Math.round(aligned.width * 0.09);
  const sourceY = Math.round(aligned.height * 0.1);
  const sourceWidth = Math.round(aligned.width * 0.84);
  const sourceHeight = Math.round(aligned.height * 0.82);
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = Math.round(sourceHeight / sourceWidth * canvas.width);
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(aligned, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < frame.data.length; index += 4) {
    const red = frame.data[index];
    const green = frame.data[index + 1];
    const blue = frame.data[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const navy = luminance < threshold && blue > red * 1.04 && blue >= green * 0.82;
    const value = navy ? 0 : 255;
    frame.data[index] = value;
    frame.data[index + 1] = value;
    frame.data[index + 2] = value;
  }
  context.putImageData(frame, 0, 0);
  return canvas;
}

function wordsFromBlocks(blocks: Awaited<ReturnType<Worker['recognize']>>['data']['blocks']): Array<{ text: string; confidence: number }> {
  return blocks?.flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines)
    .map((line) => {
      const recognized = line.words
        .map((word) => ({ text: word.text.toUpperCase().replace(/[^A-Z]/g, ''), confidence: word.confidence }))
        .filter(({ text }) => /^[A-Z]{3,16}$/.test(text))
        .sort((left, right) => right.text.length - left.text.length || right.confidence - left.confidence);
      return recognized[0] ?? { text: '', confidence: 0 };
    })
    .filter(({ text }) => /^[A-Z]{3,16}$/.test(text)) ?? [];
}

async function recognizeListWords(aligned: HTMLCanvasElement): Promise<Array<{ text: string; confidence: number }>> {
  const recognizer = await worker();
  await recognizer.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
  const attempts: Array<Array<{ text: string; confidence: number }>> = [];
  for (const threshold of [170, 145, 195]) {
    const crop = listTextCrop(aligned, threshold);
    if (!crop) continue;
    const result = await recognizer.recognize(crop, {}, { text: true, blocks: true });
    const words = wordsFromBlocks(result.data.blocks);
    attempts.push(words);
    if (words.length === 6 && words.every((word) => word.confidence >= 70)) break;
  }
  return attempts.sort((left, right) => {
    const leftScore = (left.length === 6 ? 1000 : 0) + left.reduce((sum, word) => sum + word.confidence, 0);
    const rightScore = (right.length === 6 ? 1000 : 0) + right.reduce((sum, word) => sum + word.confidence, 0);
    return rightScore - leftScore;
  })[0] ?? [];
}

interface DieLocation { centerX: number; centerY: number; size: number }

function locateDie(source: HTMLCanvasElement, card: CardLocation, plane: CapturePlane): DieLocation | undefined {
  const width = 360;
  const height = Math.round(source.height / source.width * width);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(source, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const mask = new Uint8Array(width * height);
  const major = card.rotationDegrees * Math.PI / 180;
  const majorX = Math.cos(major);
  const majorY = Math.sin(major);
  const minorX = -majorY;
  const minorY = majorX;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const normalized = { x: x / width, y: y / height };
      if (pointInPolygon(normalized, plane.corners)) continue;
      const sourceX = x * source.width / width;
      const sourceY = y * source.height / height;
      const dx = sourceX - card.centerX;
      const dy = sourceY - card.centerY;
      if (Math.abs(dx * majorX + dy * majorY) < card.width * 0.58 && Math.abs(dx * minorX + dy * minorY) < card.height * 0.62) continue;
      const index = y * width + x;
      const red = pixels[index * 4];
      const green = pixels[index * 4 + 1];
      const blue = pixels[index * 4 + 2];
      if (0.2126 * red + 0.7152 * green + 0.0722 * blue < 58 && Math.max(red, green, blue) < 90) mask[index] = 1;
    }
  }
  const visited = new Uint8Array(mask.length);
  const queue: number[] = [];
  const candidates: Array<DieLocation & { score: number }> = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    visited[start] = 1;
    queue.length = 0;
    queue.push(start);
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor];
      const x = index % width;
      const y = Math.floor(index / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const neighbor of [index - 1, index + 1, index - width, index + width]) {
        if (neighbor < 0 || neighbor >= mask.length || visited[neighbor] || !mask[neighbor]) continue;
        if (Math.abs(neighbor % width - x) > 1) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
    const area = queue.length;
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const aspect = boxWidth / boxHeight;
    const fill = area / (boxWidth * boxHeight);
    if (area < 45 || area > 2600 || boxWidth < 8 || boxHeight < 8 || boxWidth > 72 || boxHeight > 72 || aspect < 0.45 || aspect > 2.2 || fill < 0.2) continue;
    const centerX = (minX + maxX) / 2 * source.width / width;
    const centerY = (minY + maxY) / 2 * source.height / height;
    const distance = Math.hypot(centerX - card.centerX, centerY - card.centerY) / Math.max(source.width, source.height);
    if (distance > 0.48) continue;
    candidates.push({
      centerX,
      centerY,
      size: Math.max(boxWidth * source.width / width, boxHeight * source.height / height),
      score: area * fill * (1 - Math.min(0.8, Math.abs(Math.log(aspect)))) / (0.2 + distance)
    });
  }
  return candidates.sort((left, right) => right.score - left.score)[0];
}

function alignedDieCrop(source: HTMLCanvasElement, die: DieLocation, rotationRadians: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 500;
  canvas.height = 500;
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) return undefined;
  const scale = canvas.width / (die.size * 1.45);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(rotationRadians);
  context.scale(scale, scale);
  context.drawImage(source, -die.centerX, -die.centerY);
  return canvas;
}

function dieFaceCrop(die: HTMLCanvasElement, threshold: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 600;
  const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
  if (!context) return undefined;
  context.drawImage(
    die,
    die.width * 0.18,
    die.height * 0.12,
    die.width * 0.6,
    die.height * 0.56,
    0,
    0,
    canvas.width,
    canvas.height
  );
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < frame.data.length; index += 4) {
    const red = frame.data[index];
    const green = frame.data[index + 1];
    const blue = frame.data[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    const value = luminance >= threshold ? 0 : 255;
    frame.data[index] = value;
    frame.data[index + 1] = value;
    frame.data[index + 2] = value;
  }
  context.putImageData(frame, 0, 0);
  return canvas;
}

async function recognizeDieValue(source: HTMLCanvasElement, card: CardLocation, plane: CapturePlane, rotationRadians: number): Promise<number | undefined> {
  const die = locateDie(source, card, plane);
  if (!die) return undefined;
  const crop = alignedDieCrop(source, die, rotationRadians);
  if (!crop) return undefined;
  const recognizer = await worker();
  await recognizer.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR, tessedit_char_whitelist: '123456' });
  const attempts = [];
  for (const threshold of [85, 110, 65]) {
    const face = dieFaceCrop(crop, threshold);
    if (!face) continue;
    for (const correctionDegrees of [0, -10, 10]) {
      const result = await recognizer.recognize(face, { rotateRadians: correctionDegrees * Math.PI / 180 });
      const digit = Number(result.data.text.replace(/[^1-6]/g, '')[0]);
      if (digit) attempts.push({ digit, confidence: result.data.confidence });
    }
  }
  await recognizer.setParameters({ tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ ' });
  return attempts.sort((left, right) => right.confidence - left.confidence)[0]?.digit;
}

async function recognizeListCard(source: HTMLCanvasElement, card: CardLocation, plane: CapturePlane, orientation: ReturnType<typeof listCardOrientation>): Promise<RecognizedCard> {
  const aligned = alignedListCard(source, card, orientation.rotationRadians);
  if (!aligned) return { label: '' };
  const recognizedWords = await recognizeListWords(aligned.canvas);
  const dieValue = await recognizeDieValue(source, card, plane, orientation.rotationRadians);
  const words = recognizedWords.map(({ text }) => text);
  const selected = dieValue ? recognizedWords[dieValue - 1] : undefined;
  const confident = recognizedWords.length === 6 && (selected?.confidence ?? 0) >= 35;
  const label = confident && dieValue ? words[dieValue - 1] ?? '' : '';
  return {
    label,
    words,
    dieValue,
    cardCenter: { x: card.centerX / source.width, y: card.centerY / source.height },
    textRegion: {
      center: { x: card.centerX / source.width, y: card.centerY / source.height },
      width: card.height / source.width,
      height: card.width / source.width,
      rotationDegrees: -orientation.rotationRadians * 180 / Math.PI
    }
  };
}

export async function recognizeCard(source: HTMLCanvasElement, plane?: CapturePlane): Promise<RecognizedCard> {
  const card = locateCard(source);
  if (!card) {
    const axisAligned = locateAxisAlignedCard(source);
    if (!axisAligned) return { label: '' };
    const recognizer = await worker();
    await recognizer.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const result = await recognizer.recognize(fallbackCardCrop(source, axisAligned));
    return { label: normalizeCardLabel(result.data.text) };
  }
  if (plane) {
    const orientation = listCardOrientation(source, card, plane);
    if (orientation.alignment >= 0.62) {
      const listCard = await recognizeListCard(source, card, plane, orientation);
      if (listCard.words?.length === 6 || listCard.dieValue) return listCard;
    }
  }
  if (card.width / source.width > 0.42) {
    const axisAligned = locateAxisAlignedCard(source);
    if (!axisAligned) return { label: '' };
    const recognizer = await worker();
    await recognizer.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const result = await recognizer.recognize(fallbackCardCrop(source, axisAligned));
    return { label: normalizeCardLabel(result.data.text) };
  }
  const aligned = alignedCardCrop(source, card);
  if (!aligned) return { label: '', textRegion: undefined };
  const recognizer = await worker();
  const attempts = [];
  await recognizer.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE });
  const variants = [0, -8, -4, 4, 8].flatMap((correctionDegrees) =>
    [176, 160, 128].map((threshold) => ({ correctionDegrees, threshold }))
  );
  for (const { correctionDegrees, threshold } of variants) {
    const cropped = textCrop(aligned.canvas, threshold);
    if (!cropped) continue;
    const result = await recognizer.recognize(
      cropped.canvas,
      { rotateRadians: correctionDegrees * Math.PI / 180 },
      { text: true, blocks: true }
    );
    const label = normalizeCardLabel(result.data.text);
    attempts.push({ cropped, result, label });
    if (label && result.data.confidence >= 90) break;
  }
  const chosen = attempts
    .filter((attempt) => attempt.label)
    .sort((left, right) => right.result.data.confidence - left.result.data.confidence)[0] ?? attempts[0];
  if (!chosen) return { label: '', textRegion: undefined };
  const { cropped, result, label } = chosen;
  if (!label) {
    const axisAligned = locateAxisAlignedCard(source);
    if (!axisAligned) return { label: '', textRegion: undefined };
    await recognizer.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const fallback = await recognizer.recognize(fallbackCardCrop(source, axisAligned));
    return { label: normalizeCardLabel(fallback.data.text) };
  }
  const words = result.data.blocks
    ?.flatMap((block) => block.paragraphs)
    .flatMap((paragraph) => paragraph.lines)
    .flatMap((line) => line.words)
    .filter((word) => /[A-Z]{2}/.test(word.text.toUpperCase()));
  const bbox = words?.length ? {
    x0: Math.min(...words.map((word) => word.bbox.x0)),
    y0: Math.min(...words.map((word) => word.bbox.y0)),
    x1: Math.max(...words.map((word) => word.bbox.x1)),
    y1: Math.max(...words.map((word) => word.bbox.y1))
  } : undefined;
  const cropScale = cropped.canvas.width / cropped.sourceWidth;
  const left = cropped.sourceX + (bbox?.x0 ?? cropped.canvas.width * 0.2) / cropScale;
  const right = cropped.sourceX + (bbox?.x1 ?? cropped.canvas.width * 0.8) / cropScale;
  const top = cropped.sourceY + (bbox?.y0 ?? cropped.canvas.height * 0.35) / cropScale;
  const bottom = cropped.sourceY + (bbox?.y1 ?? cropped.canvas.height * 0.65) / cropScale;
  const alignedX = (left + right) / 2 - aligned.canvas.width / 2;
  const alignedY = (top + bottom) / 2 - aligned.canvas.height / 2;
  const rotation = card.rotationDegrees * Math.PI / 180;
  const sourceX = card.centerX + (Math.cos(rotation) * alignedX - Math.sin(rotation) * alignedY) / aligned.scale;
  const sourceY = card.centerY + (Math.sin(rotation) * alignedX + Math.cos(rotation) * alignedY) / aligned.scale;
  return {
    label,
    textRegion: {
      center: { x: sourceX / source.width, y: sourceY / source.height },
      width: (right - left) / aligned.scale / source.width,
      height: (bottom - top) / aligned.scale / source.width,
      rotationDegrees: card.rotationDegrees
    }
  };
}

export async function recognizeCardLabel(source: HTMLCanvasElement): Promise<string> {
  return (await recognizeCard(source)).label;
}
