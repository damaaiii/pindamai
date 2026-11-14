import React, { useState } from 'react';
import {
  Download,
  Share,
  CheckCircle2,
  Smartphone,
  PlusSquare,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'compact' | 'card' | 'banner';
  onNotify?: (msg: string) => void;
}

const BANNER_DISMISS_KEY = 'pindamai_install_banner_dismissed';

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'compact',
  onNotify,
}) => {
  const { isInstallable, isInstalled, justInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showBrowserGuide, setShowBrowserGuide] = useState(false);
  const [dismissedMsg, setDismissedMsg] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(BANNER_DISMISS_KEY) === '1';
  });

  const handleDismissBanner = () => {
    setBannerDismissed(true);
    try {
      window.localStorage.setItem(BANNER_DISMISS_KEY, '1');
    } catch {
      // ignore storage failure
    }
  };

  const handleInstallClick = async () => {
    setDismissedMsg(false);
    if (isInstallable) {
      const outcome = await install();
      if (outcome === 'accepted') {
        onNotify?.('Yeay! PINDAMAI sedang dipasang ke perangkatmu.');
      } else if (outcome === 'dismissed') {
        setDismissedMsg(true);
        onNotify?.('Instalasi dibatalkan dulu. Tenang, kamu bisa install kapan aja nanti!');
      } else {
        setShowBrowserGuide(true);
      }
      return;
    }

    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    setShowBrowserGuide(true);
  };

  const buttonLabel = isInstalled
    ? 'APP INSTALLED'
    : isInstallable
      ? 'INSTALL NOW'
      : isIOS
        ? 'INSTALL APP'
        : 'SEE INSTALL GUIDE';

  if (variant === 'banner') {
    if (isInstalled) {
      if (!justInstalled) return null;
      return (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#E7F0DF] border border-[#C9DFC0] flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#1F2D21]">
            <CheckCircle2 className="w-5 h-5 text-[#3A6B3E] shrink-0" />
            <span>Yeay! PINDAMAI berhasil terpasang (APP INSTALLED). Buka kapan aja dari home screen!</span>
          </div>
        </div>
      );
    }

    if (bannerDismissed) return null;

    return (
      <>
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#FCE9ED] via-[#FFF8F0] to-[#FFF6D6] border border-[#F6C9D5] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#F6C9D5] text-[#2B2226] flex items-center justify-center shrink-0 shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <p className="font-display font-bold text-sm sm:text-base text-[#2B2226] flex items-center gap-1.5">
                <span>Pasang PINDAMAI di Layar Utama!</span>
                <Sparkles className="w-4 h-4 text-[#A83B5A]" />
              </p>
              <p className="text-xs sm:text-sm text-[#5C4B51]">
                {isInstallable
                  ? 'Browser kamu mendukung instalasi langsung—klik INSTALL NOW buat akses super cepat & mode offline.'
                  : isIOS
                    ? 'Pengguna iPhone/iPad bisa pasang lewat Safari dengan 3 langkah simpel.'
                    : 'Simpan PINDAMAI sebagai aplikasi mandiri agar belajar Arab & Inggris makin praktis.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2B2226] hover:bg-[#3f3338] text-[#FFF8F0] px-4 py-2.5 text-xs font-bold shadow-xs transition-all min-h-[42px] whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{isInstallable ? 'INSTALL NOW' : 'INSTALL APP'}</span>
            </button>
            <button
              type="button"
              onClick={handleDismissBanner}
              aria-label="Tutup banner install"
              className="p-2.5 rounded-2xl bg-white/80 hover:bg-white border border-[#EADFD5] text-[#5C4B51] min-h-[42px] min-w-[42px] flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {renderModals()}
      </>
    );
  }

  function renderModals() {
    return (
      <>
        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
          >
            <div className="w-full max-w-md rounded-3xl bg-[#FFF8F0] border border-[#EADFD5] p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-[#A83B5A]">iOS Safari Guide</span>
                  <h3 id="ios-install-title" className="font-display text-lg font-bold text-[#2B2226]">
                    Pasang PINDAMAI di iPhone / iPad
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Tutup panduan"
                  className="p-2 rounded-xl hover:bg-[#FCE9ED] text-[#5C4B51] min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[#5C4B51]">
                Safari di iPhone pakai cara khusus buat pasang aplikasi web. Ikuti 3 langkah gampang ini ya:
              </p>
              <ol className="space-y-3 text-sm text-[#2B2226]">
                <li className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-[#F6C9D5]">
                  <div className="w-8 h-8 rounded-xl bg-[#FCE9ED] text-[#A83B5A] flex items-center justify-center shrink-0">
                    <Share className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-[#A83B5A]">Langkah 1</p>
                    <p className="text-sm">
                      Ketuk ikon <strong>Share</strong> di bar Safari (bagian bawah atau kanan atas).
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-[#C9DFC0]">
                  <div className="w-8 h-8 rounded-xl bg-[#E7F0DF] text-[#263B27] flex items-center justify-center shrink-0">
                    <PlusSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-[#263B27]">Langkah 2</p>
                    <p className="text-sm">
                      Gulir daftar menu ke bawah lalu pilih <strong>Add to Home Screen</strong>.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-[#F8E6A0]">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF6D6] text-[#6B5416] flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs text-[#6B5416]">Langkah 3</p>
                    <p className="text-sm">
                      Ketuk <strong>Add</strong> di pojok kanan atas. Ikon PINDAMAI langsung muncul di layar utama!
                    </p>
                  </div>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full rounded-2xl bg-[#2B2226] py-3 text-sm font-semibold text-[#FFF8F0] hover:bg-[#3f3338] min-h-[44px]"
              >
                Oke, Paham!
              </button>
            </div>
          </div>
        )}

        {showBrowserGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="browser-install-title"
          >
            <div className="w-full max-w-md rounded-3xl bg-[#FFF8F0] border border-[#EADFD5] p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 id="browser-install-title" className="font-display text-lg font-bold text-[#2B2226]">
                  Panduan Install Aplikasi PINDAMAI
                </h3>
                <button
                  type="button"
                  onClick={() => setShowBrowserGuide(false)}
                  aria-label="Tutup panduan"
                  className="p-2 rounded-xl hover:bg-[#FCE9ED] text-[#5C4B51] min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-[#5C4B51]">
                Saat ini prompt instalasi otomatis browser belum tersedia (biasanya karena dibuka di tab preview iFrame, mode Incognito, atau browser yang belum mendukung langsung). Kamu bisa install lewat langkah ini:
              </p>
              <ul className="space-y-2.5 text-sm text-[#2B2226] list-disc pl-5">
                <li>
                  Buka halaman ini di tab browser utama (bukan dalam iFrame) dengan koneksi <strong>HTTPS</strong>.
                </li>
                <li>
                  Di <strong>Chrome / Edge Desktop</strong>: klik ikon layar-panah (Install) di ujung kanan address bar, atau buka menu titik tiga → <strong>Cast, save, and share → Install PINDAMAI</strong>.
                </li>
                <li>
                  Di <strong>Chrome Android</strong>: ketuk menu titik tiga di pojok kanan atas → pilih <strong>Install app / Add to Home screen</strong>.
                </li>
              </ul>
              <button
                type="button"
                onClick={() => setShowBrowserGuide(false)}
                className="w-full rounded-2xl bg-[#2B2226] py-3 text-sm font-semibold text-[#FFF8F0] hover:bg-[#3f3338] min-h-[44px]"
              >
                Sip, Mengerti!
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (variant === 'compact') {
    if (isInstalled) {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#E7F0DF] border border-[#C9DFC0] px-3 py-2 text-xs font-bold text-[#263B27] whitespace-nowrap shrink-0 min-h-[38px]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>APP INSTALLED</span>
        </span>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all whitespace-nowrap shrink-0 min-h-[40px] shadow-xs ${
            isInstallable
              ? 'bg-[#2B2226] hover:bg-[#3f3338] text-[#FFF8F0]'
              : 'bg-[#F6C9D5] hover:bg-[#f0b9c8] text-[#2B2226]'
          }`}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>{isInstallable ? 'INSTALL NOW' : isIOS ? 'INSTALL APP' : 'INSTALL APP'}</span>
        </button>
        {renderModals()}
      </>
    );
  }

  // Card variant (Settings page & Dashboard install card)
  return (
    <>
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl border shadow-xs ${
          isInstalled
            ? 'bg-[#E7F0DF] border-[#C9DFC0]'
            : 'bg-[#FCE9ED] border-[#F6C9D5]'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-display font-bold text-[#2B2226]">
            {isInstalled ? (
              <CheckCircle2 className="w-4 h-4 text-[#263B27] shrink-0" />
            ) : (
              <Smartphone className="w-4 h-4 shrink-0" />
            )}
            <span>
              {isInstalled
                ? 'PINDAMAI Sudah Terpasang (Standalone Mode)'
                : 'Pasang PINDAMAI jadi Aplikasi (PWA)'}
            </span>
          </div>
          <p className="text-sm text-[#5C4B51]">
            {isInstalled
              ? justInstalled
                ? 'Instalasi berhasil! PINDAMAI sekarang siap dibuka langsung dari home screen kamu.'
                : 'Aplikasi sudah terpasang di perangkat kamu dan berjalan dalam mode standalone.'
              : isInstallable
                ? 'Browser siap memasang PINDAMAI langsung! Klik tombol di samping untuk menginstall tanpa lewat toko aplikasi.'
                : isIOS
                  ? 'Buka panduan instalasi iPhone/iPad untuk menambahkan PINDAMAI ke Layar Utama Safari.'
                  : 'Akses cepat dari home screen HP atau desktop, lengkap dengan dukungan offline buat buka My Words!'}
          </p>
          {dismissedMsg && !isInstalled && (
            <p className="text-xs font-semibold text-[#7B3449] pt-1">
              Prompt instalasi ditutup tadi—kamu bisa coba klik lagi nanti kalau browser memunculkan promptnya, atau cek panduan install.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={isInstalled}
          onClick={handleInstallClick}
          className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
            isInstalled
              ? 'bg-white text-[#263B27] border border-[#C9DFC0] cursor-default'
              : 'bg-[#2B2226] hover:bg-[#3f3338] text-[#FFF8F0]'
          }`}
        >
          {isInstalled ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <Download className="w-4 h-4 shrink-0" />
          )}
          <span>{buttonLabel}</span>
        </button>
      </div>
      {renderModals()}
    </>
  );
};
