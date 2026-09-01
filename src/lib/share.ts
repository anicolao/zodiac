export async function shareZodiac(blob: Blob): Promise<'shared' | 'saved' | 'cancelled'> {
  const file = new File([blob], 'my-zodiac.png', { type: 'image/png' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'My Zodiac' });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  saveZodiac(blob);
  return 'saved';
}
export function saveZodiac(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'my-zodiac.png';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
