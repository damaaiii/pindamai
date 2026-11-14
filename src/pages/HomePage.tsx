import React, { useMemo, useState } from 'react';
import {
  Camera,
  FileText,
  Box,
  BookmarkPlus,
  Check,
  ArrowRight,
  Sparkles,
  BookOpen,
  Flame,
  Trophy,
} from 'lucide-react';
import type {
  AppSettings,
  LearningProgress,
  NavRoute,
  ScanHistoryItem,
  VocabularyItem,
} from '../types/pindamai';
import { dailyEntryToVocabItem, getDailyVocab } from '../lib/dailyVocab';
import { AudioPlayerButton } from '../components/AudioPlayerButton';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface HomePageProps {
  vocabulary: VocabularyItem[];
  scanHistory: ScanHistoryItem[];
  progress: LearningProgress;
  settings: AppSettings;
  onNavigate: (route: NavRoute) => void;
  onStartScannerMode: (mode: 'text' | 'object') => void;
  onSaveVocab: (item: VocabularyItem) => Promise<void>;
  onOpenScanInLearn: (scan: ScanHistoryItem) => void;
  onNotify: (msg: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  vocabulary,
  scanHistory,
  progress,
  settings,
  onNavigate,
  onStartScannerMode,
  onSaveVocab,
  onOpenScanInLearn,
  onNotify,
}) => {
  const daily = useMemo(() => getDailyVocab(), []);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [textImgFailed, setTextImgFailed] = useState(false);
  const [objImgFailed, setObjImgFailed] = useState(false);
  const [pracImgFailed, setPracImgFailed] = useState(false);

  const isDailySaved = vocabulary.some(
    (v) => v.id === `vocab-${daily.id}` || v.englishWord?.toLowerCase() === daily.englishWord.toLowerCase()
  );

  const stats = useMemo(() => {
    const total = vocabulary.length;
    const arabicCount = vocabulary.filter(
      (v) => v.primaryLanguage === 'arabic' || v.primaryLanguage === 'both' || Boolean(v.arabicWord)
    ).length;
    const englishCount = vocabulary.filter(
      (v) => v.primaryLanguage === 'english' || v.primaryLanguage === 'both' || Boolean(v.englishWord)
    ).length;
    const masteredCount = vocabulary.filter((v) => v.status === 'mastered').length;
    const masteryPercent = total > 0 ? Math.round((masteredCount / total) * 100) : 0;
    return { total, arabicCount, englishCount, masteredCount, masteryPercent };
  }, [vocabulary]);

  const handleSaveDaily = async () => {
    await onSaveVocab(dailyEntryToVocabItem(daily));
    onNotify('Sip! Kosakata hari ini udah masuk ke My Words.');
  };

  return (
    <div className="space-y-8">
      {/* Optional First-Time PWA Install Banner */}
      <PWAInstallButton variant="banner" onNotify={onNotify} />

      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between p-6 sm:p-8 rounded-3xl bg-white border border-[#EADFD5]">
          <div className="space-y-4">
            <p className="text-sm font-medium text-[#7B5D66]">
              Halo, sobat bahasa! · Siap kepoin kata baru hari ini?
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-[#2B2226] leading-[1.15] text-balance">
              Scan the world. Learn the language.
            </h1>
            <p className="text-base text-[#5C4B51] max-w-xl leading-relaxed">
              Foto tulisan Arab, kalimat Inggris, atau benda apa pun di depanmu—biar PINDAMAI yang bantuin bedah arti, cara baca, suara pengucapan, sampai grammar-nya tanpa ribet!
            </p>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('scanner')}
              className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-[#2B2226] hover:bg-[#3f3338] text-[#FFF8F0] font-semibold text-sm transition-colors min-h-[48px] whitespace-nowrap"
            >
              <Camera className="w-5 h-5 shrink-0" />
              <span>Start Scanning</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('learn')}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#FCE9ED] hover:bg-[#F6C9D5] text-[#2B2226] font-semibold text-sm transition-colors min-h-[48px] whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>Bedah Teks Manual</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-3xl overflow-hidden border border-[#EADFD5] bg-[#FFF8F0] shadow-sm flex items-center justify-center min-h-[250px]">
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/hero_3d_dashboard_1794619232098.jpg"
              alt="Ilustrasi 3D teman belajar PINDAMAI dengan kaca pembesar, buku, apel, dan gelembung bicara"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-8 text-center space-y-2">
              <Sparkles className="w-10 h-10 mx-auto text-[#A83B5A]" />
              <p className="font-display font-bold text-[#2B2226]">PINDAMAI Visual Lab</p>
              <p className="text-sm text-[#5C4B51]">Scan teks & benda nyata kapan aja</p>
            </div>
          )}
        </div>
      </section>

      {/* Summary & Learning Progress Row */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-[#EADFD5] space-y-1">
          <span className="text-xs font-medium text-[#7B5D66]">Total Kosakata</span>
          <p className="font-display text-3xl font-extrabold text-[#2B2226] tabular-nums">{stats.total}</p>
          <p className="text-xs text-[#5C4B51]">
            {stats.arabicCount} Arab · {stats.englishCount} Inggris
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-[#E7F0DF] border border-[#C9DFC0] space-y-1">
          <span className="text-xs font-medium text-[#263B27]">Sudah Dikuasai</span>
          <p className="font-display text-3xl font-extrabold text-[#1F2D21] tabular-nums">
            {stats.masteredCount}
          </p>
          <div className="pt-1 space-y-1">
            <div className="w-full h-2 rounded-full bg-white/80 overflow-hidden">
              <div
                className="h-full bg-[#3A6B3E] rounded-full transition-all duration-300"
                style={{ width: `${stats.masteryPercent}%` }}
              />
            </div>
            <p className="text-xs text-[#263B27] tabular-nums">{stats.masteryPercent}% mastered</p>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-[#FCE9ED] border border-[#F6C9D5] space-y-1">
          <span className="text-xs font-medium text-[#7B3449] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5" /> Streak Belajar
          </span>
          <p className="font-display text-3xl font-extrabold text-[#2B2226] tabular-nums">
            {progress.streakDays} Hari
          </p>
          <p className="text-xs text-[#5C4B51] tabular-nums">{progress.totalScans} kali scan</p>
        </div>

        <div className="p-5 rounded-3xl bg-[#FFF6D6] border border-[#F8E6A0] space-y-1">
          <span className="text-xs font-medium text-[#6B5416] flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Poin Belajar
          </span>
          <p className="font-display text-3xl font-extrabold text-[#2B2226] tabular-nums">
            {progress.xpPoints} XP
          </p>
          <p className="text-xs text-[#5C4B51] tabular-nums">
            {progress.totalPracticeSessions} sesi latihan
          </p>
        </div>
      </section>

      {/* Two Scanner Modes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#2B2226]">
            Pilih Mode Scanner
          </h2>
          <span className="text-xs text-[#7B5D66]">Kamera · Galeri · Teks</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            type="button"
            onClick={() => onStartScannerMode('text')}
            className="group text-left rounded-3xl bg-[#FCE9ED] border border-[#F6C9D5] overflow-hidden hover:bg-[#fadce4] transition-colors flex flex-col sm:flex-row items-stretch"
          >
            <div className="sm:w-44 h-40 sm:h-auto shrink-0 bg-[#FCE9ED] overflow-hidden">
              {!textImgFailed ? (
                <img
                  src="/src/assets/images/scanner_3d_text_1794619232682.jpg"
                  alt="Ilustrasi 3D Scan Text"
                  referrerPolicy="no-referrer"
                  onError={() => setTextImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileText className="w-10 h-10 text-[#A83B5A]" />
                </div>
              )}
            </div>
            <div className="p-5 flex flex-col justify-between gap-3 flex-1">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#A83B5A]">OCR · Arab & Inggris</span>
                <h3 className="font-display text-lg font-bold text-[#2B2226]">Scan Text</h3>
                <p className="text-sm text-[#5C4B51] leading-relaxed">
                  Foto halaman buku, papan nama, atau catatan. Langsung keluar terjemahan & audio pengucapannya!
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2B2226] group-hover:translate-x-1 transition-transform">
                Buka Text Scanner <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onStartScannerMode('object')}
            className="group text-left rounded-3xl bg-[#E7F0DF] border border-[#C9DFC0] overflow-hidden hover:bg-[#dcead0] transition-colors flex flex-col sm:flex-row items-stretch"
          >
            <div className="sm:w-44 h-40 sm:h-auto shrink-0 bg-[#E7F0DF] overflow-hidden">
              {!objImgFailed ? (
                <img
                  src="/src/assets/images/scanner_3d_object_1794619233530.jpg"
                  alt="Ilustrasi 3D Scan Object"
                  referrerPolicy="no-referrer"
                  onError={() => setObjImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Box className="w-10 h-10 text-[#263B27]" />
                </div>
              )}
            </div>
            <div className="p-5 flex flex-col justify-between gap-3 flex-1">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-[#263B27]">AI Vision · Single / Multi</span>
                <h3 className="font-display text-lg font-bold text-[#2B2226]">Scan Object</h3>
                <p className="text-sm text-[#435644] leading-relaxed">
                  Arahkan kamera ke benda di sekitarmu! Langsung dapet bahasa Arab berharakat, Inggris, IPA, dan audio.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#263B27] group-hover:translate-x-1 transition-transform">
                Buka Object Scanner <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </button>
        </div>
      </section>

      {/* Daily Vocabulary + Quick Practice */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-[#EADFD5] flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#7B5D66]">
                Kosakata Harian · {daily.category}
              </span>
              <span className="text-xs text-[#7B5D66]">{daily.partOfSpeech}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2">
                <span className="text-xs text-[#7B5D66] block">Bahasa Arab</span>
                <p className="font-arabic text-3xl font-bold text-[#2B2226]">{daily.arabicWord}</p>
                <p className="text-sm font-medium text-[#7B5D66]">{daily.arabicTransliteration}</p>
                <AudioPlayerButton
                  text={daily.arabicWord}
                  lang="ar-SA"
                  label="Listen Arabic"
                  speechRate={settings.speechRate}
                  compact
                  tone="pink"
                />
              </div>

              <div className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2">
                <span className="text-xs text-[#7B5D66] block">English & Arti</span>
                <p className="font-display text-2xl font-bold text-[#2B2226]">{daily.englishWord}</p>
                <p className="text-sm text-[#5C4B51]">{daily.indonesianMeaning}</p>
                <AudioPlayerButton
                  text={daily.englishWord}
                  lang="en-US"
                  label="Listen English"
                  speechRate={settings.speechRate}
                  compact
                  tone="green"
                />
              </div>
            </div>

            <p className="text-sm text-[#5C4B51] leading-relaxed bg-[#FFF6D6]/60 p-3.5 rounded-2xl">
              {daily.funNote}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#EADFD5]">
            <div className="text-xs text-[#5C4B51] space-y-0.5">
              <p className="font-arabic text-base text-[#2B2226]">{daily.exampleArabic}</p>
              <p>{daily.exampleEnglish} — {daily.exampleIndonesian}</p>
            </div>
            <button
              type="button"
              onClick={handleSaveDaily}
              disabled={isDailySaved}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-colors min-h-[42px] whitespace-nowrap ${
                isDailySaved
                  ? 'bg-[#E7F0DF] text-[#263B27]'
                  : 'bg-[#F6C9D5] hover:bg-[#f0b4c4] text-[#2B2226]'
              }`}
            >
              {isDailySaved ? <Check className="w-4 h-4" /> : <BookmarkPlus className="w-4 h-4" />}
              <span>{isDailySaved ? 'Tersimpan di My Words' : 'Simpan Kata Ini'}</span>
            </button>
          </div>
        </div>

        {/* Quick Practice Card */}
        <div className="lg:col-span-5 rounded-3xl bg-[#FFF6D6] border border-[#F8E6A0] overflow-hidden flex flex-col justify-between">
          <div className="h-44 overflow-hidden bg-[#FFF6D6]">
            {!pracImgFailed ? (
              <img
                src="/src/assets/images/practice_3d_quiz_1794619235141.jpg"
                alt="Ilustrasi 3D kuis dan piala PINDAMAI"
                referrerPolicy="no-referrer"
                onError={() => setPracImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
          <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-[#6B5416]">Latihan Interaktif</span>
              <h3 className="font-display text-xl font-bold text-[#2B2226]">
                Gas Uji Ingatanmu!
              </h3>
              <p className="text-sm text-[#5C4B51] leading-relaxed">
                Dari pilihan ganda, nyocokin kata, sampai susun kalimat—semuanya dibikin langsung dari hasil scan dan My Words kamu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('practice')}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#2B2226] hover:bg-[#3f3338] text-[#FFF8F0] text-sm font-semibold min-h-[46px]"
            >
              <span>Mulai Practice</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Recently Scanned */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold text-[#2B2226]">Recently Scanned</h2>
          {scanHistory.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('my-words')}
              className="text-sm font-semibold text-[#A83B5A] hover:underline whitespace-nowrap"
            >
              Lihat Semua Riwayat
            </button>
          )}
        </div>

        {scanHistory.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-[#EADFD5] text-center space-y-3">
            <p className="font-display font-bold text-[#2B2226]">
              Belum ada riwayat scan nih!
            </p>
            <p className="text-sm text-[#5C4B51] max-w-md mx-auto">
              Yuk cobain scan tulisan Arab, kalimat Inggris, atau benda di meja belajarmu. Hasilnya bakal tersimpan rapi di browser kamu!
            </p>
            <button
              type="button"
              onClick={() => onNavigate('scanner')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#F6C9D5] hover:bg-[#f0b4c4] text-sm font-semibold text-[#2B2226] min-h-[44px]"
            >
              <Camera className="w-4 h-4" />
              <span>Scan Pertamaku</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scanHistory.slice(0, 3).map((scan) => (
              <button
                key={scan.id}
                type="button"
                onClick={() => onOpenScanInLearn(scan)}
                className="text-left p-5 rounded-3xl bg-white border border-[#EADFD5] hover:border-[#F6C9D5] transition-colors space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[#7B5D66]">
                  <span>{scan.type === 'object' ? 'Object Scan' : 'Text Scan'}</span>
                  <span>{new Date(scan.createdAt).toLocaleDateString('id-ID')}</span>
                </div>
                <p className="font-display font-bold text-[#2B2226] truncate">{scan.title}</p>
                <p className="text-sm text-[#5C4B51] line-clamp-2">{scan.summary}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
