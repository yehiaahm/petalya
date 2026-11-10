/** Downscale a photo in the browser to WebP (≤ max px) so uploads stay small and fast. */
export async function prepareImage(file: File, max = 1600): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    cv.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/webp', 0.84));
    return blob && blob.size < file.size * 1.2 ? blob : file;
  } catch {
    return file;
  }
}

/** Upload a customer's reference photo; resolves to its /uploads URL. */
export async function uploadReference(file: File): Promise<string> {
  const blob = await prepareImage(file);
  const fd = new FormData();
  fd.append('file', blob, 'photo' + (blob.type === 'image/webp' ? '.webp' : ''));
  const r = await fetch('/api/upload', { method: 'POST', body: fd });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'upload');
  return (await r.json()).url;
}
