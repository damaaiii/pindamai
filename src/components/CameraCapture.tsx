import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, AlertCircle } from 'lucide-react';
import { formatSafeError } from '../lib/errorFormatter';

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      setError(null);
      setIsReady(false);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Wah, browser kamu belum mendukung akses kamera langsung nih. Coba upload gambar dari galeri aja ya!');
        return;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsReady(true);
        }
      } catch (err) {
        const msg = formatSafeError(err, '');
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('notallowed')) {
          setError(
            'Izin kameranya belum dibuka nih. Kamu bisa izinkan kamera di pengaturan browser, atau langsung upload foto dari galeri aja ya!'
          );
        } else {
          setError(
            'Kamera nggak terdeteksi atau lagi dipakai aplikasi lain. Tenang, kamu tetap bisa upload foto dari galeri kok!'
          );
        }
      }
    }

    startCamera();
    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode]);

  const handleSnap = () => {
    const video = videoRef.current;
    if (!video || !isReady) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onCapture(dataUrl);
  };

  return (
    <div className="rounded-3xl bg-[#2B2226] text-[#FFF8F0] overflow-hidden border border-[#44373D]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <span className="text-sm font-semibold">Kamera PINDAMAI</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Putar Kamera</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kamera"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error ? (
        <div className="p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#FCE9ED] text-[#A83B5A] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-sm text-[#FFF8F0]/90 max-w-md mx-auto leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-[#F6C9D5] text-[#2B2226] text-sm font-semibold min-h-[44px]"
          >
            Tutup & Pilih Galeri
          </button>
        </div>
      ) : (
        <div className="relative bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full max-h-[420px] object-cover mx-auto"
          />
          <div className="absolute bottom-4 inset-x-0 flex justify-center">
            <button
              type="button"
              onClick={handleSnap}
              disabled={!isReady}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#F6C9D5] hover:bg-[#f2b5c6] text-[#2B2226] font-bold text-sm shadow-lg disabled:opacity-50 min-h-[48px]"
            >
              <Camera className="w-5 h-5" />
              <span>{isReady ? 'Jepret Sekarang!' : 'Menyiapkan kamera...'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
