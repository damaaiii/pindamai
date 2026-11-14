import React, { useState } from 'react';
import { RotateCcw, RotateCw, Crop, Check, X } from 'lucide-react';
import { cropAndResizeDataUrl, rotateDataUrl, type CropRect } from '../lib/imageUtils';

interface ImageEditorProps {
  imageDataUrl: string;
  onChangeImage: (newDataUrl: string) => void;
  onConfirmCrop?: (croppedDataUrl: string, thumbnailDataUrl: string) => void;
}

export const ImageEditor: React.FC<ImageEditorProps> = ({
  imageDataUrl,
  onChangeImage,
  onConfirmCrop,
}) => {
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<CropRect>({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
  const [busy, setBusy] = useState(false);

  const handleRotate = async (deg: 90 | -90) => {
    try {
      setBusy(true);
      const rotated = await rotateDataUrl(imageDataUrl, deg);
      onChangeImage(rotated);
    } finally {
      setBusy(false);
    }
  };

  const handleApplyCrop = async () => {
    try {
      setBusy(true);
      const { dataUrl, thumbnailDataUrl } = await cropAndResizeDataUrl(imageDataUrl, crop);
      onChangeImage(dataUrl);
      setIsCropping(false);
      setCrop({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 });
      onConfirmCrop?.(dataUrl, thumbnailDataUrl);
    } finally {
      setBusy(false);
    }
  };

  const updateEdge = (edge: 'left' | 'right' | 'top' | 'bottom', percentVal: number) => {
    const val = Math.max(0, Math.min(95, percentVal)) / 100;
    setCrop((prev) => {
      if (edge === 'left') {
        const maxLeft = prev.x + prev.w - 0.15;
        const newX = Math.min(val, maxLeft);
        return { ...prev, x: newX, w: prev.x + prev.w - newX };
      }
      if (edge === 'right') {
        const rightPos = 1 - val;
        const newW = Math.max(0.15, rightPos - prev.x);
        return { ...prev, w: Math.min(newW, 1 - prev.x) };
      }
      if (edge === 'top') {
        const maxTop = prev.y + prev.h - 0.15;
        const newY = Math.min(val, maxTop);
        return { ...prev, y: newY, h: prev.y + prev.h - newY };
      }
      const bottomPos = 1 - val;
      const newH = Math.max(0.15, bottomPos - prev.y);
      return { ...prev, h: Math.min(newH, 1 - prev.y) };
    });
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-2xl overflow-hidden bg-[#F5ECE2] border border-[#EADFD5] flex items-center justify-center">
        <img
          src={imageDataUrl}
          alt="Preview gambar yang akan dipindai"
          className="max-h-[340px] w-auto object-contain mx-auto select-none"
        />
        {isCropping && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute border-2 border-[#A83B5A] bg-[#F6C9D5]/15 shadow-[0_0_0_9999px_rgba(43,34,38,0.45)]"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
              }}
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => handleRotate(-90)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#EADFD5] hover:bg-[#FCE9ED] text-xs font-semibold text-[#2B2226] min-h-[40px]"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Putar Kiri</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handleRotate(90)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#EADFD5] hover:bg-[#FCE9ED] text-xs font-semibold text-[#2B2226] min-h-[40px]"
        >
          <RotateCw className="w-4 h-4" />
          <span>Putar Kanan</span>
        </button>
        {!isCropping ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setIsCropping(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E7F0DF] border border-[#C9DFC0] hover:bg-[#d8e8cb] text-xs font-semibold text-[#263B27] min-h-[40px]"
          >
            <Crop className="w-4 h-4" />
            <span>Potong (Crop)</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={handleApplyCrop}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2B2226] text-xs font-semibold text-[#FFF8F0] min-h-[40px]"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan Crop</span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setIsCropping(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#EADFD5] text-xs font-semibold text-[#5C4B51] min-h-[40px]"
            >
              <X className="w-4 h-4" />
              <span>Batal</span>
            </button>
          </>
        )}
      </div>

      {isCropping && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] text-xs">
          <label className="space-y-1">
            <span className="font-semibold text-[#5C4B51] block">Batas Kiri ({Math.round(crop.x * 100)}%)</span>
            <input
              type="range"
              min={0}
              max={75}
              value={Math.round(crop.x * 100)}
              onChange={(e) => updateEdge('left', Number(e.target.value))}
              className="w-full accent-[#A83B5A]"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-[#5C4B51] block">Batas Kanan ({Math.round((1 - crop.x - crop.w) * 100)}%)</span>
            <input
              type="range"
              min={0}
              max={75}
              value={Math.round((1 - crop.x - crop.w) * 100)}
              onChange={(e) => updateEdge('right', Number(e.target.value))}
              className="w-full accent-[#A83B5A]"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-[#5C4B51] block">Batas Atas ({Math.round(crop.y * 100)}%)</span>
            <input
              type="range"
              min={0}
              max={75}
              value={Math.round(crop.y * 100)}
              onChange={(e) => updateEdge('top', Number(e.target.value))}
              className="w-full accent-[#A83B5A]"
            />
          </label>
          <label className="space-y-1">
            <span className="font-semibold text-[#5C4B51] block">Batas Bawah ({Math.round((1 - crop.y - crop.h) * 100)}%)</span>
            <input
              type="range"
              min={0}
              max={75}
              value={Math.round((1 - crop.y - crop.h) * 100)}
              onChange={(e) => updateEdge('bottom', Number(e.target.value))}
              className="w-full accent-[#A83B5A]"
            />
          </label>
        </div>
      )}
    </div>
  );
};
