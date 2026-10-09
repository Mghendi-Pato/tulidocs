/**
 * Reads an image file and shrinks it to fit `max` pixels, returning a data URL
 * small enough to store with the business (PNG keeps transparency; photos become JPEG).
 */
export async function fileToLogo(file: File, max = 480): Promise<string> {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error('Choose a PNG, JPG, WebP or SVG image');
  if (file.size > 8 * 1024 * 1024) throw new Error('That image is too large (max 8 MB)');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Could not read that image'));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
    const w = Math.max(1, Math.round((img.naturalWidth || max) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || max) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    const png = canvas.toDataURL('image/png');
    if (png.length < 500_000 || file.type === 'image/png' || file.type === 'image/svg+xml') {
      if (png.length < 540_000) return png;
    }
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
