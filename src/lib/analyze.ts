import { detectStars } from './detect';
import { normalizeImage } from './image';
import { recognizeCard, type RecognizedTextRegion } from './ocr';

export async function analyzePhotograph(file: Blob) {
  const normalized = await normalizeImage(file);
  const stars = detectStars(normalized.canvas);
  let cardLabel = '';
  let textRegion: RecognizedTextRegion | undefined;
  try {
    const card = await recognizeCard(normalized.canvas);
    cardLabel = card.label;
    textRegion = card.textRegion;
  } catch (error) {
    console.warn('Local card-name recognition failed', error);
  }
  return {
    image: normalized.blob,
    imageAspectRatio: normalized.canvas.width / normalized.canvas.height,
    stars,
    cardLabel,
    textRegion
  };
}
