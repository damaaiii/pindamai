export interface CropRect {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  w: number; // 0..1 normalized
  h: number; // 0..1 normalized
}

export async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar ke canvas.'));
    img.src = dataUrl;
  });
}

export async function rotateDataUrl(dataUrl: string, degrees: 90 | -90): Promise<string> {
  const img = await loadImageFromDataUrl(dataUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context tidak tersedia.');

  canvas.width = img.height;
  canvas.height = img.width;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);

  return canvas.toDataURL('image/jpeg', 0.92);
}

export async function cropAndResizeDataUrl(
  dataUrl: string,
  crop: CropRect,
  maxDimension = 1400
): Promise<{ dataUrl: string; thumbnailDataUrl: string }> {
  const img = await loadImageFromDataUrl(dataUrl);
  const sx = Math.max(0, Math.round(crop.x * img.width));
  const sy = Math.max(0, Math.round(crop.y * img.height));
  const sw = Math.max(10, Math.round(crop.w * img.width));
  const sh = Math.max(10, Math.round(crop.h * img.height));

  const scale = Math.min(1, maxDimension / Math.max(sw, sh));
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context tidak tersedia.');
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

  // Small thumbnail for local scan history
  const thumbScale = Math.min(1, 320 / Math.max(sw, sh));
  const tw = Math.max(1, Math.round(sw * thumbScale));
  const th = Math.max(1, Math.round(sh * thumbScale));
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = tw;
  thumbCanvas.height = th;
  const tctx = thumbCanvas.getContext('2d');
  if (tctx) {
    tctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    thumbnailDataUrl: thumbCanvas.toDataURL('image/jpeg', 0.72),
  };
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}
