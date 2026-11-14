import React, { useRef, useState } from 'react';
import {
  Camera,
  Upload,
  FileText,
  Box,
  Sparkles,
  BookmarkPlus,
  Check,
  BookOpen,
  Edit3,
  AlertCircle,
  WifiOff,
  Loader2,
  ClipboardPaste,
  Headphones,
  RotateCcw,
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import type {
  AppSettings,
  DetectedObjectItem,
  KeyVocabItem,
  LanguageAnalysisResponse,
  LanguageChoice,
  ObjectScanResponse,
  ScanHistoryItem,
  VocabularyItem,
} from '../types/pindamai';
import { CameraCapture } from '../components/CameraCapture';
import { ImageEditor } from '../components/ImageEditor';
import { AudioPlayerButton } from '../components/AudioPlayerButton';
import { fileToDataUrl } from '../lib/imageUtils';
import { apiRequest } from '../lib/apiClient';

interface ScannerPageProps {
  initialMode: 'text' | 'object';
  isOnline: boolean;
  settings: AppSettings;
  savedVocab: VocabularyItem[];
  onSaveVocab: (item: VocabularyItem) => Promise<void>;
  onSaveScanHistory: (item: ScanHistoryItem) => Promise<void>;
  onOpenAnalysisInLearn: (
    text: string,
    language: LanguageChoice,
    existingAnalysis?: LanguageAnalysisResponse | null
  ) => void;
  onNotify: (msg: string) => void;
}

export const ScannerPage: React.FC<ScannerPageProps> = ({
  initialMode,
  isOnline,
  settings,
  savedVocab,
  onSaveVocab,
  onSaveScanHistory,
  onOpenAnalysisInLearn,
  onNotify,
}) => {
  const [scannerMode, setScannerMode] = useState<'text' | 'object'>(initialMode);

  // Shared image capture state
  const [showCamera, setShowCamera] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Text Scanner (OCR + Direct HEAR IT! Analysis) state
  const [ocrLanguage, setOcrLanguage] = useState<LanguageChoice>('auto');
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatusText, setOcrStatusText] = useState('');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [editableText, setEditableText] = useState('');
  const [textAnalyzing, setTextAnalyzing] = useState(false);
  const [textAnalyzeError, setTextAnalyzeError] = useState<string | null>(null);
  const [textAnalysisResult, setTextAnalysisResult] = useState<LanguageAnalysisResponse | null>(
    null
  );

  // Object Scanner (AI Vision) state
  const [objectMode, setObjectMode] = useState<'single' | 'multiple'>('single');
  const [objectLoading, setObjectLoading] = useState(false);
  const [objectError, setObjectError] = useState<string | null>(null);
  const [objectResult, setObjectResult] = useState<ObjectScanResponse | null>(null);
  const [selectedObjectIdx, setSelectedObjectIdx] = useState(0);
  const [showCorrection, setShowCorrection] = useState(false);
  const [correctionHint, setCorrectionHint] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      onNotify('Oops, pilih file gambar ya (JPG, PNG, atau WebP).');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setImageDataUrl(dataUrl);
      setShowCamera(false);
      setOcrError(null);
      setObjectError(null);
      setObjectResult(null);
    } catch {
      onNotify('Gagal membaca gambar dari perangkat.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRunOCR = async () => {
    if (!imageDataUrl) {
      setOcrError('Upload atau jepret foto tulisan dulu ya!');
      return;
    }
    setOcrRunning(true);
    setOcrProgress(0);
    setOcrError(null);
    setTextAnalysisResult(null);
    setOcrStatusText('Menyiapkan mesin pembaca teks (Tesseract OCR)...');

    const langCode =
      ocrLanguage === 'arabic' ? 'ara' : ocrLanguage === 'english' ? 'eng' : 'ara+eng';

    try {
      const result = await Tesseract.recognize(imageDataUrl, langCode, {
        logger: (m) => {
          if (m.status) {
            if (m.status.includes('loading tesseract')) {
              setOcrStatusText('Memuat engine OCR...');
            } else if (m.status.includes('loading language')) {
              setOcrStatusText(`Mengunduh/memuat data bahasa (${langCode})...`);
            } else if (m.status.includes('recognizing text')) {
              setOcrStatusText('Lagi membaca huruf demi huruf...');
            }
          }
          if (typeof m.progress === 'number') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
      });

      const extracted = result.data.text.trim();
      if (!extracted) {
        setOcrError(
          'Hmm, teksnya belum kebaca jelas nih. Coba crop lebih rapat ke bagian tulisan, putar jika miring, atau ketik manual aja ya!'
        );
      } else {
        setEditableText(extracted);
        onNotify('Sip! Teks berhasil dibaca. Cek dulu ya lalu tekan Analyze Text!');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setOcrError(
        !isOnline
          ? 'OCR gagal memuat model bahasa karena perangkat lagi offline dan data bahasa belum tersimpan di cache browser.'
          : `Wah, OCR mengalami kendala (${msg || 'gagal memproses gambar'}). Coba crop lebih jelas atau tempel teks secara manual.`
      );
    } finally {
      setOcrRunning(false);
    }
  };

  // Analyze OCR text directly in ScannerPage so HEAR IT! audio & translation appear immediately!
  const handleAnalyzeOCRText = async () => {
    const cleanText = editableText.trim();
    if (!cleanText) {
      setTextAnalyzeError('Teksnya masih kosong nih. Scan gambar atau tempel teks dulu ya!');
      return;
    }
    if (!isOnline) {
      setTextAnalyzeError(
        'Analisis bahasa AI butuh koneksi internet ya! Cek sinyalmu sebentar.'
      );
      return;
    }

    setTextAnalyzing(true);
    setTextAnalyzeError(null);

    try {
      const typed = await apiRequest<LanguageAnalysisResponse>('/api/ai/analyze-language', {
        method: 'POST',
        body: {
          text: cleanText,
          language: ocrLanguage,
          level: settings.defaultExplanationLevel,
          simplify: false,
        },
        timeoutMs: 55000,
      });
      setTextAnalysisResult(typed);

      await onSaveScanHistory({
        id: `scan-text-${Date.now()}`,
        type: 'text',
        title: cleanText.length > 46 ? `${cleanText.slice(0, 46)}...` : cleanText,
        rawText: cleanText,
        language: typed.detectedLanguage,
        summary: typed.indonesianTranslation,
        thumbnailDataUrl: imageDataUrl || undefined,
        analysisResult: typed,
        createdAt: Date.now(),
      });
    } catch (err) {
      setTextAnalyzeError(
        err instanceof Error
          ? err.message
          : 'Waduh, gagal menganalisis teks. Coba lagi sebentar ya!'
      );
    } finally {
      setTextAnalyzing(false);
    }
  };

  const handleScanObjects = async (hintOverride?: string) => {
    if (!imageDataUrl) {
      setObjectError('Upload atau jepret gambar objek dulu ya!');
      return;
    }
    if (!isOnline) {
      setObjectError(
        'Fitur AI Object Scanner butuh koneksi internet nih! Kamu tetap bisa buka My Words atau riwayat scan saat offline.'
      );
      return;
    }

    setObjectLoading(true);
    setObjectError(null);

    try {
      const typed = await apiRequest<ObjectScanResponse>('/api/ai/scan-objects', {
        method: 'POST',
        body: {
          imageBase64: imageDataUrl,
          mimeType: 'image/jpeg',
          mode: objectMode,
          hint: hintOverride || undefined,
        },
        timeoutMs: 55000,
      });
      setObjectResult(typed);
      setSelectedObjectIdx(0);
      setShowCorrection(false);

      if (typed.objects && typed.objects.length > 0 && !typed.uncertain) {
        const primary = typed.objects[0];
        await onSaveScanHistory({
          id: `scan-${Date.now()}`,
          type: 'object',
          title:
            typed.objects.length > 1
              ? `${primary.indonesianName} (+${typed.objects.length - 1} lainnya)`
              : `${primary.indonesianName} (${primary.englishWord})`,
          summary: `${primary.arabicWord} · ${primary.arabicTransliteration} · ${primary.englishWord}`,
          thumbnailDataUrl: imageDataUrl,
          objectResult: typed,
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      setObjectError(
        err instanceof Error
          ? err.message
          : 'Waduh, gagal menganalisis objek. Coba cek koneksi atau ulangi sebentar lagi ya.'
      );
    } finally {
      setObjectLoading(false);
    }
  };

  const handleSaveDetectedObject = async (obj: DetectedObjectItem) => {
    const now = Date.now();
    const item: VocabularyItem = {
      id: `vocab-${obj.englishWord.toLowerCase().replace(/[^a-z0-9]/g, '')}-${now}`,
      arabicWord: obj.arabicWord,
      arabicTransliteration: obj.arabicTransliteration,
      englishWord: obj.englishWord,
      indonesianMeaning: `${obj.indonesianName} — ${obj.indonesianMeaning}`,
      primaryLanguage: 'both',
      category: obj.category || 'Umum',
      funNote: obj.funNote,
      relatedVocabulary: obj.relatedVocabulary,
      exampleSentences: obj.exampleSentences,
      isFavorite: false,
      status: 'learning',
      source: 'object-scan',
      createdAt: now,
      updatedAt: now,
    };
    await onSaveVocab(item);
    onNotify(`Yeay! "${obj.indonesianName}" udah masuk ke My Words.`);
  };

  const handleSaveKeyVocab = async (kv: KeyVocabItem) => {
    const now = Date.now();
    const isAr =
      textAnalysisResult?.detectedLanguage === 'arabic' ||
      /[\u0600-\u06FF]/.test(kv.harakatOrOriginal || kv.word);
    const item: VocabularyItem = {
      id: `vocab-${(kv.word || kv.indonesian).slice(0, 18)}-${now}`,
      arabicWord: isAr ? kv.harakatOrOriginal || kv.word : undefined,
      arabicTransliteration: isAr ? kv.transliteration : undefined,
      englishWord: !isAr ? kv.word : kv.english,
      indonesianMeaning: kv.indonesian,
      primaryLanguage: isAr && kv.english ? 'both' : isAr ? 'arabic' : 'english',
      category: 'Hasil Text Scan',
      partOfSpeech: kv.partOfSpeech,
      funNote: kv.explanation,
      isFavorite: false,
      status: 'learning',
      source: 'text-scan',
      createdAt: now,
      updatedAt: now,
    };
    await onSaveVocab(item);
    onNotify(`Sip! "${kv.word}" tersimpan ke My Words.`);
  };

  const isObjSaved = (obj: DetectedObjectItem) =>
    savedVocab.some(
      (v) =>
        v.englishWord?.toLowerCase() === obj.englishWord.toLowerCase() ||
        v.arabicWord === obj.arabicWord
    );

  const isKeyVocabSaved = (kv: KeyVocabItem) =>
    savedVocab.some(
      (v) =>
        (v.arabicWord && (v.arabicWord === kv.word || v.arabicWord === kv.harakatOrOriginal)) ||
        (v.englishWord && v.englishWord.toLowerCase() === kv.word.toLowerCase())
    );

  const detectAudioLang = (txt: string, hint?: string): 'ar-SA' | 'en-US' => {
    if (hint === 'arabic' || /[\u0600-\u06FF]/.test(txt)) return 'ar-SA';
    return 'en-US';
  };

  const selectedObj = objectResult?.objects?.[selectedObjectIdx];

  return (
    <div className="space-y-6">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B2226]">
            Scanner PINDAMAI
          </h1>
          <p className="text-sm text-[#5C4B51]">
            Scan tulisan atau objek, langsung lihat arti dan dengarkan pengucapannya di sini!
          </p>
        </div>

        <div className="inline-flex p-1.5 rounded-2xl bg-white border border-[#EADFD5] self-start">
          <button
            type="button"
            onClick={() => setScannerMode('text')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[42px] whitespace-nowrap ${
              scannerMode === 'text'
                ? 'bg-[#FCE9ED] text-[#2B2226]'
                : 'text-[#5C4B51] hover:text-[#2B2226]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Text Scanner</span>
          </button>
          <button
            type="button"
            onClick={() => setScannerMode('object')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[42px] whitespace-nowrap ${
              scannerMode === 'object'
                ? 'bg-[#E7F0DF] text-[#263B27]'
                : 'text-[#5C4B51] hover:text-[#2B2226]'
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Object Scanner</span>
          </button>
        </div>
      </div>

      {/* Image Source Toolbar + 3D Empty Preview */}
      <div className="p-5 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCamera((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#2B2226] hover:bg-[#3f3338] text-[#FFF8F0] text-sm font-semibold min-h-[44px]"
          >
            <Camera className="w-4 h-4" />
            <span>{showCamera ? 'Tutup Kamera' : 'Buka Kamera'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FCE9ED] hover:bg-[#F6C9D5] text-[#2B2226] text-sm font-semibold min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            <span>Upload dari Galeri</span>
          </button>

          {scannerMode === 'text' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const clip = await navigator.clipboard.readText();
                  if (clip.trim()) {
                    setEditableText(clip.trim());
                    onNotify('Teks dari clipboard berhasil ditempel!');
                  } else {
                    onNotify('Clipboard kamu masih kosong nih.');
                  }
                } catch {
                  onNotify('Langsung ketik atau paste di kotak teks di bawah ya!');
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFF6D6] hover:bg-[#F8E6A0] text-[#2B2226] text-sm font-semibold min-h-[44px]"
            >
              <ClipboardPaste className="w-4 h-4" />
              <span>Tempel Teks</span>
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {showCamera && (
          <CameraCapture
            onCapture={(dataUrl) => {
              setImageDataUrl(dataUrl);
              setShowCamera(false);
              setObjectResult(null);
              setOcrError(null);
              setObjectError(null);
            }}
            onClose={() => setShowCamera(false)}
          />
        )}

        {imageDataUrl && !showCamera && (
          <ImageEditor
            imageDataUrl={imageDataUrl}
            onChangeImage={(updated) => setImageDataUrl(updated)}
          />
        )}

        {!imageDataUrl && !showCamera && (
          <div className="rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] p-5 flex flex-col sm:flex-row items-center gap-5">
            <img
              src={
                scannerMode === 'text'
                  ? '/src/assets/images/scanner_3d_text_1794619232682.jpg'
                  : '/src/assets/images/scanner_3d_object_1794619233530.jpg'
              }
              alt={
                scannerMode === 'text'
                  ? 'Ilustrasi 3D Text Scanner PINDAMAI'
                  : 'Ilustrasi 3D Object Scanner PINDAMAI'
              }
              referrerPolicy="no-referrer"
              className="w-40 h-32 rounded-2xl object-cover shrink-0 border border-[#EADFD5]"
            />
            <div className="space-y-1 text-center sm:text-left">
              <p className="font-display font-bold text-[#2B2226]">
                {scannerMode === 'text'
                  ? 'Siap Scan Tulisan Arab & Inggris!'
                  : 'Siap Kenali Benda di Sekitarmu!'}
              </p>
              <p className="text-sm text-[#5C4B51] max-w-lg">
                {scannerMode === 'text'
                  ? 'Klik Buka Kamera atau Upload dari Galeri untuk foto halaman buku/catatan, atau langsung ketik teks di editor bawah.'
                  : 'Foto apel, buku, gelas, atau meja belajarmu—AI Vision bakal langsung kasih kosakata Arab berharakat, English, IPA, dan suaranya!'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* TEXT SCANNER PANEL */}
      {scannerMode === 'text' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
              <h2 className="font-display text-lg font-bold text-[#2B2226]">
                1. Baca Tulisan dari Foto (OCR)
              </h2>

              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#5C4B51] block">
                  Bahasa Tulisan di Gambar
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {(['auto', 'arabic', 'english'] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setOcrLanguage(lang)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-colors min-h-[42px] ${
                        ocrLanguage === lang
                          ? 'bg-[#FCE9ED] border-[#F6C9D5] text-[#2B2226]'
                          : 'bg-[#FFF8F0] border-[#EADFD5] text-[#5C4B51]'
                      }`}
                    >
                      {lang === 'auto'
                        ? 'Auto Detect'
                        : lang === 'arabic'
                          ? 'Arabic (ara)'
                          : 'English (eng)'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={!imageDataUrl || ocrRunning}
                onClick={handleRunOCR}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#2B2226] hover:bg-[#3f3338] disabled:opacity-50 text-[#FFF8F0] text-sm font-semibold min-h-[48px]"
              >
                {ocrRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Membaca Teks ({ocrProgress}%)...</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>Ekstrak Teks (OCR)</span>
                  </>
                )}
              </button>

              {ocrRunning && (
                <div className="space-y-1.5">
                  <div className="w-full h-2.5 rounded-full bg-[#FCE9ED] overflow-hidden">
                    <div
                      className="h-full bg-[#A83B5A] transition-all duration-200"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#5C4B51]">{ocrStatusText}</p>
                </div>
              )}

              {ocrError && (
                <div className="p-3.5 rounded-2xl bg-[#FCE9ED] border border-[#F6C9D5] text-xs text-[#7B233B] flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{ocrError}</span>
                </div>
              )}

              <p className="text-xs text-[#7B5D66] leading-relaxed">
                Catatan jujur: OCR bekerja lokal di browser setelah model bahasa (`ara` / `eng`) terunduh. Kalau gambarnya tulisan tangan atau miring, hasilnya kadang perlu dirapikan sedikit ya!
              </p>
            </div>

            <div className="lg:col-span-7 p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-[#2B2226]">
                  2. Cek & Edit Hasil Teks
                </h2>
                {editableText && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditableText('');
                      setTextAnalysisResult(null);
                    }}
                    className="text-xs font-semibold text-[#7B5D66] hover:text-[#2B2226]"
                  >
                    Bersihkan
                  </button>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-[#FFF6D6]/70 text-xs text-[#5C4B51]">
                Psst, OCR kadang suka keliru baca huruf Arab yang mirip atau harakat tipis. Cek dulu ya di bawah sebelum tekan Analyze Text!
              </div>

              <textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                rows={5}
                dir="auto"
                placeholder="Hasil OCR bakal muncul di sini... atau langsung ketik/tempel teks Arab maupun Inggris kamu di sini!"
                className="w-full rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] focus:border-[#A83B5A] focus:outline-none p-4 text-base text-[#2B2226] leading-relaxed"
              />

              {textAnalyzeError && (
                <div className="p-3.5 rounded-2xl bg-[#FCE9ED] border border-[#F6C9D5] text-xs text-[#7B233B] flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{textAnalyzeError}</span>
                  </div>
                  <button
                    type="button"
                    disabled={textAnalyzing || !isOnline}
                    onClick={handleAnalyzeOCRText}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#F6C9D5] text-xs font-bold text-[#2B2226] min-h-[34px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Coba Lagi</span>
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                {editableText.trim() && (
                  <AudioPlayerButton
                    text={editableText.trim()}
                    lang={detectAudioLang(editableText, ocrLanguage)}
                    label="Dengar Teks Mentah"
                    speechRate={settings.speechRate}
                    tone="cream"
                  />
                )}

                <button
                  type="button"
                  onClick={handleAnalyzeOCRText}
                  disabled={!editableText.trim() || textAnalyzing || !isOnline}
                  className="ml-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#F6C9D5] hover:bg-[#efbac8] disabled:opacity-50 text-[#2B2226] font-bold text-sm min-h-[48px]"
                >
                  {textAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menganalisis & Menyiapkan Audio...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Analyze Text</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* IMMEDIATE HEAR IT! TEXT SCANNER RESULT */}
          {textAnalysisResult && (
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-[#EADFD5] space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Headphones className="w-5 h-5 text-[#A83B5A]" />
                  <h3 className="font-display text-xl font-extrabold text-[#2B2226]">
                    HEAR IT! Hasil Scan Teks
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenAnalysisInLearn(
                      textAnalysisResult.normalizedWithHarakat || textAnalysisResult.originalText,
                      ocrLanguage,
                      textAnalysisResult
                    )
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#FFF6D6] hover:bg-[#F8E6A0] text-xs font-bold text-[#2B2226] min-h-[40px]"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Bedah Nahwu / Grammar Lengkap di Learn</span>
                </button>
              </div>

              <p className="p-3.5 rounded-2xl bg-[#FCE9ED]/60 text-sm font-medium text-[#2B2226]">
                {textAnalysisResult.introMessage}
              </p>

              {textAnalysisResult.grammarCheck?.hasErrors && (
                <div className="p-4 rounded-2xl bg-[#FFF6D6]/75 border border-[#F8E6A0] space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#6B5416]">
                      Catatan Grammar Terdeteksi: {textAnalysisResult.grammarCheck.statusMessage}
                    </span>
                    <AudioPlayerButton
                      text={textAnalysisResult.grammarCheck.correctedText}
                      lang={detectAudioLang(
                        textAnalysisResult.grammarCheck.correctedText,
                        textAnalysisResult.detectedLanguage
                      )}
                      label="Listen Versi Benar"
                      speechRate={settings.speechRate}
                      compact
                      tone="cream"
                    />
                  </div>
                  <p dir="auto" className="text-sm font-bold text-[#2B2226]">
                    Versi perbaikan: {textAnalysisResult.grammarCheck.correctedText}
                  </p>
                </div>
              )}

              {/* Original & Translated with Immediate Audio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#7B5D66]">
                      {textAnalysisResult.isParagraph
                        ? 'Teks Asli (Paragraf Lengkap)'
                        : 'Teks Asli Hasil Scan'}
                    </span>
                    <AudioPlayerButton
                      text={
                        textAnalysisResult.normalizedWithHarakat ||
                        textAnalysisResult.originalText
                      }
                      lang={detectAudioLang(
                        textAnalysisResult.normalizedWithHarakat || textAnalysisResult.originalText,
                        textAnalysisResult.detectedLanguage
                      )}
                      label={
                        textAnalysisResult.isParagraph
                          ? 'Listen Full Paragraph'
                          : 'Listen Original'
                      }
                      speechRate={settings.speechRate}
                      tone="pink"
                    />
                  </div>
                  <p
                    className={`font-bold text-[#2B2226] ${
                      /[\u0600-\u06FF]/.test(
                        textAnalysisResult.normalizedWithHarakat || textAnalysisResult.originalText
                      )
                        ? 'font-arabic text-2xl leading-loose'
                        : 'text-lg'
                    }`}
                  >
                    {textAnalysisResult.normalizedWithHarakat || textAnalysisResult.originalText}
                  </p>
                  {textAnalysisResult.transliteration && (
                    <p className="text-xs text-[#7B3449]">{textAnalysisResult.transliteration}</p>
                  )}
                </div>

                <div className="p-5 rounded-2xl bg-[#E7F0DF]/65 border border-[#C9DFC0] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#263B27]">
                      Terjemahan Bahasa Indonesia
                    </span>
                    <AudioPlayerButton
                      text={textAnalysisResult.indonesianTranslation}
                      lang="id-ID"
                      label="Listen Translation"
                      speechRate={settings.speechRate}
                      tone="green"
                    />
                  </div>
                  <p className="text-base font-semibold text-[#2B2226] leading-relaxed">
                    {textAnalysisResult.indonesianTranslation}
                  </p>
                </div>
              </div>

              {/* Sentence-Level Audio (for paragraph sentences or example sentences) */}
              {textAnalysisResult.paragraphBreakdown?.sentences &&
                textAnalysisResult.paragraphBreakdown.sentences.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-display text-base font-bold text-[#2B2226]">
                      Audio Kalimat per Kalimat
                    </h4>
                    <div className="space-y-3">
                      {textAnalysisResult.paragraphBreakdown.sentences.map((s, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#7B5D66]">
                              Kalimat {idx + 1}
                            </span>
                            <div className="flex flex-wrap gap-2">
                              <AudioPlayerButton
                                text={s.original}
                                lang={detectAudioLang(s.original)}
                                label="Listen Original"
                                speechRate={settings.speechRate}
                                compact
                                tone="pink"
                              />
                              <AudioPlayerButton
                                text={s.translation}
                                lang="id-ID"
                                label="Listen Arti"
                                speechRate={settings.speechRate}
                                compact
                                tone="green"
                              />
                            </div>
                          </div>
                          <p
                            className={`font-bold text-[#2B2226] ${
                              /[\u0600-\u06FF]/.test(s.original) ? 'font-arabic text-xl' : 'text-base'
                            }`}
                          >
                            {s.original}
                          </p>
                          <p className="text-sm text-[#5C4B51]">{s.translation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Individual Vocabulary Words with Audio */}
              {textAnalysisResult.keyVocabulary?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-display text-base font-bold text-[#2B2226]">
                    Kosakata & Audio Kata per Kata
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {textAnalysisResult.keyVocabulary.map((kv, i) => {
                      const saved = isKeyVocabSaved(kv);
                      const targetWord = kv.harakatOrOriginal || kv.word;
                      return (
                        <div
                          key={i}
                          className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={`font-bold text-[#2B2226] ${
                                  /[\u0600-\u06FF]/.test(targetWord)
                                    ? 'font-arabic text-2xl'
                                    : 'font-display text-lg'
                                }`}
                              >
                                {targetWord}
                              </span>
                              <span className="text-xs text-[#7B5D66]">{kv.partOfSpeech}</span>
                            </div>
                            {kv.transliteration && (
                              <p className="text-xs text-[#7B3449]">{kv.transliteration}</p>
                            )}
                            <p className="text-sm font-semibold text-[#2B2226]">{kv.indonesian}</p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <AudioPlayerButton
                              text={targetWord}
                              lang={detectAudioLang(targetWord)}
                              label="Listen"
                              speechRate={settings.speechRate}
                              compact
                              tone="white"
                            />
                            <button
                              type="button"
                              disabled={saved}
                              onClick={() => handleSaveKeyVocab(kv)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold min-h-[34px] ${
                                saved
                                  ? 'bg-[#E7F0DF] text-[#263B27]'
                                  : 'bg-[#F6C9D5] hover:bg-[#efbac8] text-[#2B2226]'
                              }`}
                            >
                              {saved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                              <span>{saved ? 'Saved' : 'Save'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Example Sentences with Sentence-Level Audio */}
              {textAnalysisResult.exampleSentences?.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-display text-base font-bold text-[#2B2226]">
                    Contoh Kalimat (Ketuk Listen per Kalimat)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {textAnalysisResult.exampleSentences.map((ex, i) => {
                      const main = ex.target || ex.arabic || ex.english || '';
                      return (
                        <div
                          key={i}
                          className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2"
                        >
                          <p
                            className={`font-bold text-[#2B2226] ${
                              /[\u0600-\u06FF]/.test(main) ? 'font-arabic text-xl' : 'text-sm'
                            }`}
                          >
                            {main}
                          </p>
                          {ex.transliteration && (
                            <p className="text-xs text-[#7B3449]">{ex.transliteration}</p>
                          )}
                          <p className="text-xs text-[#5C4B51]">{ex.indonesian}</p>
                          <div className="flex flex-wrap gap-2 pt-1">
                            <AudioPlayerButton
                              text={main}
                              lang={detectAudioLang(main)}
                              label="Listen Kalimat"
                              speechRate={settings.speechRate}
                              compact
                              tone="pink"
                            />
                            <AudioPlayerButton
                              text={ex.indonesian}
                              lang="id-ID"
                              label="Listen Arti"
                              speechRate={settings.speechRate}
                              compact
                              tone="green"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* OBJECT SCANNER PANEL */}
      {scannerMode === 'object' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="font-display text-lg font-bold text-[#2B2226]">
                  Mode Pengenalan Objek (AI Vision)
                </h2>
                <p className="text-xs text-[#5C4B51]">
                  Pilih 1 benda utama atau banyak benda sekaligus dalam satu foto.
                </p>
              </div>

              <div className="inline-flex p-1 rounded-xl bg-[#FFF8F0] border border-[#EADFD5] self-start">
                <button
                  type="button"
                  onClick={() => setObjectMode('single')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] ${
                    objectMode === 'single'
                      ? 'bg-[#E7F0DF] text-[#263B27]'
                      : 'text-[#5C4B51]'
                  }`}
                >
                  Single Object
                </button>
                <button
                  type="button"
                  onClick={() => setObjectMode('multiple')}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] ${
                    objectMode === 'multiple'
                      ? 'bg-[#E7F0DF] text-[#263B27]'
                      : 'text-[#5C4B51]'
                  }`}
                >
                  Multiple Objects
                </button>
              </div>
            </div>

            {!isOnline && (
              <div className="p-3.5 rounded-2xl bg-[#FFF6D6] border border-[#F8E6A0] text-xs text-[#6B5416] flex items-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>
                  Lagi offline nih! AI Vision butuh koneksi internet buat mengenali objek di fotomu.
                </span>
              </div>
            )}

            {objectError && (
              <div className="p-3.5 rounded-2xl bg-[#FCE9ED] border border-[#F6C9D5] text-xs text-[#7B233B] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{objectError}</span>
                </div>
                <button
                  type="button"
                  disabled={objectLoading || !isOnline || !imageDataUrl}
                  onClick={() => handleScanObjects()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#F6C9D5] text-xs font-bold text-[#2B2226] min-h-[34px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Coba Lagi</span>
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={!imageDataUrl || objectLoading || !isOnline}
              onClick={() => handleScanObjects()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-[#2B2226] hover:bg-[#3f3338] disabled:opacity-50 text-[#FFF8F0] text-sm font-semibold min-h-[48px]"
            >
              {objectLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Lagi ngintip gambarnya...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Scan Object dengan AI</span>
                </>
              )}
            </button>
          </div>

          {/* Object Scan Results with Automatic HEAR IT! Audio */}
          {objectResult && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl bg-[#E7F0DF] border border-[#C9DFC0] text-sm text-[#263B27] font-medium">
                {objectResult.confidenceNote}
              </div>

              {objectResult.uncertain || !objectResult.objects?.length ? (
                <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-3">
                  <p className="font-display font-bold text-[#2B2226]">
                    Hmm, hasilnya belum cukup yakin nih!
                  </p>
                  <p className="text-sm text-[#5C4B51]">
                    PINDAMAI nggak mau ngarang nama benda kalau gambarnya kurang jelas. Coba foto ulang lebih terang, crop lebih dekat, atau kasih petunjuk di bawah ya!
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <input
                      type="text"
                      value={correctionHint}
                      onChange={(e) => setCorrectionHint(e.target.value)}
                      placeholder="Kasih tahu PINDAMAI ini benda apa..."
                      className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl bg-[#FFF8F0] border border-[#EADFD5] text-sm"
                    />
                    <button
                      type="button"
                      disabled={!correctionHint.trim() || objectLoading}
                      onClick={() => handleScanObjects(correctionHint.trim())}
                      className="px-4 py-2.5 rounded-xl bg-[#2B2226] text-[#FFF8F0] text-sm font-semibold min-h-[44px]"
                    >
                      Analisis Ulang
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {objectResult.objects.length > 1 && (
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-[#5C4B51]">
                        {objectResult.objects.length} objek terdeteksi — pilih salah satu buat lihat detail & audionya:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {objectResult.objects.map((obj, idx) => (
                          <button
                            key={`${obj.englishWord}-${idx}`}
                            type="button"
                            onClick={() => setSelectedObjectIdx(idx)}
                            className={`px-4 py-2.5 rounded-2xl text-sm font-semibold border transition-colors min-h-[42px] ${
                              selectedObjectIdx === idx
                                ? 'bg-[#2B2226] text-[#FFF8F0] border-[#2B2226]'
                                : 'bg-white text-[#2B2226] border-[#EADFD5] hover:bg-[#FCE9ED]'
                            }`}
                          >
                            {obj.indonesianName} · {obj.englishWord}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedObj && (
                    <div className="p-6 sm:p-7 rounded-3xl bg-white border border-[#EADFD5] space-y-6">
                      {/* Top Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <span className="text-xs font-semibold text-[#7B5D66]">
                            {selectedObj.category} · Keyakinan: {selectedObj.confidence}
                          </span>
                          <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B2226]">
                            {selectedObj.indonesianName}
                          </h3>
                          <p className="text-sm text-[#5C4B51]">{selectedObj.indonesianMeaning}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveDetectedObject(selectedObj)}
                            disabled={isObjSaved(selectedObj)}
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold min-h-[42px] ${
                              isObjSaved(selectedObj)
                                ? 'bg-[#E7F0DF] text-[#263B27]'
                                : 'bg-[#F6C9D5] hover:bg-[#efbac8] text-[#2B2226]'
                            }`}
                          >
                            {isObjSaved(selectedObj) ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <BookmarkPlus className="w-4 h-4" />
                            )}
                            <span>{isObjSaved(selectedObj) ? 'Tersimpan' : 'Save to My Words'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onOpenAnalysisInLearn(
                                `${selectedObj.arabicWord} (${selectedObj.englishWord})`,
                                'auto'
                              )
                            }
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFF6D6] hover:bg-[#F8E6A0] text-[#2B2226] text-xs font-semibold min-h-[42px]"
                          >
                            <BookOpen className="w-4 h-4" />
                            <span>Learn More</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowCorrection((v) => !v)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] hover:bg-[#FCE9ED] text-[#5C4B51] text-xs font-semibold min-h-[42px]"
                          >
                            <Edit3 className="w-4 h-4" />
                            <span>Correct Recognition</span>
                          </button>
                        </div>
                      </div>

                      {showCorrection && (
                        <div className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={correctionHint}
                            onChange={(e) => setCorrectionHint(e.target.value)}
                            placeholder="Misal: Ini sebenarnya botol minum tumbler..."
                            className="flex-1 min-w-[220px] px-4 py-2.5 rounded-xl bg-white border border-[#EADFD5] text-sm"
                          />
                          <button
                            type="button"
                            disabled={!correctionHint.trim() || objectLoading}
                            onClick={() => handleScanObjects(correctionHint.trim())}
                            className="px-4 py-2.5 rounded-xl bg-[#2B2226] text-[#FFF8F0] text-sm font-semibold min-h-[42px]"
                          >
                            Koreksi & Scan Ulang
                          </button>
                        </div>
                      )}

                      {/* Bilingual Cards with Separate Audio Playback Beside Each Language */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-[#FCE9ED]/65 border border-[#F6C9D5] space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#7B3449]">
                              Bahasa Arab
                            </span>
                            <AudioPlayerButton
                              text={selectedObj.arabicWord}
                              lang="ar-SA"
                              label="Listen to Arabic"
                              speechRate={settings.speechRate}
                              tone="pink"
                            />
                          </div>
                          <p className="font-arabic text-3xl font-bold text-[#2B2226]">
                            {selectedObj.arabicWord}
                          </p>
                          <p className="text-sm font-medium text-[#5C4B51]">
                            Transliterasi: {selectedObj.arabicTransliteration}
                          </p>
                        </div>

                        <div className="p-5 rounded-2xl bg-[#E7F0DF]/70 border border-[#C9DFC0] space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#263B27]">English</span>
                            <AudioPlayerButton
                              text={selectedObj.englishWord}
                              lang="en-US"
                              label="Listen to English"
                              speechRate={settings.speechRate}
                              tone="green"
                            />
                          </div>
                          <p className="font-display text-3xl font-bold text-[#2B2226]">
                            {selectedObj.englishWord}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-[#435644]">
                            {selectedObj.ipaTranscription && (
                              <span className="font-mono text-xs bg-white/80 px-2.5 py-1 rounded-lg border border-[#C9DFC0]">
                                IPA: {selectedObj.ipaTranscription}
                              </span>
                            )}
                            <span>Arti: {selectedObj.indonesianName}</span>
                          </div>
                        </div>
                      </div>

                      {selectedObj.funNote && (
                        <p className="p-4 rounded-2xl bg-[#FFF6D6]/70 text-sm text-[#4C3D14] leading-relaxed">
                          {selectedObj.funNote}
                        </p>
                      )}

                      {/* Sentence-Level Audio on Every Example Sentence */}
                      {selectedObj.exampleSentences?.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-display text-base font-bold text-[#2B2226]">
                            Contoh Kalimat & Audio per Kalimat
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {selectedObj.exampleSentences.map((ex, i) => (
                              <div
                                key={i}
                                className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-3"
                              >
                                {ex.english && (
                                  <div className="space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <span className="text-[11px] font-semibold text-[#263B27] block">
                                          English
                                        </span>
                                        <p className="text-sm font-semibold text-[#2B2226]">
                                          {ex.english}
                                        </p>
                                      </div>
                                      <AudioPlayerButton
                                        text={ex.english}
                                        lang="en-US"
                                        label="Listen"
                                        speechRate={settings.speechRate}
                                        compact
                                        tone="green"
                                      />
                                    </div>
                                  </div>
                                )}

                                {ex.arabic && (
                                  <div className="space-y-1 pt-1 border-t border-[#EADFD5]">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <span className="text-[11px] font-semibold text-[#7B3449] block">
                                          Arabic
                                        </span>
                                        <p className="font-arabic text-lg font-bold text-[#2B2226]">
                                          {ex.arabic}
                                        </p>
                                      </div>
                                      <AudioPlayerButton
                                        text={ex.arabic}
                                        lang="ar-SA"
                                        label="Listen"
                                        speechRate={settings.speechRate}
                                        compact
                                        tone="pink"
                                      />
                                    </div>
                                  </div>
                                )}

                                <div className="pt-1 border-t border-[#EADFD5] flex items-start justify-between gap-2">
                                  <div>
                                    <span className="text-[11px] font-semibold text-[#7B5D66] block">
                                      Indonesian
                                    </span>
                                    <p className="text-xs text-[#5C4B51]">{ex.indonesian}</p>
                                  </div>
                                  <AudioPlayerButton
                                    text={ex.indonesian}
                                    lang="id-ID"
                                    label="Listen"
                                    speechRate={settings.speechRate}
                                    compact
                                    tone="white"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Related Vocabulary with Audio */}
                      {selectedObj.relatedVocabulary?.length > 0 && (
                        <div className="space-y-2.5">
                          <h4 className="font-display text-base font-bold text-[#2B2226]">
                            Kosakata Terkait
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {selectedObj.relatedVocabulary.map((rel, i) => (
                              <div
                                key={i}
                                className="p-3.5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2"
                              >
                                <div>
                                  <p className="font-arabic text-lg font-bold text-[#2B2226]">
                                    {rel.arabic}
                                  </p>
                                  <p className="text-xs text-[#7B5D66]">{rel.transliteration}</p>
                                  <p className="text-sm font-semibold text-[#2B2226]">
                                    {rel.english} ·{' '}
                                    <span className="font-normal text-[#5C4B51]">{rel.indonesian}</span>
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <AudioPlayerButton
                                    text={rel.arabic}
                                    lang="ar-SA"
                                    label="AR"
                                    speechRate={settings.speechRate}
                                    compact
                                    tone="pink"
                                  />
                                  <AudioPlayerButton
                                    text={rel.english}
                                    lang="en-US"
                                    label="EN"
                                    speechRate={settings.speechRate}
                                    compact
                                    tone="green"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
