export interface CropRect {
  x: number; // 0..1 normalized
  y: number; // 0..1 normalized
  w: number; // 0..1 normalized
  h: number; // 0..1 normalized
}

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const MAX_RAW_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB pre-compression safety cap
export const MAX_SCAN_PAYLOAD_BYTES = 3.5 * 1024 * 1024; // ~3.5 MB binary (stays < 4.5 MB Vercel body limit)

export function extractDataUrlMimeType(dataUrl: string): string {
  const match = /^data:([^;]+);base64,/i.exec(dataUrl);
  const raw = match?.[1]?.toLowerCase() || 'image/jpeg';
  return raw === 'image/jpg' ? 'image/jpeg' : raw;
}

export function estimateBase64Bytes(dataUrlOrBase64: string): number {
  const clean = dataUrlOrBase64.replace(/^data:[^;]+;base64,/, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export async function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('Format gambar tidak dapat dibaca. Gunakan file JPG, PNG, atau WebP ya!'));
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

  return canvas.toDataURL('image/jpeg', 0.9);
}

export async function cropAndResizeDataUrl(
  dataUrl: string,
  crop: CropRect,
  maxDimension = 1280
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
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, dw, dh);
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
    tctx.fillStyle = '#FFFFFF';
    tctx.fillRect(0, 0, tw, th);
    tctx.drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);
  }

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.86),
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

function isSupportedImageFile(file: File): boolean {
  const mime = (file.type || '').toLowerCase();
  if (mime) {
    return SUPPORTED_IMAGE_MIME_TYPES.has(mime);
  }
  const name = (file.name || '').toLowerCase();
  return /\.(jpe?g|png|webp|gif)$/.test(name);
}

/**
 * Validates format & size, then normalizes any supported uploaded image
 * into an appropriately sized JPEG data URL safe for both OCR and Vercel/Gemini Vision.
 */
export async function prepareImageFileForScan(
  file: File,
  maxDimension = 1280
): Promise<string> {
  if (!isSupportedImageFile(file)) {
    throw new Error(
      'Format gambar belum didukung nih. Pilih foto berformat JPG, PNG, WebP, atau GIF ya!'
    );
  }

  if (file.size > MAX_RAW_UPLOAD_BYTES) {
    throw new Error(
      'Ukuran file gambar terlalu besar (maksimal 20 MB). Coba pilih foto yang lebih kecil ya!'
    );
  }

  const rawDataUrl = await fileToDataUrl(file);
  const img = await loadImageFromDataUrl(rawDataUrl);

  const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
  const dw = Math.max(1, Math.round(img.width * scale));
  const dh = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser gagal memproses gambar di canvas.');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, dw, dh);
  ctx.drawImage(img, 0, 0, dw, dh);

  let output = canvas.toDataURL('image/jpeg', 0.86);
  if (estimateBase64Bytes(output) > MAX_SCAN_PAYLOAD_BYTES) {
    output = canvas.toDataURL('image/jpeg', 0.68);
  }
  if (estimateBase64Bytes(output) > MAX_SCAN_PAYLOAD_BYTES) {
    throw new Error(
      'Ukuran gambar masih terlalu besar setelah dikompres. Coba crop atau pilih foto dengan resolusi lebih kecil ya!'
    );
  }

  return output;
}
