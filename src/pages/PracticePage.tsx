import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  WifiOff,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  ArrowRight,
  Layers,
  ArrowLeft,
} from 'lucide-react';
import type {
  AppSettings,
  PracticeMode,
  PracticePayload,
  PracticeResultItem,
  ScanHistoryItem,
  VocabularyItem,
} from '../types/pindamai';
import { playFeedbackTone } from '../lib/speech';
import { AudioPlayerButton } from '../components/AudioPlayerButton';
import { apiRequest } from '../lib/apiClient';
import { formatSafeError } from '../lib/errorFormatter';
import practice3dImg from '../assets/images/practice_3d_quiz_1794619235141.jpg';
import words3dImg from '../assets/images/words_3d_collection_1794619235506.jpg';

interface PracticePageProps {
  vocabulary: VocabularyItem[];
  scanHistory: ScanHistoryItem[];
  practiceResults: PracticeResultItem[];
  settings: AppSettings;
  isOnline: boolean;
  initialScanText?: string;
  initialScanTitle?: string;
  onSavePracticeResult: (res: PracticeResultItem) => Promise<void>;
  onNavigateToScanner: () => void;
  onNotify: (msg: string) => void;
}

interface AnswerReviewItem {
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function detectLang(text: string): 'ar-SA' | 'en-US' {
  return /[\u0600-\u06FF]/.test(text) ? 'ar-SA' : 'en-US';
}

function validateAndNormalizePractice(raw: unknown, mode: PracticeMode): PracticePayload {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Partial<PracticePayload>;
  const introNote =
    typeof data.introNote === 'string' && data.introNote.trim()
      ? data.introNote.trim()
      : 'Yuk asah ingatan bahasamu bareng PINDAMAI! Pelan-pelan aja, yang penting paham.';

  if (mode === 'flashcards') {
    const flashcards = Array.isArray(data.flashcards)
      ? data.flashcards.filter(
          (c) => c && typeof c.front === 'string' && c.front.trim() && typeof c.back === 'string' && c.back.trim()
        )
      : [];
    if (flashcards.length === 0) {
      throw new Error('Kartu flashcard belum kebentuk nih. Yuk coba generate ulang!');
    }
    return { ...data, mode, introNote, flashcards };
  }

  if (mode === 'multiple_choice' || mode === 'summary') {
    const multipleChoice = Array.isArray(data.multipleChoice)
      ? data.multipleChoice
          .filter(
            (q) =>
              q &&
              typeof q.question === 'string' &&
              q.question.trim() &&
              Array.isArray(q.options) &&
              q.options.filter((o) => typeof o === 'string' && o.trim()).length >= 2
          )
          .map((q) => {
            const cleanOpts = q.options.filter((o) => typeof o === 'string' && o.trim());
            const safeIdx =
              typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex < cleanOpts.length
                ? q.correctIndex
                : 0;
            return {
              question: q.question.trim(),
              promptWord: typeof q.promptWord === 'string' ? q.promptWord : undefined,
              options: cleanOpts,
              correctIndex: safeIdx,
              explanation:
                typeof q.explanation === 'string' && q.explanation.trim()
                  ? q.explanation
                  : `Jawaban yang tepat adalah "${cleanOpts[safeIdx]}".`,
            };
          })
      : [];

    if (multipleChoice.length === 0 && mode === 'multiple_choice') {
      throw new Error('Soal pilihan ganda gagal diracik. Klik Coba Lagi buat racik ulang ya!');
    }
    if (mode === 'summary' && !data.summaryText && multipleChoice.length === 0) {
      throw new Error('Ringkasan belum berhasil dibuat. Yuk coba generate ulang!');
    }
    return {
      ...data,
      mode,
      introNote,
      summaryText: typeof data.summaryText === 'string' ? data.summaryText : '',
      keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
      multipleChoice,
    };
  }

  if (mode === 'match') {
    const matchPairs = Array.isArray(data.matchPairs)
      ? data.matchPairs
          .filter(
            (p) => p && typeof p.left === 'string' && p.left.trim() && typeof p.right === 'string' && p.right.trim()
          )
          .map((p, idx) => ({
            id: typeof p.id === 'string' && p.id.trim() ? `${p.id}-${idx}` : `pair-${idx}`,
            left: p.left.trim(),
            right: p.right.trim(),
            note: typeof p.note === 'string' ? p.note : undefined,
          }))
      : [];
    if (matchPairs.length < 2) {
      throw new Error('Pasangan kata belum cukup buat dicocokkan. Yuk coba lagi!');
    }
    return { ...data, mode, introNote, matchPairs };
  }

  if (mode === 'fill_blank') {
    const fillBlanks = Array.isArray(data.fillBlanks)
      ? data.fillBlanks
          .filter(
            (fb) =>
              fb &&
              typeof fb.sentenceWithBlank === 'string' &&
              fb.sentenceWithBlank.trim() &&
              typeof fb.answer === 'string' &&
              fb.answer.trim() &&
              Array.isArray(fb.options) &&
              fb.options.filter((o) => typeof o === 'string' && o.trim()).length >= 2
          )
          .map((fb) => {
            const opts = fb.options.filter((o) => typeof o === 'string' && o.trim());
            if (!opts.some((o) => o.trim() === fb.answer.trim())) {
              opts[0] = fb.answer.trim();
            }
            return {
              sentenceWithBlank: fb.sentenceWithBlank.trim(),
              translationHint: typeof fb.translationHint === 'string' ? fb.translationHint : '',
              options: opts,
              answer: fb.answer.trim(),
              explanation:
                typeof fb.explanation === 'string' && fb.explanation.trim()
                  ? fb.explanation
                  : `Kata yang paling pas melengkapi kalimat ini adalah "${fb.answer.trim()}".`,
            };
          })
      : [];
    if (fillBlanks.length === 0) {
      throw new Error('Soal melengkapi kalimat belum siap. Klik Coba Lagi ya!');
    }
    return { ...data, mode, introNote, fillBlanks };
  }

  if (mode === 'translate_sentence') {
    const translateSentences = Array.isArray(data.translateSentences)
      ? data.translateSentences
          .filter(
            (tr) =>
              tr &&
              typeof tr.sourceSentence === 'string' &&
              tr.sourceSentence.trim() &&
              typeof tr.referenceTranslation === 'string' &&
              tr.referenceTranslation.trim()
          )
          .map((tr) => ({
            sourceSentence: tr.sourceSentence.trim(),
            sourceLanguage: typeof tr.sourceLanguage === 'string' ? tr.sourceLanguage : 'Arab/Inggris',
            targetLanguage: typeof tr.targetLanguage === 'string' ? tr.targetLanguage : 'Indonesia',
            referenceTranslation: tr.referenceTranslation.trim(),
            acceptableKeywords: Array.isArray(tr.acceptableKeywords)
              ? tr.acceptableKeywords.filter((k) => typeof k === 'string' && k.trim())
              : [],
            explanation:
              typeof tr.explanation === 'string' && tr.explanation.trim()
                ? tr.explanation
                : `Terjemahan naturalnya: "${tr.referenceTranslation.trim()}".`,
          }))
      : [];
    if (translateSentences.length === 0) {
      throw new Error('Soal terjemahan kalimat belum terbentuk. Klik Coba Lagi ya!');
    }
    return { ...data, mode, introNote, translateSentences };
  }

  if (mode === 'arrange_words') {
    const arrangeWords = Array.isArray(data.arrangeWords)
      ? data.arrangeWords
          .filter(
            (aw) =>
              aw &&
              typeof aw.promptIndonesian === 'string' &&
              aw.promptIndonesian.trim() &&
              typeof aw.targetSentence === 'string' &&
              aw.targetSentence.trim()
          )
          .map((aw) => {
            const rawTokens = Array.isArray(aw.tokens)
              ? aw.tokens.filter((t) => typeof t === 'string' && t.trim())
              : [];
            const tokens =
              rawTokens.length >= 2
                ? rawTokens
                : aw.targetSentence
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean);
            return {
              promptIndonesian: aw.promptIndonesian.trim(),
              targetSentence: aw.targetSentence.trim(),
              tokens,
              language:
                aw.language === 'arabic' || /[\u0600-\u06FF]/.test(aw.targetSentence)
                  ? 'arabic'
                  : 'english',
              explanation:
                typeof aw.explanation === 'string' && aw.explanation.trim()
                  ? aw.explanation
                  : `Susunan kalimat yang tepat: "${aw.targetSentence.trim()}".`,
            };
          })
          .filter((aw) => aw.tokens.length >= 2)
      : [];

    if (arrangeWords.length === 0) {
      throw new Error('Soal susun kata belum terbentuk sempurna. Yuk coba lagi!');
    }
    return { ...data, mode, introNote, arrangeWords };
  }

