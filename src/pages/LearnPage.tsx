import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  BookmarkPlus,
  Check,
  Loader2,
  AlertCircle,
  WifiOff,
  Lightbulb,
  GraduationCap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import type {
  AppSettings,
  ExplanationLevel,
  KeyVocabItem,
  LanguageAnalysisResponse,
  LanguageChoice,
  ScanHistoryItem,
  VocabularyItem,
} from '../types/pindamai';
import { AudioPlayerButton } from '../components/AudioPlayerButton';
import { apiRequest } from '../lib/apiClient';
import { formatSafeError } from '../lib/errorFormatter';
import learn3dImg from '../assets/images/learn_3d_study_1794619234598.jpg';

interface LearnPageProps {
  initialText: string;
  initialLanguage: LanguageChoice;
  initialAnalysis?: LanguageAnalysisResponse | null;
  autoTrigger?: boolean;
  onConsumeAutoTrigger: () => void;
  isOnline: boolean;
  settings: AppSettings;
  savedVocab: VocabularyItem[];
  onSaveVocab: (item: VocabularyItem) => Promise<void>;
  onSaveScanHistory: (item: ScanHistoryItem) => Promise<void>;
  onPracticeFromText: (text: string, title: string) => void;
  onNotify: (msg: string) => void;
}

function detectAudioLang(text: string, hint?: string): 'ar-SA' | 'en-US' {
  if (/[\u0600-\u06FF]/.test(text)) return 'ar-SA';
  if (hint === 'arabic') return 'ar-SA';
  return 'en-US';
}

