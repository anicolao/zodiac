import { detectStars } from './detect';
import { normalizeImage } from './image';
import { recognizeCardLabel } from './ocr';

export async function analyzePhotograph(file: Blob) {
  const normalized = await normalizeImage(file);
  const stars = detectStars(normalized.canvas);
  let cardLabel = '';
  try {
    cardLabel = await recognizeCardLabel(normalized.canvas);
  } catch (error) {
    console.warn('Local card-name recognition failed', error);
  }
  return { image: normalized.blob, stars, cardLabel };
}