  throw new Error('Mode latihan tidak dikenali.');
}

export const PracticePage: React.FC<PracticePageProps> = ({
  vocabulary,
  scanHistory,
  practiceResults,
  settings,
  isOnline,
  initialScanText,
  initialScanTitle,
  onSavePracticeResult,
  onNavigateToScanner,
  onNotify,
}) => {
  const [sourceKind, setSourceKind] = useState<'vocab' | 'scan'>(
    initialScanText ? 'scan' : vocabulary.length > 0 ? 'vocab' : 'scan'
  );
  const [selectedScanId, setSelectedScanId] = useState<string>('');
  const [customScanText, setCustomScanText] = useState(initialScanText || '');
  const [sourceTitle, setSourceTitle] = useState(initialScanTitle || 'Latihan PINDAMAI');

  // Category & language filters for quiz setup
  const [quizCategory, setQuizCategory] = useState<string>('all');
  const [quizLanguage, setQuizLanguage] = useState<'all' | 'arabic' | 'english'>('all');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<PracticePayload | null>(null);
  const lastAttemptRef = useRef<{ mode: PracticeMode; count: number } | null>(null);

  // Interactive runner state
  const [stepIdx, setStepIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answerHistory, setAnswerHistory] = useState<AnswerReviewItem[]>([]);

  // Multiple choice & Fill blank state
  const [pickedOption, setPickedOption] = useState<number | null>(null);
  const [pickedWord, setPickedWord] = useState<string | null>(null);

  // Flashcards state
  const [flipped, setFlipped] = useState(false);

  // Match the words state
  const [shuffledRight, setShuffledRight] = useState<Array<{ id: string; right: string }>>([]);
  const [selectedLeftId, setSelectedLeftId] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [matchErrorMsg, setMatchErrorMsg] = useState<string | null>(null);

  // Translate sentence state
  const [translationInput, setTranslationInput] = useState('');
  const [translationChecked, setTranslationChecked] = useState(false);
  const [translationCorrect, setTranslationCorrect] = useState(false);

  // Arrange words state
  const [availableTokens, setAvailableTokens] = useState<Array<{ key: string; text: string }>>([]);
  const [chosenTokens, setChosenTokens] = useState<Array<{ key: string; text: string }>>([]);
  const [arrangeChecked, setArrangeChecked] = useState(false);
  const [arrangeCorrect, setArrangeCorrect] = useState(false);

  useEffect(() => {
    if (initialScanText) {
      setSourceKind('scan');
      setCustomScanText(initialScanText);
      setSourceTitle(initialScanTitle || 'Dari Scan Kamu');
    }
  }, [initialScanText, initialScanTitle]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    vocabulary.forEach((v) => {
      if (v.category?.trim()) set.add(v.category.trim());
    });
    return ['all', ...Array.from(set)];
  }, [vocabulary]);

  const filteredVocabulary = useMemo(() => {
    return vocabulary.filter((v) => {
      if (quizCategory !== 'all' && v.category !== quizCategory) return false;
      if (quizLanguage === 'arabic' && !v.arabicWord) return false;
      if (quizLanguage === 'english' && !v.englishWord) return false;
      return true;
    });
  }, [vocabulary, quizCategory, quizLanguage]);

  const activeScanText = useMemo(() => {
    if (selectedScanId) {
      const found = scanHistory.find((s) => s.id === selectedScanId);
      if (found) {
        return found.rawText || found.summary || found.title;
      }
    }
    return customScanText;
  }, [selectedScanId, scanHistory, customScanText]);

  const initStepState = (payload: PracticePayload, nextIdx: number) => {
    setPickedOption(null);
    setPickedWord(null);
    setFlipped(false);
    setTranslationInput('');
    setTranslationChecked(false);
    setArrangeChecked(false);

    if (payload.mode === 'match' && payload.matchPairs) {
      setShuffledRight(
        shuffleArray(payload.matchPairs.map((p) => ({ id: p.id, right: p.right })))
      );
      setSelectedLeftId(null);
      setMatchedIds([]);
      setMatchErrorMsg(null);
    }

    if (payload.mode === 'arrange_words' && payload.arrangeWords?.[nextIdx]) {
      const tokens = payload.arrangeWords[nextIdx].tokens.map((t, i) => ({
        key: `${nextIdx}-${i}-${t}`,
        text: t,
      }));
      setAvailableTokens(shuffleArray(tokens));
      setChosenTokens([]);
    }
  };

  const resetToSetup = () => {
    setSession(null);
    setFinished(false);
    setError(null);
    setAnswerHistory([]);
    setStepIdx(0);
    setScore(0);
  };

  const startPractice = async (mode: PracticeMode, count = 5) => {
    lastAttemptRef.current = { mode, count };

    if (!isOnline) {
      setError('Bikin soal latihan AI butuh koneksi internet ya! Cek sinyalmu dulu.');
      return;
    }

    const vocabPayload = filteredVocabulary.map((v) => ({
      arabic: quizLanguage === 'english' ? undefined : v.arabicWord,
      transliteration: quizLanguage === 'english' ? undefined : v.arabicTransliteration,
      english: quizLanguage === 'arabic' ? undefined : v.englishWord,
      indonesian: v.indonesianMeaning,
    }));

    if (sourceKind === 'vocab' && vocabPayload.length === 0) {
      setError(
        vocabulary.length === 0
          ? 'My Words kamu masih kosong nih! Scan dulu atau pilih tab "Learn From My Scan".'
          : 'Tidak ada kosakata yang cocok dengan filter kategori & bahasa yang kamu pilih.'
      );
      return;
    }
    if (sourceKind === 'scan' && !activeScanText.trim()) {
      setError('Pilih riwayat scan atau tempel teks dulu buat dijadiin bahan latihan!');
      return;
    }

    setLoading(true);
    setError(null);
    setSession(null);
    setFinished(false);
    setStepIdx(0);
    setScore(0);
    setAnswerHistory([]);

    try {
      const data = await apiRequest<PracticePayload>('/api/ai/generate-practice', {
        method: 'POST',
        body: {
          mode,
          count,
          sourceText: sourceKind === 'scan' ? activeScanText.trim() : undefined,
          vocabularyList: sourceKind === 'vocab' ? vocabPayload : [],
          category: quizCategory,
          targetLanguage: quizLanguage,
        },
        timeoutMs: 55000,
      });

      const normalized = validateAndNormalizePractice(data, mode);
      setSession(normalized);
      initStepState(normalized, 0);
    } catch (err) {
      const msg = formatSafeError(err, 'Waduh, gagal bikin latihan. Coba lagi sebentar ya!');
      setError(msg);
      onNotify(msg);
    } finally {
      setLoading(false);
    }
  };

  const getTotalSteps = (s: PracticePayload | null): number => {
    if (!s) return 0;
    if (s.mode === 'flashcards') return s.flashcards?.length || 0;
    if (s.mode === 'multiple_choice' || s.mode === 'summary') return s.multipleChoice?.length || 0;
    if (s.mode === 'match') return s.matchPairs?.length || 0;
    if (s.mode === 'fill_blank') return s.fillBlanks?.length || 0;
    if (s.mode === 'translate_sentence') return s.translateSentences?.length || 0;
    if (s.mode === 'arrange_words') return s.arrangeWords?.length || 0;
    return 0;
  };

  const totalSteps = getTotalSteps(session);

  const finishSession = async (
    finalScore: number,
    total: number,
    historyOverride?: AnswerReviewItem[]
  ) => {
    if (historyOverride) {
      setAnswerHistory(historyOverride);
    }
    setFinished(true);
    if (session) {
      await onSavePracticeResult({
        id: `prac-${Date.now()}`,
        mode: session.mode,
        score: finalScore,
        total,
        sourceTitle:
          sourceKind === 'vocab' && quizCategory !== 'all'
            ? `${sourceTitle} (${quizCategory})`
            : sourceTitle,
        createdAt: Date.now(),
      });
    }
  };

  const handleNextStep = async (currentScore = score) => {
    if (!session) return;
    if (stepIdx + 1 >= totalSteps) {
      await finishSession(currentScore, totalSteps);
    } else {
      const next = stepIdx + 1;
      setStepIdx(next);
      initStepState(session, next);
    }
  };

  // Match handler
  const handlePickRight = async (rightItem: { id: string; right: string }) => {
    if (!selectedLeftId || !session?.matchPairs) return;
    const leftPair = session.matchPairs.find((p) => p.id === selectedLeftId);
    if (!leftPair) return;

    if (selectedLeftId === rightItem.id) {
      const nextMatched = [...matchedIds, rightItem.id];
      setMatchedIds(nextMatched);
      setSelectedLeftId(null);
      setMatchErrorMsg(null);
      const nextScore = score + 1;
      setScore(nextScore);
      const nextHistory = [
        ...answerHistory,
        {
          prompt: leftPair.left,
          userAnswer: rightItem.right,
          correctAnswer: leftPair.right,
          isCorrect: true,
          explanation: leftPair.note || `"${leftPair.left}" artinya "${leftPair.right}".`,
        },
      ];
      setAnswerHistory(nextHistory);
      playFeedbackTone('success', settings.soundEffectsEnabled);
      if (nextMatched.length >= session.matchPairs.length) {
        await finishSession(nextScore, session.matchPairs.length, nextHistory);
      }
    } else {
      playFeedbackTone('oops', settings.soundEffectsEnabled);
      setMatchErrorMsg('Belum cocok nih pasangannya, tapi gapapa! Coba cek lagi ya.');
      setSelectedLeftId(null);
    }
  };

  // Translate check
  const handleCheckTranslation = () => {
    if (!session?.translateSentences?.[stepIdx]) return;
    const item = session.translateSentences[stepIdx];
    const cleanInput = translationInput.trim().toLowerCase();
    const keywords = item.acceptableKeywords || [];
    const hitCount = keywords.filter((kw) => cleanInput.includes(kw.toLowerCase())).length;
    const isOk =
      cleanInput === item.referenceTranslation.trim().toLowerCase() ||
      (keywords.length > 0 && hitCount >= Math.max(1, Math.ceil(keywords.length * 0.5)));

    setTranslationChecked(true);
    setTranslationCorrect(isOk);
    setAnswerHistory((prev) => [
      ...prev,
      {
        prompt: item.sourceSentence,
        userAnswer: translationInput.trim(),
        correctAnswer: item.referenceTranslation,
        isCorrect: isOk,
        explanation: item.explanation,
      },
    ]);
    if (isOk) {
      setScore((s) => s + 1);
      playFeedbackTone('success', settings.soundEffectsEnabled);
    } else {
      playFeedbackTone('oops', settings.soundEffectsEnabled);
    }
  };

  // Arrange words check
  const handleCheckArrange = () => {
    if (!session?.arrangeWords?.[stepIdx]) return;
    const item = session.arrangeWords[stepIdx];
    const built = chosenTokens.map((t) => t.text).join(' ').trim();
    const target = item.tokens.join(' ').trim();
    const isOk = built === target || built.toLowerCase() === item.targetSentence.trim().toLowerCase();

    setArrangeChecked(true);
    setArrangeCorrect(isOk);
    setAnswerHistory((prev) => [
      ...prev,
      {
        prompt: item.promptIndonesian,
        userAnswer: built,
        correctAnswer: item.targetSentence,
        isCorrect: isOk,
        explanation: item.explanation,
      },
    ]);
    if (isOk) {
      setScore((s) => s + 1);
      playFeedbackTone('success', settings.soundEffectsEnabled);
    } else {
      playFeedbackTone('oops', settings.soundEffectsEnabled);
    }
  };

  const hasValidActiveItem = useMemo(() => {
    if (!session) return false;
    if (session.mode === 'summary' && session.summaryText && (!session.multipleChoice || session.multipleChoice.length === 0)) {
      return true;
    }
    if (session.mode === 'flashcards') return Boolean(session.flashcards?.[stepIdx]);
    if (session.mode === 'multiple_choice' || session.mode === 'summary') {
      return Boolean(session.multipleChoice?.[stepIdx]);
    }
    if (session.mode === 'match') return Boolean(session.matchPairs?.length);
    if (session.mode === 'fill_blank') return Boolean(session.fillBlanks?.[stepIdx]);
    if (session.mode === 'translate_sentence') return Boolean(session.translateSentences?.[stepIdx]);
    if (session.mode === 'arrange_words') return Boolean(session.arrangeWords?.[stepIdx]);
    return false;
  }, [session, stepIdx]);

  return (
    <div className="space-y-6">
      {/* Friendly Intro Header */}
      <div className="rounded-3xl bg-white border border-[#EADFD5] p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        <div className="md:col-span-8 space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B2226]">
            Practice & Kuis Seru
          </h1>
          <p className="text-sm text-[#5C4B51] leading-relaxed max-w-xl">
            Pilih kategori dan bahasa favoritmu, lalu uji ingatan kosakata Arab & Inggris lewat 5 mode kuis interaktif langsung dari My Words atau hasil scan!
          </p>
        </div>
        <div className="md:col-span-4 flex justify-center md:justify-end">
          <img
            src={practice3dImg}
            alt="Ilustrasi kuis dan kartu latihan PINDAMAI"
            referrerPolicy="no-referrer"
            className="w-full max-w-[200px] aspect-[16/10] object-cover rounded-2xl border border-[#EADFD5]"
          />
        </div>
      </div>

      {/* Setup / Generator Area when no active session */}
      {!session && (
        <div className="space-y-6">
          {/* Source + Category + Language Selector */}
          <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-display text-base font-bold text-[#2B2226]">
                1. Pilih Bahan, Kategori & Bahasa
              </span>
              <div className="inline-flex p-1 rounded-xl bg-[#FFF8F0] border border-[#EADFD5]">
                <button
                  type="button"
                  onClick={() => {
                    setSourceKind('vocab');
                    setSourceTitle('Kosakata My Words');
                    setError(null);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] ${
                    sourceKind === 'vocab' ? 'bg-[#FCE9ED] text-[#2B2226]' : 'text-[#5C4B51]'
                  }`}
                >
                  Dari My Words ({vocabulary.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSourceKind('scan');
                    setError(null);
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold min-h-[38px] ${
                    sourceKind === 'scan' ? 'bg-[#E7F0DF] text-[#263B27]' : 'text-[#5C4B51]'
                  }`}
                >
                  Learn From My Scan
                </button>
              </div>
            </div>

            {/* Category & Language Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#7B5D66] block">
                  Bahasa Target Kuis
                </label>
                <div className="grid grid-cols-3 p-1 rounded-xl bg-[#FFF8F0] border border-[#EADFD5]">
                  {(
                    [
                      { id: 'all', label: 'Arab & EN' },
                      { id: 'arabic', label: 'Bahasa Arab' },
                      { id: 'english', label: 'English' },
                    ] as const
                  ).map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setQuizLanguage(l.id)}
                      className={`px-2.5 py-2 rounded-lg text-xs font-semibold min-h-[36px] ${
                        quizLanguage === l.id
                          ? 'bg-[#FCE9ED] text-[#2B2226]'
                          : 'text-[#5C4B51] hover:text-[#2B2226]'
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="practice-category-select"
                  className="text-xs font-semibold text-[#7B5D66] block"
                >
                  Kategori Kosakata
                </label>
                <select
                  id="practice-category-select"
                  value={quizCategory}
                  onChange={(e) => setQuizCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#FFF8F0] border border-[#EADFD5] text-sm font-medium text-[#2B2226] min-h-[44px]"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'Semua Kategori' : cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sourceKind === 'vocab' ? (
              filteredVocabulary.length === 0 ? (
                <div className="p-5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] flex flex-col sm:flex-row items-center gap-4">
                  <img
                    src={words3dImg}
                    alt="Koleksi kosakata kosong"
                    referrerPolicy="no-referrer"
                    className="w-24 h-16 object-cover rounded-xl shrink-0 border border-[#EADFD5]"
                  />
                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <p className="font-display font-bold text-sm text-[#2B2226]">
                      {vocabulary.length === 0
                        ? 'My Words kamu masih kosong nih!'
                        : 'Belum ada kosakata yang cocok sama filter di atas'}
                    </p>
                    <p className="text-xs text-[#5C4B51]">
                      {vocabulary.length === 0
                        ? 'Yuk scan benda atau teks dulu, atau langsung pakai tab Learn From My Scan!'
                        : 'Ubah kategori/bahasa ke Semua, atau scan kosakata baru sekarang.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSourceKind('scan')}
                      className="px-3.5 py-2 rounded-xl bg-[#E7F0DF] text-xs font-semibold text-[#263B27] min-h-[40px]"
                    >
                      Pakai Teks Scan
                    </button>
                    <button
                      type="button"
                      onClick={onNavigateToScanner}
                      className="px-4 py-2 rounded-xl bg-[#F6C9D5] text-xs font-semibold text-[#2B2226] min-h-[40px]"
                    >
                      Ke Scanner
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#5C4B51]">
                  Siap! Kita bakal ngeracik soal dari{' '}
                  <strong>{filteredVocabulary.length} kosakata</strong> yang sesuai filter kamu.
                </p>
              )
            ) : (
              <div className="space-y-3">
                {scanHistory.length > 0 && (
                  <select
                    value={selectedScanId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedScanId(id);
                      const found = scanHistory.find((s) => s.id === id);
                      if (found) setSourceTitle(found.title);
                    }}
                    aria-label="Pilih dari riwayat scan"
                    className="w-full px-4 py-3 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] text-sm"
                  >
                    <option value="">-- Atau pilih dari riwayat scan kamu --</option>
                    {scanHistory.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.type === 'object' ? '[Objek]' : '[Teks]'} {s.title}
                      </option>
                    ))}
                  </select>
                )}

                <textarea
                  rows={3}
                  dir="auto"
                  value={selectedScanId ? activeScanText : customScanText}
                  onChange={(e) => {
                    setSelectedScanId('');
                    setCustomScanText(e.target.value);
                    setSourceTitle('Custom Scan Text');
                  }}
                  placeholder="Tempel teks hasil scan atau kalimat Arab/Inggris apa saja di sini..."
                  className="w-full p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] text-sm focus:outline-none focus:border-[#A83B5A]"
                />
              </div>
            )}

            {!isOnline && (
              <div className="p-3 rounded-2xl bg-[#FFF6D6] text-xs text-[#6B5416] flex items-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0" />
                <span>Generate latihan AI butuh internet ya.</span>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-2xl bg-[#FCE9ED] border border-[#F6C9D5] text-xs text-[#7B233B] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {lastAttemptRef.current && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      lastAttemptRef.current &&
                      startPractice(lastAttemptRef.current.mode, lastAttemptRef.current.count)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-[#F6C9D5] text-xs font-bold text-[#2B2226] min-h-[36px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Coba Lagi</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {loading && (
            <div className="p-6 rounded-3xl bg-[#FCE9ED] border border-[#F6C9D5] flex items-center gap-3 text-sm font-semibold text-[#2B2226]">
              <Loader2 className="w-5 h-5 animate-spin shrink-0" />
              <span>Bentar ya, PINDAMAI lagi ngeracik soal spesial buat kamu...</span>
            </div>
          )}

          {/* 5 Core Exercise Modes */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[#2B2226]">
              2. Pilih Jenis Latihan Interaktif
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(
                [
                  {
                    mode: 'multiple_choice',
                    title: 'Multiple Choice',
                    desc: 'Pilih jawaban paling pas dari 4 opsi (5 soal seru).',
                    bg: 'bg-[#FCE9ED] border-[#F6C9D5]',
                  },
                  {
                    mode: 'match',
                    title: 'Match the Words',
                    desc: 'Cocokkan kata Arab/Inggris dengan arti Indonesianya.',
                    bg: 'bg-[#E7F0DF] border-[#C9DFC0]',
                  },
                  {
                    mode: 'fill_blank',
                    title: 'Fill in the Blanks',
                    desc: 'Lengkapi bagian kalimat yang bolong dengan kata tepat.',
                    bg: 'bg-[#FFF6D6] border-[#F8E6A0]',
                  },
                  {
                    mode: 'translate_sentence',
                    title: 'Translate the Sentence',
                    desc: 'Latihan menerjemahkan kalimat lalu cek kata kuncinya.',
                    bg: 'bg-white border-[#EADFD5]',
                  },
                  {
                    mode: 'arrange_words',
                    title: 'Arrange the Words',
                    desc: 'Susun potongan kata acak jadi kalimat utuh yang benar.',
                    bg: 'bg-white border-[#EADFD5]',
                  },
                ] as const
              ).map((card) => (
                <button
                  key={card.mode}
                  type="button"
                  disabled={loading}
                  onClick={() => startPractice(card.mode, 5)}
                  className={`text-left p-5 rounded-3xl border ${card.bg} hover:opacity-95 disabled:opacity-60 transition-opacity space-y-2 flex flex-col justify-between min-h-[130px]`}
                >
                  <div className="space-y-1">
                    <h3 className="font-display font-bold text-base text-[#2B2226]">{card.title}</h3>
                    <p className="text-xs text-[#5C4B51] leading-relaxed">{card.desc}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2B2226] pt-2">
                    {loading && lastAttemptRef.current?.mode === card.mode ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Mulai Sekarang</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Learn From My Scan Quick Actions */}
          <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-3">
            <h2 className="font-display text-base font-bold text-[#2B2226]">
              Paket Cepat "Learn From My Scan"
            </h2>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => startPractice('flashcards', 5)}
                className="px-4 py-2.5 rounded-2xl bg-[#FCE9ED] hover:bg-[#F6C9D5] disabled:opacity-60 text-xs font-semibold text-[#2B2226] min-h-[42px]"
              >
                5 Flashcards
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => startPractice('multiple_choice', 5)}
                className="px-4 py-2.5 rounded-2xl bg-[#E7F0DF] hover:bg-[#d7e8ca] disabled:opacity-60 text-xs font-semibold text-[#263B27] min-h-[42px]"
              >
                5 Quiz Questions
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => startPractice('translate_sentence', 4)}
                className="px-4 py-2.5 rounded-2xl bg-[#FFF6D6] hover:bg-[#F8E6A0] disabled:opacity-60 text-xs font-semibold text-[#2B2226] min-h-[42px]"
              >
                Translation Exercises
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => startPractice('match', 5)}
                className="px-4 py-2.5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] hover:bg-[#FCE9ED] disabled:opacity-60 text-xs font-semibold text-[#2B2226] min-h-[42px]"
              >
                Vocabulary Exercises
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => startPractice('summary', 3)}
                className="px-4 py-2.5 rounded-2xl bg-[#2B2226] disabled:opacity-60 text-xs font-semibold text-[#FFF8F0] min-h-[42px]"
              >
                Short Summary
              </button>
            </div>
          </div>

          {/* Recent Practice Results */}
          {practiceResults.length > 0 && (
            <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-3">
              <h2 className="font-display text-base font-bold text-[#2B2226]">Skor Terakhir</h2>
              <div className="divide-y divide-[#EADFD5]">
                {practiceResults.slice(0, 5).map((r) => (
                  <div key={r.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#2B2226] truncate">{r.sourceTitle}</p>
                      <p className="text-xs text-[#7B5D66]">
                        {r.mode.replace('_', ' ')} · {new Date(r.createdAt).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                    <span className="font-display font-bold text-[#263B27] tabular-nums shrink-0">
                      {r.score} / {r.total}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ACTIVE PRACTICE RUNNER */}
      {session && !finished && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#EADFD5] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-[#7B5D66] uppercase tracking-wide">
                {session.mode.replace('_', ' ')}
              </span>
              <p className="text-sm font-medium text-[#2B2226]">{session.introNote}</p>
            </div>
            <button
              type="button"
              onClick={resetToSetup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FFF8F0] border border-[#EADFD5] text-xs font-semibold text-[#5C4B51] min-h-[38px]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Practice</span>
            </button>
          </div>

          {!hasValidActiveItem ? (
            <div className="p-6 rounded-2xl bg-[#FCE9ED]/60 border border-[#F6C9D5] text-center space-y-3">
              <p className="font-display font-bold text-[#2B2226]">
                Oops, soal pada langkah ini tidak ditemukan!
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => startPractice(session.mode, totalSteps || 5)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2B2226] text-xs font-semibold text-[#FFF8F0] min-h-[40px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Coba Lagi</span>
                </button>
                <button
                  type="button"
                  onClick={resetToSetup}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#EADFD5] text-xs font-semibold text-[#2B2226] min-h-[40px]"
                >
                  Kembali ke Practice
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Summary block if summary mode */}
              {session.mode === 'summary' && session.summaryText && (
                <div className="p-5 rounded-2xl bg-[#FFF6D6]/75 border border-[#F8E6A0] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display font-bold text-[#2B2226]">Ringkasan Singkat</h3>
                    <AudioPlayerButton
                      text={session.summaryText}
                      lang="id-ID"
                      label="Dengar Ringkasan"
                      speechRate={settings.speechRate}
                      compact
                      tone="cream"
                    />
                  </div>
                  <p className="text-sm text-[#2B2226] leading-relaxed">{session.summaryText}</p>
                  {session.keyPoints && session.keyPoints.length > 0 && (
                    <ul className="list-disc pl-5 text-xs text-[#5C4B51] space-y-1">
                      {session.keyPoints.map((kp, i) => (
                        <li key={i}>{kp}</li>
                      ))}
                    </ul>
                  )}
                  {(!session.multipleChoice || session.multipleChoice.length === 0) && (
                    <button
                      type="button"
                      onClick={() => finishSession(1, 1)}
                      className="px-5 py-2.5 rounded-2xl bg-[#2B2226] text-xs font-semibold text-[#FFF8F0] min-h-[40px]"
                    >
                      Selesai Membaca
                    </button>
                  )}
                </div>
              )}

              {/* Progress bar */}
              {totalSteps > 0 && session.mode !== 'match' && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-[#7B5D66] tabular-nums">
                    <span>
                      Item {stepIdx + 1} dari {totalSteps}
                    </span>
                    <span>Skor: {score}</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-[#FCE9ED] overflow-hidden">
                    <div
                      className="h-full bg-[#A83B5A] transition-all duration-200"
                      style={{ width: `${Math.round(((stepIdx + 1) / totalSteps) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 1. FLASHCARDS */}
              {session.mode === 'flashcards' && session.flashcards?.[stepIdx] && (() => {
                const card = session.flashcards[stepIdx];
                return (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setFlipped((f) => !f)}
                      className="w-full min-h-[220px] p-8 rounded-3xl bg-[#FFF8F0] border border-[#EADFD5] flex flex-col items-center justify-center text-center gap-3 hover:border-[#F6C9D5] transition-colors"
                    >
                      <span className="text-xs font-semibold text-[#7B5D66]">
                        {flipped ? 'Arti & Penjelasan' : 'Ketuk kartu untuk membalik'}
                      </span>
                      {!flipped ? (
                        <>
                          <p
                            className={`font-bold text-[#2B2226] ${
                              detectLang(card.front) === 'ar-SA' ? 'font-arabic text-4xl' : 'font-display text-3xl'
                            }`}
                          >
                            {card.front}
                          </p>
                          {card.transliteration && (
                            <p className="text-sm text-[#7B3449]">{card.transliteration}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="font-display text-2xl font-bold text-[#2B2226]">{card.back}</p>
                          {card.hint && <p className="text-sm text-[#5C4B51]">{card.hint}</p>}
                          {card.example && (
                            <p className="text-xs text-[#7B5D66] pt-2">{card.example}</p>
                          )}
                        </>
                      )}
                    </button>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <AudioPlayerButton
                        text={card.front}
                        lang={detectLang(card.front)}
                        label="Dengarkan"
                        speechRate={settings.speechRate}
                        tone="pink"
                      />

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAnswerHistory((prev) => [
                              ...prev,
                              {
                                prompt: card.front,
                                userAnswer: 'Masih ragu',
                                correctAnswer: card.back,
                                isCorrect: false,
                                explanation: card.hint || card.example || 'Tinjau lagi di kesempatan berikutnya.',
                              },
                            ]);
                            handleNextStep(score);
                          }}
                          className="px-4 py-2.5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] text-xs font-semibold min-h-[42px]"
                        >
                          Masih Ragu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextScore = score + 1;
                            setScore(nextScore);
                            setAnswerHistory((prev) => [
                              ...prev,
                              {
                                prompt: card.front,
                                userAnswer: 'Sudah paham',
                                correctAnswer: card.back,
                                isCorrect: true,
                                explanation: card.hint || card.example || 'Mantap, udah nempel di kepala!',
                              },
                            ]);
                            playFeedbackTone('success', settings.soundEffectsEnabled);
                            handleNextStep(nextScore);
                          }}
                          className="px-5 py-2.5 rounded-2xl bg-[#E7F0DF] text-[#263B27] text-xs font-bold min-h-[42px]"
                        >
                          Sudah Paham!
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 2. MULTIPLE CHOICE (& Summary Quiz) */}
              {(session.mode === 'multiple_choice' || session.mode === 'summary') &&
                session.multipleChoice?.[stepIdx] &&
                (() => {
                  const q = session.multipleChoice[stepIdx];
                  const answered = pickedOption !== null;
                  return (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <p className="font-display text-lg font-bold text-[#2B2226]">{q.question}</p>
                        {q.promptWord && (
                          <div className="flex flex-wrap items-center gap-3">
                            <p
                              dir="auto"
                              className={`font-bold text-[#2B2226] p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] inline-block ${
                                detectLang(q.promptWord) === 'ar-SA' ? 'font-arabic text-3xl' : 'text-xl'
                              }`}
                            >
                              {q.promptWord}
                            </p>
                            <AudioPlayerButton
                              text={q.promptWord}
                              lang={detectLang(q.promptWord)}
                              label="Dengarkan"
                              speechRate={settings.speechRate}
                              compact
                              tone="pink"
                            />
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {q.options.map((opt, idx) => {
                          const isCorrect = idx === q.correctIndex;
                          const isPicked = pickedOption === idx;
                          let cls = 'bg-[#FFF8F0] border-[#EADFD5] text-[#2B2226] hover:bg-[#FCE9ED]/50';
                          if (answered) {
                            if (isCorrect) cls = 'bg-[#E7F0DF] border-[#3A6B3E] text-[#1F2D21]';
                            else if (isPicked) cls = 'bg-[#FCE9ED] border-[#A83B5A] text-[#7B233B]';
                          }
                          return (
                            <button
                              key={idx}
                              type="button"
                              disabled={answered}
                              onClick={() => {
                                setPickedOption(idx);
                                setAnswerHistory((prev) => [
                                  ...prev,
                                  {
                                    prompt: q.promptWord ? `${q.question} (${q.promptWord})` : q.question,
                                    userAnswer: opt,
                                    correctAnswer: q.options[q.correctIndex] || '',
                                    isCorrect,
                                    explanation: q.explanation,
                                  },
                                ]);
                                if (isCorrect) {
                                  setScore((s) => s + 1);
                                  playFeedbackTone('success', settings.soundEffectsEnabled);
                                } else {
                                  playFeedbackTone('oops', settings.soundEffectsEnabled);
                                }
                              }}
                              className={`text-left p-4 rounded-2xl border text-sm font-semibold min-h-[52px] transition-colors ${cls}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>

                      {answered && (
                        <div className="p-4 rounded-2xl bg-[#FFF6D6]/75 space-y-3">
                          <p className="text-sm text-[#2B2226]">
                            <strong>
                              {pickedOption === q.correctIndex
                                ? 'Easy peasy! Benar nih! '
                                : 'Belum tepat nih, tapi gapapa! '}
                            </strong>
                            {q.explanation}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleNextStep(score)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2B2226] text-[#FFF8F0] text-xs font-semibold min-h-[42px]"
                          >
                            <span>{stepIdx + 1 >= totalSteps ? 'Lihat Hasil' : 'Lanjut Soal Berikutnya'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

              {/* 3. MATCH THE WORDS */}
              {session.mode === 'match' && session.matchPairs && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#5C4B51]">
                    <span>Pilih satu kata di kiri, lalu ketuk pasangannya di kanan!</span>
                    <span className="tabular-nums">
                      Cocok: {matchedIds.length} / {session.matchPairs.length}
                    </span>
                  </div>

                  {matchErrorMsg && (
                    <div className="p-3 rounded-2xl bg-[#FCE9ED] text-xs text-[#7B233B]">{matchErrorMsg}</div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2.5">
                      {session.matchPairs.map((p) => {
                        const isMatched = matchedIds.includes(p.id);
                        const isSelected = selectedLeftId === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            disabled={isMatched}
                            onClick={() => {
                              setSelectedLeftId(p.id);
                              setMatchErrorMsg(null);
                            }}
                            className={`w-full p-3.5 rounded-2xl border text-left font-bold min-h-[54px] transition-colors ${
                              isMatched
                                ? 'bg-[#E7F0DF] border-[#C9DFC0] text-[#263B27] opacity-60'
                                : isSelected
                                  ? 'bg-[#FCE9ED] border-[#A83B5A] text-[#2B2226]'
                                  : 'bg-[#FFF8F0] border-[#EADFD5] text-[#2B2226]'
                            }`}
                          >
                            <span className={detectLang(p.left) === 'ar-SA' ? 'font-arabic text-xl' : 'text-sm'}>
                              {p.left}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="space-y-2.5">
                      {shuffledRight.map((r) => {
                        const isMatched = matchedIds.includes(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            disabled={isMatched || !selectedLeftId}
                            onClick={() => handlePickRight(r)}
                            className={`w-full p-3.5 rounded-2xl border text-left text-sm font-medium min-h-[54px] transition-colors ${
                              isMatched
                                ? 'bg-[#E7F0DF] border-[#C9DFC0] text-[#263B27] opacity-60'
                                : 'bg-white border-[#EADFD5] hover:bg-[#FFF6D6] text-[#2B2226]'
                            }`}
                          >
                            {r.right}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 4. FILL IN THE BLANKS */}
              {session.mode === 'fill_blank' && session.fillBlanks?.[stepIdx] && (() => {
                const fb = session.fillBlanks[stepIdx];
                const answered = pickedWord !== null;
                return (
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2">
                      <p
                        dir="auto"
                        className={`font-bold text-[#2B2226] ${
                          detectLang(fb.sentenceWithBlank) === 'ar-SA' ? 'font-arabic text-2xl' : 'text-lg'
                        }`}
                      >
                        {fb.sentenceWithBlank}
                      </p>
                      {fb.translationHint && (
                        <p className="text-xs text-[#5C4B51]">Petunjuk arti: {fb.translationHint}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {fb.options.map((opt, idx) => {
                        const isCorrect = opt.trim() === fb.answer.trim();
                        const isPicked = pickedWord === opt;
                        let cls = 'bg-[#FFF8F0] border-[#EADFD5] text-[#2B2226]';
                        if (answered) {
                          if (isCorrect) cls = 'bg-[#E7F0DF] border-[#3A6B3E] text-[#1F2D21]';
                          else if (isPicked) cls = 'bg-[#FCE9ED] border-[#A83B5A] text-[#7B233B]';
                        }
                        return (
                          <button
                            key={idx}
                            type="button"
                            disabled={answered}
                            onClick={() => {
                              setPickedWord(opt);
                              setAnswerHistory((prev) => [
                                ...prev,
                                {
                                  prompt: fb.sentenceWithBlank,
                                  userAnswer: opt,
                                  correctAnswer: fb.answer,
                                  isCorrect,
                                  explanation: fb.explanation,
                                },
                              ]);
                              if (isCorrect) {
                                setScore((s) => s + 1);
                                playFeedbackTone('success', settings.soundEffectsEnabled);
                              } else {
                                playFeedbackTone('oops', settings.soundEffectsEnabled);
                              }
                            }}
                            className={`p-3.5 rounded-2xl border font-bold text-sm min-h-[48px] ${cls}`}
                          >
                            <span className={detectLang(opt) === 'ar-SA' ? 'font-arabic text-xl' : ''}>
                              {opt}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {answered && (
                      <div className="p-4 rounded-2xl bg-[#FFF6D6]/75 space-y-3">
                        <p className="text-sm text-[#2B2226]">
                          <strong>
                            {pickedWord?.trim() === fb.answer.trim()
                              ? 'Nah, pas banget! '
                              : `Belum tepat nih, jawabannya "${fb.answer}". `}
                          </strong>
                          {fb.explanation}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleNextStep(score)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2B2226] text-[#FFF8F0] text-xs font-semibold min-h-[42px]"
                        >
                          <span>{stepIdx + 1 >= totalSteps ? 'Lihat Hasil' : 'Lanjut'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 5. TRANSLATE THE SENTENCE */}
              {session.mode === 'translate_sentence' &&
                session.translateSentences?.[stepIdx] &&
                (() => {
                  const tr = session.translateSentences[stepIdx];
                  return (
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#7B5D66]">
                            Terjemahkan dari {tr.sourceLanguage} ke {tr.targetLanguage}
                          </span>
                          <AudioPlayerButton
                            text={tr.sourceSentence}
                            lang={detectLang(tr.sourceSentence)}
                            label="Dengar Kalimat"
                            speechRate={settings.speechRate}
                            compact
                            tone="pink"
                          />
                        </div>
                        <p
                          dir="auto"
                          className={`font-bold text-[#2B2226] pt-1 ${
                            detectLang(tr.sourceSentence) === 'ar-SA' ? 'font-arabic text-2xl' : 'text-lg'
                          }`}
                        >
                          {tr.sourceSentence}
                        </p>
                      </div>

                      <textarea
                        rows={3}
                        dir="auto"
                        value={translationInput}
                        onChange={(e) => setTranslationInput(e.target.value)}
                        disabled={translationChecked}
                        placeholder="Ketik terjemahanmu di sini..."
                        className="w-full p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] text-sm focus:outline-none focus:border-[#A83B5A]"
                      />

                      {!translationChecked ? (
                        <button
                          type="button"
                          disabled={!translationInput.trim()}
                          onClick={handleCheckTranslation}
                          className="px-6 py-3 rounded-2xl bg-[#2B2226] disabled:opacity-50 text-[#FFF8F0] text-sm font-semibold min-h-[44px]"
                        >
                          Cek Terjemahan
                        </button>
                      ) : (
                        <div className="p-4 rounded-2xl bg-[#FFF6D6]/75 space-y-2.5">
                          <p className="text-sm font-bold text-[#2B2226]">
                            {translationCorrect
                              ? 'Good job! Terjemahanmu kena banget!'
                              : 'Hampir! Cek referensi jawabannya di bawah ya:'}
                          </p>
                          <p className="text-sm text-[#2B2226] bg-white p-3 rounded-xl border border-[#EADFD5]">
                            Referensi: <strong>{tr.referenceTranslation}</strong>
                          </p>
                          <p className="text-xs text-[#5C4B51]">{tr.explanation}</p>
                          <button
                            type="button"
                            onClick={() => handleNextStep(score)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2B2226] text-[#FFF8F0] text-xs font-semibold min-h-[42px]"
                          >
                            <span>{stepIdx + 1 >= totalSteps ? 'Lihat Hasil' : 'Lanjut'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}

              {/* 6. ARRANGE THE WORDS */}
              {session.mode === 'arrange_words' && session.arrangeWords?.[stepIdx] && (() => {
                const aw = session.arrangeWords[stepIdx];
                const isAr = aw.language === 'arabic';
                return (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-[#7B5D66]">
                        Susun kata-kata ini supaya artinya:
                      </span>
                      <p className="font-display text-lg font-bold text-[#2B2226]">{aw.promptIndonesian}</p>
                    </div>

                    {/* Answer tray */}
                    <div
                      dir={isAr ? 'rtl' : 'ltr'}
                      className="min-h-[72px] p-4 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] flex flex-wrap gap-2 items-center"
                    >
                      {chosenTokens.length === 0 ? (
                        <span className="text-xs text-[#7B5D66]">
                          Ketuk potongan kata di bawah untuk menyusunnya di sini...
                        </span>
                      ) : (
                        chosenTokens.map((tok) => (
                          <button
                            key={tok.key}
                            type="button"
                            disabled={arrangeChecked}
                            onClick={() => {
                              setChosenTokens((prev) => prev.filter((t) => t.key !== tok.key));
                              setAvailableTokens((prev) => [...prev, tok]);
                            }}
                            className={`px-3.5 py-2 rounded-xl bg-white border border-[#A83B5A] font-bold text-[#2B2226] min-h-[40px] ${
                              isAr ? 'font-arabic text-xl' : 'text-sm'
                            }`}
                          >
                            {tok.text}
                          </button>
                        ))
                      )}
                    </div>

                    {/* Word bank */}
                    <div dir={isAr ? 'rtl' : 'ltr'} className="flex flex-wrap gap-2">
                      {availableTokens.map((tok) => (
                        <button
                          key={tok.key}
                          type="button"
                          disabled={arrangeChecked}
                          onClick={() => {
                            setAvailableTokens((prev) => prev.filter((t) => t.key !== tok.key));
                            setChosenTokens((prev) => [...prev, tok]);
                          }}
                          className={`px-3.5 py-2 rounded-xl bg-[#FCE9ED] hover:bg-[#F6C9D5] font-bold text-[#2B2226] min-h-[40px] ${
                            isAr ? 'font-arabic text-xl' : 'text-sm'
                          }`}
                        >
                          {tok.text}
                        </button>
                      ))}
                    </div>

                    {!arrangeChecked ? (
                      <button
                        type="button"
                        disabled={chosenTokens.length === 0}
                        onClick={handleCheckArrange}
                        className="px-6 py-3 rounded-2xl bg-[#2B2226] disabled:opacity-50 text-[#FFF8F0] text-sm font-semibold min-h-[44px]"
                      >
                        Cek Susunan Kalimat
                      </button>
                    ) : (
                      <div className="p-4 rounded-2xl bg-[#FFF6D6]/75 space-y-2.5">
                        <p className="text-sm font-bold text-[#2B2226]">
                          {arrangeCorrect
                            ? 'Wih, rapi banget susunannya! Easy peasy!'
                            : 'Belum pas urutannya nih, tapi tenang—lihat urutan benarnya:'}
                        </p>
                        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-[#EADFD5]">
                          <p
                            dir={isAr ? 'rtl' : 'ltr'}
                            className={`font-bold text-[#2B2226] ${
                              isAr ? 'font-arabic text-2xl' : 'text-base'
                            }`}
                          >
                            {aw.targetSentence}
                          </p>
                          <AudioPlayerButton
                            text={aw.targetSentence}
                            lang={isAr ? 'ar-SA' : 'en-US'}
                            label="Dengar"
                            speechRate={settings.speechRate}
                            compact
                            tone="pink"
                          />
                        </div>
                        <p className="text-xs text-[#5C4B51]">{aw.explanation}</p>
                        <button
                          type="button"
                          onClick={() => handleNextStep(score)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#2B2226] text-[#FFF8F0] text-xs font-semibold min-h-[42px]"
                        >
                          <span>{stepIdx + 1 >= totalSteps ? 'Lihat Hasil' : 'Lanjut'}</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* RESULT PAGE */}
      {session && finished && (
        <div className="space-y-6">
          <div className="p-8 rounded-3xl bg-white border border-[#EADFD5] text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-[#FFF6D6] border border-[#F8E6A0] flex items-center justify-center mx-auto text-[#6B5416]">
              <Trophy className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B2226]">
                Latihan Selesai!
              </h2>
              <p className="text-sm text-[#5C4B51] max-w-lg mx-auto">
                {score === totalSteps
                  ? 'Sempurna! Semua soal kamu sikat bersih tanpa ampun!'
                  : score >= Math.ceil(totalSteps * 0.6)
                    ? 'Good job! Sudah mantap banget pemahamannya, dikit lagi sempurna!'
                    : 'Gapapa banget! Belajar bahasa memang butuh pelan-pelan. Yuk ulangi biar makin nempel!'}
              </p>
            </div>

            <div className="inline-flex items-center gap-6 px-8 py-4 rounded-3xl bg-[#E7F0DF] border border-[#C9DFC0]">
              <div>
                <span className="text-xs text-[#263B27] block">Skor Kamu</span>
                <span className="font-display text-3xl font-extrabold text-[#1F2D21] tabular-nums">
                  {score} / {totalSteps}
                </span>
              </div>
              <div className="h-10 w-px bg-[#C9DFC0]" />
              <div>
                <span className="text-xs text-[#263B27] block">Akurasi</span>
                <span className="font-display text-3xl font-extrabold text-[#1F2D21] tabular-nums">
                  {totalSteps > 0 ? Math.round((score / totalSteps) * 100) : 100}%
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => startPractice(session.mode, totalSteps || 5)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#F6C9D5] hover:bg-[#efbac8] text-[#2B2226] text-sm font-semibold min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={resetToSetup}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#2B2226] text-[#FFF8F0] text-sm font-semibold min-h-[44px]"
              >
                <Layers className="w-4 h-4" />
                <span>Back to Practice</span>
              </button>
            </div>
          </div>

          {/* Answer Explanations & Review */}
          {answerHistory.length > 0 && (
            <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
              <h3 className="font-display text-lg font-bold text-[#2B2226]">
                Review Jawaban & Penjelasan
              </h3>
              <div className="space-y-3">
                {answerHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-2xl border space-y-1.5 ${
                      item.isCorrect
                        ? 'bg-[#E7F0DF]/55 border-[#C9DFC0]'
                        : 'bg-[#FCE9ED]/60 border-[#F6C9D5]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p dir="auto" className="font-semibold text-sm text-[#2B2226]">
                        {idx + 1}. {item.prompt}
                      </p>
                      {item.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-[#263B27] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#A83B5A] shrink-0 mt-0.5" />
                      )}
                    </div>
                    <p className="text-xs text-[#5C4B51]">
                      Jawaban kamu: <strong>{item.userAnswer || '-'}</strong> · Kunci:{' '}
                      <strong>{item.correctAnswer}</strong>
                    </p>
                    <p className="text-xs text-[#2B2226]">{item.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