export const LearnPage: React.FC<LearnPageProps> = ({
  initialText,
  initialLanguage,
  initialAnalysis,
  autoTrigger,
  onConsumeAutoTrigger,
  isOnline,
  settings,
  savedVocab,
  onSaveVocab,
  onSaveScanHistory,
  onPracticeFromText,
  onNotify,
}) => {
  const [text, setText] = useState(initialText);
  const [language, setLanguage] = useState<LanguageChoice>(initialLanguage);
  const [level, setLevel] = useState<ExplanationLevel>(settings.defaultExplanationLevel);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<LanguageAnalysisResponse | null>(initialAnalysis || null);
  const [miniAnswers, setMiniAnswers] = useState<Record<number, number>>({});
  const lastTriggeredRef = useRef<string>('');

  useEffect(() => {
    setText(initialText);
    setLanguage(initialLanguage);
    if (initialAnalysis) {
      setAnalysis(initialAnalysis);
    }
  }, [initialText, initialLanguage, initialAnalysis]);

  const runAnalysis = async (simplify = false, overrideText?: string, overrideLang?: LanguageChoice) => {
    const targetText = (overrideText ?? text).trim();
    const targetLang = overrideLang ?? language;
    if (!targetText) {
      setError('Tulis atau tempel teks Arab/Inggris dulu ya sebelum dianalisis!');
      return;
    }
    if (!isOnline) {
      setError('Lagi offline nih! Analisis bahasa AI butuh koneksi internet ya.');
      return;
    }

    setLoading(true);
    setError(null);
    setMiniAnswers({});

    try {
      const typed = await apiRequest<LanguageAnalysisResponse>('/api/ai/analyze-language', {
        method: 'POST',
        body: {
          text: targetText,
          language: targetLang,
          level,
          simplify,
        },
        timeoutMs: 55000,
      });
      setAnalysis(typed);

      if (!simplify) {
        await onSaveScanHistory({
          id: `scan-text-${Date.now()}`,
          type: 'text',
          title: targetText.length > 46 ? `${targetText.slice(0, 46)}...` : targetText,
          rawText: targetText,
          language: typed.detectedLanguage,
          summary: typed.indonesianTranslation,
          analysisResult: typed,
          createdAt: Date.now(),
        });
      }
    } catch (err) {
      setError(
        formatSafeError(
          err,
          'Waduh, gagal menganalisis teks. Coba cek koneksi atau ulangi lagi ya!'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoTrigger && initialText.trim() && lastTriggeredRef.current !== initialText.trim()) {
      lastTriggeredRef.current = initialText.trim();
      onConsumeAutoTrigger();
      runAnalysis(false, initialText, initialLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrigger, initialText]);

  const handleSaveKeyVocab = async (kv: KeyVocabItem) => {
    const now = Date.now();
    const isAr =
      analysis?.detectedLanguage === 'arabic' ||
      /[\u0600-\u06FF]/.test(kv.harakatOrOriginal || kv.word);
    const item: VocabularyItem = {
      id: `vocab-${(kv.word || kv.indonesian).slice(0, 18)}-${now}`,
      arabicWord: isAr ? kv.harakatOrOriginal || kv.word : undefined,
      arabicTransliteration: isAr ? kv.transliteration : undefined,
      englishWord: !isAr ? kv.word : kv.english,
      indonesianMeaning: kv.indonesian,
      primaryLanguage: isAr && kv.english ? 'both' : isAr ? 'arabic' : 'english',
      category: 'Hasil Learn',
      partOfSpeech: kv.partOfSpeech,
      funNote: kv.explanation,
      isFavorite: false,
      status: 'learning',
      source: 'text-scan',
      createdAt: now,
      updatedAt: now,
    };
    await onSaveVocab(item);
    onNotify(`Sip! "${kv.word}" udah disimpan ke My Words.`);
  };

  const isVocabSaved = (kv: KeyVocabItem) =>
    savedVocab.some(
      (v) =>
        (v.arabicWord && (v.arabicWord === kv.word || v.arabicWord === kv.harakatOrOriginal)) ||
        (v.englishWord && v.englishWord.toLowerCase() === kv.word.toLowerCase())
    );

  const fullOriginalTranslation =
    analysis?.translation?.originalFullTranslation || analysis?.indonesianTranslation || '';
  const correctedTranslation = analysis?.translation?.correctedFullTranslation;
  const hasGrammarErrors = Boolean(analysis?.grammarCheck?.hasErrors);
  const grammarErrorsList = analysis?.grammarCheck?.errors || [];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white border border-[#EADFD5] p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        <div className="md:col-span-8 space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B2226]">
            Learn · AI Language Tutor
          </h1>
          <p className="text-sm text-[#5C4B51] leading-relaxed">
            Cek grammar otomatis, perbaiki kalimat yang keliru, terjemahkan seluruh paragraf tanpa ada yang terlewat, dan bedah Nahwu, Sharaf, maupun English Grammar per kalimat!
          </p>
        </div>
        <div className="md:col-span-4 flex justify-center md:justify-end">
          <img
            src={learn3dImg}
            alt="Ilustrasi belajar buku bahasa Arab dan Inggris"
            referrerPolicy="no-referrer"
            className="w-full max-w-[200px] aspect-[16/10] object-cover rounded-2xl border border-[#EADFD5]"
          />
        </div>
      </div>

      {/* Input & Controls */}
      <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          dir="auto"
          placeholder="Contoh: She go to school every day.  atau  ذَهَبَ أَحْمَدُ إِلَى الْمَدْرَسَةِ، وَقَرَأَ الْكِتَابَ، ثُمَّ رَجَعَ إِلَى الْبَيْتِ."
          className="w-full rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] focus:border-[#A83B5A] focus:outline-none p-4 text-base text-[#2B2226] leading-relaxed"
        />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Language selector */}
            <div className="inline-flex p-1 rounded-xl bg-[#FFF8F0] border border-[#EADFD5]">
              {(['auto', 'arabic', 'english'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] ${
                    language === l ? 'bg-[#FCE9ED] text-[#2B2226]' : 'text-[#5C4B51]'
                  }`}
                >
                  {l === 'auto' ? 'Auto Detect' : l === 'arabic' ? 'Arabic' : 'English'}
                </button>
              ))}
            </div>

            {/* Level selector */}
            <div className="inline-flex p-1 rounded-xl bg-[#FFF8F0] border border-[#EADFD5]">
              {(['beginner', 'intermediate', 'advanced'] as const).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevel(lv)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize min-h-[36px] ${
                    level === lv ? 'bg-[#E7F0DF] text-[#263B27]' : 'text-[#5C4B51]'
                  }`}
                >
                  {lv}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {analysis && (
              <button
                type="button"
                disabled={loading || !isOnline}
                onClick={() => runAnalysis(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFF6D6] hover:bg-[#F8E6A0] disabled:opacity-50 text-[#2B2226] text-xs font-bold min-h-[44px]"
              >
                <Lightbulb className="w-4 h-4" />
                <span>Explain It Simply</span>
              </button>
            )}

            <button
              type="button"
              disabled={loading || !text.trim() || !isOnline}
              onClick={() => runAnalysis(false)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#2B2226] hover:bg-[#3f3338] disabled:opacity-50 text-[#FFF8F0] text-sm font-semibold min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Lagi dicek & dibedah...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Analisis Sekarang</span>
                </>
              )}
            </button>
          </div>
        </div>

        {!isOnline && (
          <div className="p-3 rounded-2xl bg-[#FFF6D6] text-xs text-[#6B5416] flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>Kamu lagi offline nih. Analisis AI butuh koneksi internet ya!</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-2xl bg-[#FCE9ED] border border-[#F6C9D5] text-xs text-[#7B233B] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              disabled={loading || !isOnline || !text.trim()}
              onClick={() => runAnalysis(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#F6C9D5] text-xs font-bold text-[#2B2226] min-h-[34px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Coba Lagi</span>
            </button>
          </div>
        )}
      </div>

      {/* Loading Indicator Banner */}
      {loading && (
        <div className="p-6 rounded-3xl bg-[#FCE9ED]/70 border border-[#F6C9D5] flex items-center gap-3 text-sm font-semibold text-[#2B2226]">
          <Loader2 className="w-5 h-5 animate-spin shrink-0 text-[#A83B5A]" />
          <span>
            Sabar sebentar ya—PINDAMAI lagi memeriksa grammar, menerjemahkan seluruh kalimat satu per satu, dan menyiapkan analisis lengkapnya...
          </span>
        </div>
      )}

      {/* STRUCTURED LEARN RESULT (Sections A - F) */}
      {analysis && !loading && (
        <div className="space-y-6">
          {/* Tutor Intro Banner */}
          <div className="p-5 rounded-3xl bg-[#FFF6D6]/75 border border-[#F8E6A0] flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1 flex-1 min-w-[220px]">
              <span className="text-xs font-semibold text-[#6B5416]">
                Terdeteksi: {analysis.detectedLanguage.toUpperCase()} · Level: {level}
                {analysis.translation
                  ? ` · ${analysis.translation.translatedSentenceCount}/${analysis.translation.sourceSentenceCount} kalimat`
                  : ''}
              </span>
              <p className="text-sm font-semibold text-[#2B2226]">{analysis.introMessage}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                onPracticeFromText(
                  analysis.grammarCheck?.correctedText ||
                    analysis.normalizedWithHarakat ||
                    analysis.originalText,
                  fullOriginalTranslation.slice(0, 42)
                )
              }
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-[#2B2226] text-xs font-semibold text-[#FFF8F0] min-h-[42px]"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Learn From My Scan</span>
            </button>
          </div>

          {/* SECTION A: ORIGINAL TEXT */}
          <section className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#2B2226]">
                A. Original Text (Teks Asli Kamu)
              </h2>
              <AudioPlayerButton
                text={analysis.normalizedWithHarakat || analysis.originalText}
                lang={detectAudioLang(
                  analysis.normalizedWithHarakat || analysis.originalText,
                  analysis.detectedLanguage
                )}
                label="Listen Original"
                speechRate={settings.speechRate}
                tone="pink"
              />
            </div>

            <div className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2">
              <p
                dir="auto"
                className={`font-bold text-[#2B2226] whitespace-pre-wrap leading-relaxed ${
                  /[\u0600-\u06FF]/.test(analysis.originalText) ? 'font-arabic text-2xl leading-loose' : 'text-lg'
                }`}
              >
                {analysis.originalText}
              </p>
              {analysis.normalizedWithHarakat &&
                analysis.normalizedWithHarakat !== analysis.originalText && (
                  <div className="pt-2 border-t border-[#EADFD5] space-y-1">
                    <span className="text-[11px] font-semibold text-[#7B5D66] block">
                      Versi Berharakat Lengkap:
                    </span>
                    <p dir="rtl" className="font-arabic text-2xl font-bold text-[#2B2226] leading-loose">
                      {analysis.normalizedWithHarakat}
                    </p>
                  </div>
                )}
              {analysis.transliteration && (
                <p className="text-sm font-medium text-[#7B3449]">{analysis.transliteration}</p>
              )}
            </div>
          </section>

          {/* SECTION B: GRAMMAR CHECK & CORRECTION */}
          <section
            className={`p-6 rounded-3xl border space-y-4 ${
              hasGrammarErrors
                ? 'bg-[#FCE9ED]/65 border-[#F6C9D5]'
                : 'bg-[#E7F0DF]/55 border-[#C9DFC0]'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {hasGrammarErrors ? (
                  <AlertTriangle className="w-5 h-5 text-[#A83B5A] shrink-0" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-[#263B27] shrink-0" />
                )}
                <h2 className="font-display text-lg font-bold text-[#2B2226]">
                  B. Grammar Check & Koreksi
                </h2>
              </div>
              <span
                className={`text-xs font-bold ${
                  hasGrammarErrors ? 'text-[#7B233B]' : 'text-[#263B27]'
                }`}
              >
                {hasGrammarErrors
                  ? `${grammarErrorsList.filter((e) => !e.isStylisticOnly).length} Kesalahan Ditemukan`
                  : 'Grammar Aman!'}
              </span>
            </div>

            <p className="text-sm font-medium text-[#2B2226] bg-white/85 p-3.5 rounded-2xl border border-white">
              {analysis.grammarCheck?.statusMessage ||
                'Tidak ditemukan kesalahan tata bahasa yang signifikan pada teks ini.'}
            </p>

            {/* Corrected Complete Version when errors exist */}
            {hasGrammarErrors && analysis.grammarCheck?.correctedText && (
              <div className="p-4 rounded-2xl bg-white border border-[#C9DFC0] space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#263B27]">
                    Versi yang Sudah Diperbaiki (Corrected Version):
                  </span>
                  <AudioPlayerButton
                    text={analysis.grammarCheck.correctedText}
                    lang={detectAudioLang(
                      analysis.grammarCheck.correctedText,
                      analysis.detectedLanguage
                    )}
                    label="Listen Versi Benar"
                    speechRate={settings.speechRate}
                    compact
                    tone="green"
                  />
                </div>
                <p
                  dir="auto"
                  className={`font-bold text-[#1F2D21] whitespace-pre-wrap leading-relaxed ${
                    /[\u0600-\u06FF]/.test(analysis.grammarCheck.correctedText)
                      ? 'font-arabic text-2xl leading-loose'
                      : 'text-lg'
                  }`}
                >
                  {analysis.grammarCheck.correctedText}
                </p>
              </div>
            )}

            {/* Individual Detected Errors */}
            {grammarErrorsList.length > 0 && (
              <div className="space-y-3">
                {grammarErrorsList.map((errItem, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-white border border-[#EADFD5] space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-[#A83B5A]">
                        {errItem.isStylisticOnly ? 'Saran Gaya Bahasa (Opsional)' : 'Koreksi Grammar'} ·{' '}
                        {errItem.category}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-sm">
                      <div className="p-3 rounded-xl bg-[#FCE9ED]/60 border border-[#F6C9D5]">
                        <span className="text-[11px] font-semibold text-[#7B233B] block">
                          Kalimat Asli:
                        </span>
                        <p dir="auto" className="font-semibold text-[#2B2226] line-through decoration-[#A83B5A]/60">
                          {errItem.originalSentence}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-[#E7F0DF]/70 border border-[#C9DFC0]">
                        <span className="text-[11px] font-semibold text-[#263B27] block">
                          Kalimat Benar:
                        </span>
                        <p dir="auto" className="font-bold text-[#1F2D21]">
                          {errItem.correctedSentence}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-[#2B2226] leading-relaxed">
                      <strong>Kenapa keliru?</strong> {errItem.explanation}
                    </p>
                    <p className="text-xs text-[#5C4B51] leading-relaxed">
                      <strong>Kenapa ini tepat:</strong> {errItem.whyAppropriate}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* SECTION C: COMPLETE TRANSLATION */}
          <section className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#2B2226]">
                  C. Complete Translation (Terjemahan Lengkap)
                </h2>
                {analysis.translation && (
                  <p className="text-xs text-[#5C4B51]">
                    {analysis.translation.translatedSentenceCount} dari{' '}
                    {analysis.translation.sourceSentenceCount} kalimat diterjemahkan utuh sesuai urutan
                  </p>
                )}
              </div>
              <AudioPlayerButton
                text={fullOriginalTranslation}
                lang="id-ID"
                label="Listen Terjemahan"
                speechRate={settings.speechRate}
                tone="green"
              />
            </div>

            {analysis.translation?.unprocessedNotice && (
              <div className="p-3.5 rounded-2xl bg-[#FFF6D6] border border-[#F8E6A0] text-xs text-[#6B5416] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{analysis.translation.unprocessedNotice}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[#E7F0DF]/55 border border-[#C9DFC0] space-y-1.5">
              <span className="text-xs font-bold text-[#263B27] block">
                Terjemahan Lengkap Teks Asli:
              </span>
              <p className="text-base font-semibold text-[#1F2D21] leading-relaxed whitespace-pre-wrap">
                {fullOriginalTranslation}
              </p>
            </div>

            {hasGrammarErrors &&
              correctedTranslation &&
              correctedTranslation.trim() !== fullOriginalTranslation.trim() && (
                <div className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#7B3449]">
                      Terjemahan Versi yang Sudah Diperbaiki:
                    </span>
                    <AudioPlayerButton
                      text={correctedTranslation}
                      lang="id-ID"
                      label="Listen"
                      speechRate={settings.speechRate}
                      compact
                      tone="cream"
                    />
                  </div>
                  <p className="text-sm font-medium text-[#2B2226] leading-relaxed whitespace-pre-wrap">
                    {correctedTranslation}
                  </p>
                </div>
              )}

            {analysis.translation?.ambiguousExpressions &&
              analysis.translation.ambiguousExpressions.length > 0 && (
                <div className="p-4 rounded-2xl bg-[#FFF6D6]/75 border border-[#F8E6A0] space-y-2">
                  <span className="text-xs font-bold text-[#6B5416] block">
                    Catatan Ungkapan / Konteks Ambigu:
                  </span>
                  {analysis.translation.ambiguousExpressions.map((amb, i) => (
                    <p key={i} className="text-xs text-[#4C3D14]">
                      <strong>{amb.expression}:</strong> {amb.note}
                    </p>
                  ))}
                </div>
              )}
          </section>

          {/* SECTION D: VOCABULARY BREAKDOWN */}
          {((analysis.keyVocabulary || []).length > 0 || (analysis.wordByWord || []).length > 0) && (
            <section className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-5">
              <h2 className="font-display text-lg font-bold text-[#2B2226]">
                D. Vocabulary Breakdown (Kosakata & Arti Kontekstual)
              </h2>

              {(analysis.keyVocabulary || []).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(analysis.keyVocabulary || []).map((kv, idx) => {
                    const saved = isVocabSaved(kv);
                    const displayWord = kv.harakatOrOriginal || kv.word;
                    return (
                      <div
                        key={idx}
                        className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              dir="auto"
                              className={`font-bold text-xl text-[#2B2226] ${
                                /[\u0600-\u06FF]/.test(displayWord)
                                  ? 'font-arabic text-2xl'
                                  : 'font-display'
                              }`}
                            >
                              {displayWord}
                            </span>
                            <span className="text-xs text-[#7B5D66]">{kv.partOfSpeech}</span>
                          </div>
                          {kv.transliteration && (
                            <p className="text-xs text-[#7B3449]">{kv.transliteration}</p>
                          )}
                          <p className="text-sm font-bold text-[#2B2226]">
                            Arti: {kv.indonesian}
                            {kv.english ? ` · ${kv.english}` : ''}
                          </p>
                          {kv.contextualMeaning && (
                            <p className="text-xs text-[#263B27]">
                              <strong>Makna di konteks ini:</strong> {kv.contextualMeaning}
                            </p>
                          )}
                          <p className="text-xs text-[#5C4B51] leading-relaxed">{kv.explanation}</p>
                          {kv.exampleSentence && (
                            <p dir="auto" className="text-xs text-[#7B3449] bg-white p-2.5 rounded-xl border border-[#EADFD5]">
                              Contoh: {kv.exampleSentence}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          <AudioPlayerButton
                            text={displayWord}
                            lang={detectAudioLang(displayWord, analysis.detectedLanguage)}
                            label="Suara"
                            speechRate={settings.speechRate}
                            compact
                            tone="white"
                          />
                          <button
                            type="button"
                            disabled={saved}
                            onClick={() => handleSaveKeyVocab(kv)}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold min-h-[36px] ${
                              saved
                                ? 'bg-[#E7F0DF] text-[#263B27]'
                                : 'bg-[#F6C9D5] hover:bg-[#efbac8] text-[#2B2226]'
                            }`}
                          >
                            {saved ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                            <span>{saved ? 'Tersimpan' : 'Simpan'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {(analysis.wordByWord || []).length > 0 && (
                <div className="space-y-3 pt-2 border-t border-[#EADFD5]">
                  <h3 className="font-display text-sm font-bold text-[#5C4B51]">
                    Rincian Kata demi Kata (Word-by-Word)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(analysis.wordByWord || []).map((w, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            dir="auto"
                            className={`font-bold text-base text-[#2B2226] ${
                              /[\u0600-\u06FF]/.test(w.word) ? 'font-arabic text-xl' : 'font-display'
                            }`}
                          >
                            {w.word}
                          </span>
                          <AudioPlayerButton
                            text={w.word}
                            lang={detectAudioLang(w.word, analysis.detectedLanguage)}
                            label="Listen"
                            speechRate={settings.speechRate}
                            compact
                            tone="white"
                          />
                        </div>
                        <span className="text-[11px] text-[#7B5D66] block">{w.partOfSpeech}</span>
                        {w.transliteration && (
                          <p className="text-xs text-[#7B3449]">{w.transliteration}</p>
                        )}
                        <p className="text-sm font-semibold text-[#2B2226]">{w.meaning}</p>
                        {w.note && <p className="text-xs text-[#5C4B51]">{w.note}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* SECTION E: SENTENCE ANALYSIS */}
          <section className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
            <h2 className="font-display text-lg font-bold text-[#2B2226]">
              E. Sentence Analysis (Bedah Kalimat per Kalimat)
            </h2>

            {(analysis.sentenceAnalyses || []).length > 0 ? (
              <div className="space-y-4">
                {(analysis.sentenceAnalyses || []).map((sa, idx) => (
                  <div
                    key={idx}
                    className="p-4 sm:p-5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#7B3449]">
                        Kalimat {idx + 1} · {sa.language.toUpperCase()}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <AudioPlayerButton
                          text={sa.correctedSentence || sa.originalSentence}
                          lang={detectAudioLang(
                            sa.correctedSentence || sa.originalSentence,
                            sa.language
                          )}
                          label="Listen"
                          speechRate={settings.speechRate}
                          compact
                          tone="pink"
                        />
                        <AudioPlayerButton
                          text={sa.indonesianTranslation}
                          lang="id-ID"
                          label="Arti"
                          speechRate={settings.speechRate}
                          compact
                          tone="green"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p
                        dir="auto"
                        className={`font-bold text-[#2B2226] ${
                          /[\u0600-\u06FF]/.test(sa.originalSentence)
                            ? 'font-arabic text-2xl leading-loose'
                            : 'text-base'
                        }`}
                      >
                        {sa.originalSentence}
                      </p>
                      {sa.correctedSentence && sa.correctedSentence !== sa.originalSentence && (
                        <p dir="auto" className="text-sm font-semibold text-[#263B27] flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                          <span>Perbaikan: {sa.correctedSentence}</span>
                        </p>
                      )}
                      <p className="text-sm text-[#5C4B51]">{sa.indonesianTranslation}</p>
                    </div>

                    {/* English per-sentence breakdown */}
                    {sa.englishBreakdown &&
                      (sa.englishBreakdown.subject ||
                        sa.englishBreakdown.verb ||
                        sa.englishBreakdown.tense ||
                        sa.englishBreakdown.sentencePattern) && (
                        <div className="p-3.5 rounded-xl bg-white border border-[#EADFD5] space-y-2.5">
                          <span className="text-xs font-bold text-[#263B27] block">
                            Analisis Struktur English
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            {sa.englishBreakdown.subject && (
                              <div className="p-2.5 rounded-lg bg-[#FFF8F0]">
                                <span className="text-[#7B5D66] block">Subject</span>
                                <strong className="text-[#2B2226]">{sa.englishBreakdown.subject}</strong>
                              </div>
                            )}
                            {sa.englishBreakdown.verb && (
                              <div className="p-2.5 rounded-lg bg-[#FFF8F0]">
                                <span className="text-[#7B5D66] block">Verb</span>
                                <strong className="text-[#2B2226]">{sa.englishBreakdown.verb}</strong>
                              </div>
                            )}
                            {sa.englishBreakdown.object && (
                              <div className="p-2.5 rounded-lg bg-[#FFF8F0]">
                                <span className="text-[#7B5D66] block">Object</span>
                                <strong className="text-[#2B2226]">{sa.englishBreakdown.object}</strong>
                              </div>
                            )}
                            {sa.englishBreakdown.complementOrAdverbial && (
                              <div className="p-2.5 rounded-lg bg-[#FFF8F0]">
                                <span className="text-[#7B5D66] block">Complement / Adverbial</span>
                                <strong className="text-[#2B2226]">
                                  {sa.englishBreakdown.complementOrAdverbial}
                                </strong>
                              </div>
                            )}
                            {sa.englishBreakdown.tense && (
                              <div className="p-2.5 rounded-lg bg-[#E7F0DF]/70">
                                <span className="text-[#263B27] block">Tense</span>
                                <strong className="text-[#1F2D21]">{sa.englishBreakdown.tense}</strong>
                              </div>
                            )}
                            {sa.englishBreakdown.sentencePattern && (
                              <div className="p-2.5 rounded-lg bg-[#FCE9ED]/60">
                                <span className="text-[#7B3449] block">Sentence Pattern</span>
                                <strong className="text-[#2B2226]">
                                  {sa.englishBreakdown.sentencePattern}
                                </strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                    {/* Arabic per-sentence breakdown */}
                    {sa.arabicBreakdown &&
                      (sa.arabicBreakdown.nahwu ||
                        sa.arabicBreakdown.sharaf ||
                        sa.arabicBreakdown.irab ||
                        sa.arabicBreakdown.sentenceStructure) && (
                        <div className="p-3.5 rounded-xl bg-white border border-[#EADFD5] space-y-2 text-xs">
                          <span className="text-xs font-bold text-[#A83B5A] block">
                            Analisis Nahwu, Sharaf & Struktur Arab
                          </span>
                          {sa.arabicBreakdown.nahwu && (
                            <p className="text-[#2B2226] leading-relaxed">
                              <strong>Nahwu:</strong> {sa.arabicBreakdown.nahwu}
                            </p>
                          )}
                          {sa.arabicBreakdown.sharaf && (
                            <p className="text-[#2B2226] leading-relaxed">
                              <strong>Sharaf:</strong> {sa.arabicBreakdown.sharaf}
                            </p>
                          )}
                          {sa.arabicBreakdown.irab && (
                            <p className="text-[#2B2226] leading-relaxed">
                              <strong>I&apos;rab:</strong> {sa.arabicBreakdown.irab}
                            </p>
                          )}
                          {sa.arabicBreakdown.sentenceStructure && (
                            <p className="text-[#5C4B51] leading-relaxed">
                              <strong>Struktur:</strong> {sa.arabicBreakdown.sentenceStructure}
                            </p>
                          )}
                          {sa.arabicBreakdown.wordByWord && sa.arabicBreakdown.wordByWord.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {sa.arabicBreakdown.wordByWord.map((wb, wIdx) => (
                                <span
                                  key={wIdx}
                                  className="px-2.5 py-1 rounded-lg bg-[#FFF8F0] border border-[#EADFD5] text-[#2B2226]"
                                >
                                  <strong className="font-arabic text-sm">{wb.word}</strong> = {wb.meaning}
                                  {wb.role ? ` (${wb.role})` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback if opening older saved scan history without sentenceAnalyses */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {analysis.arabicGrammar && (
                  <div className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2 text-sm">
                    <h3 className="font-bold text-[#A83B5A]">Nahwu & Sharaf</h3>
                    {analysis.arabicGrammar.nahwuSummary && <p>{analysis.arabicGrammar.nahwuSummary}</p>}
                    {analysis.arabicGrammar.sharafSummary && <p>{analysis.arabicGrammar.sharafSummary}</p>}
                  </div>
                )}
                {analysis.englishGrammar && (
                  <div className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2 text-sm">
                    <h3 className="font-bold text-[#263B27]">English Grammar</h3>
                    {analysis.englishGrammar.tenseIdentification && (
                      <p>Tense: {analysis.englishGrammar.tenseIdentification}</p>
                    )}
                    {analysis.englishGrammar.grammarSummary && (
                      <p>{analysis.englishGrammar.grammarSummary}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* SECTION F: LEARN MORE & MINI QUIZ */}
          <section className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-5">
            <h2 className="font-display text-lg font-bold text-[#2B2226]">
              F. Learn More (Contoh Tambahan & Latihan Singkat)
            </h2>

            {(analysis.learnMore || []).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(analysis.learnMore || []).map((lm, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[#7B3449]">{lm.title}</span>
                      <AudioPlayerButton
                        text={lm.exampleTarget}
                        lang={detectAudioLang(lm.exampleTarget, analysis.detectedLanguage)}
                        label="Listen"
                        speechRate={settings.speechRate}
                        compact
                        tone="white"
                      />
                    </div>
                    <p
                      dir="auto"
                      className={`font-bold text-[#2B2226] ${
                        /[\u0600-\u06FF]/.test(lm.exampleTarget) ? 'font-arabic text-xl' : 'text-sm'
                      }`}
                    >
                      {lm.exampleTarget}
                    </p>
                    {lm.transliteration && (
                      <p className="text-xs text-[#7B3449]">{lm.transliteration}</p>
                    )}
                    <p className="text-xs font-semibold text-[#263B27]">{lm.indonesian}</p>
                    <p className="text-xs text-[#5C4B51]">{lm.simpleExplanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              (analysis.exampleSentences || []).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(analysis.exampleSentences || []).map((ex, i) => {
                    const main = ex.target || ex.arabic || ex.english || '';
                    return (
                      <div key={i} className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            dir="auto"
                            className={`font-semibold text-[#2B2226] ${
                              /[\u0600-\u06FF]/.test(main) ? 'font-arabic text-xl' : 'text-sm'
                            }`}
                          >
                            {main}
                          </p>
                          <AudioPlayerButton
                            text={main}
                            lang={detectAudioLang(main, analysis.detectedLanguage)}
                            label="Listen"
                            speechRate={settings.speechRate}
                            compact
                            tone="white"
                          />
                        </div>
                        {ex.transliteration && (
                          <p className="text-xs text-[#7B3449]">{ex.transliteration}</p>
                        )}
                        <p className="text-xs text-[#5C4B51]">{ex.indonesian}</p>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* Mini Exercises for multi-sentence / paragraph texts */}
            {analysis.paragraphBreakdown?.miniExercises &&
              analysis.paragraphBreakdown.miniExercises.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-[#EADFD5]">
                  <h3 className="font-display text-base font-bold text-[#2B2226]">
                    Mini Kuis Pemahaman
                  </h3>
                  {analysis.paragraphBreakdown.miniExercises.map((ex, qIdx) => {
                    const picked = miniAnswers[qIdx];
                    const hasPicked = typeof picked === 'number';
                    return (
                      <div key={qIdx} className="p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-3">
                        <p className="text-sm font-semibold text-[#2B2226]">
                          {qIdx + 1}. {ex.question}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(ex.options || []).map((opt, oIdx) => {
                            const isCorrect = oIdx === ex.correctIndex;
                            const isSelected = picked === oIdx;
                            let cls = 'bg-white border-[#EADFD5] text-[#2B2226]';
                            if (hasPicked) {
                              if (isCorrect) cls = 'bg-[#E7F0DF] border-[#3A6B3E] text-[#1F2D21]';
                              else if (isSelected) cls = 'bg-[#FCE9ED] border-[#A83B5A] text-[#7B233B]';
                            }
                            return (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => setMiniAnswers((prev) => ({ ...prev, [qIdx]: oIdx }))}
                                className={`text-left px-3.5 py-2.5 rounded-xl border text-xs font-medium min-h-[42px] ${cls}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                        {hasPicked && (
                          <p className="text-xs text-[#5C4B51] bg-[#FFF6D6]/70 p-3 rounded-xl">
                            {picked === ex.correctIndex ? 'Good job! ' : 'Belum tepat nih, tapi gapapa! '}
                            {ex.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
          </section>
        </div>
      )}
    </div>
  );
};
