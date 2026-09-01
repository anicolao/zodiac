import { createWorker, PSM, type Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | undefined;

async function worker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      workerPath: `${location.origin}/ocr/worker.min.js`,
      corePath: `${location.origin}/ocr/core/tesseract-core-lstm.wasm.js`,
      langPath: `${location.origin}/ocr/lang`,
      logger: () => undefined
    }).then(async (instance) => {
      await instance.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
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

function locateCard(source: HTMLCanvasElement) {
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

function cardCrop(source: HTMLCanvasElement): HTMLCanvasElement {
  const crop = document.createElement('canvas');
  const card = locateCard(source) ?? {
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

export async function recognizeCardLabel(source: HTMLCanvasElement): Promise<string> {
  const result = await (await worker()).recognize(cardCrop(source));
  return normalizeCardLabel(result.data.text);
}
