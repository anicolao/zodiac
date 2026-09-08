import { detectConstellation } from './detect';
import { normalizeImage } from './image';
import { recognizeCard, type RecognizedCard, type RecognizedTextRegion } from './ocr';

export async function analyzePhotograph(file: Blob) {
  const normalized = await normalizeImage(file);
  const detection = detectConstellation(normalized.canvas);
  let cardLabel = '';
  let textRegion: RecognizedTextRegion | undefined;
  let card: RecognizedCard | undefined;
  try {
    card = await recognizeCard(normalized.canvas, detection.capturePlane);
    cardLabel = card.label;
    textRegion = card.textRegion;
  } catch (error) {
    console.warn('Local card-name recognition failed', error);
  }
  return {
    image: normalized.blob,
    imageAspectRatio: normalized.canvas.width / normalized.canvas.height,
    stars: detection.stars,
    capturePlane: detection.capturePlane,
    cardLabel,
    textRegion,
    cardCenter: card?.cardCenter,
    dieValue: card?.dieValue,
    cardWords: card?.words
  };
}
