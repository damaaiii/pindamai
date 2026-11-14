export type NavRoute = 'home' | 'scanner' | 'learn' | 'my-words' | 'practice' | 'settings';

export type ExplanationLevel = 'beginner' | 'intermediate' | 'advanced';
export type LanguageChoice = 'auto' | 'arabic' | 'english';
export type LearningLanguage = 'arabic' | 'english' | 'both';

export interface ExampleSentence {
  english?: string;
  arabic?: string;
  target?: string;
  transliteration?: string;
  indonesian: string;
}

export interface RelatedVocab {
  arabic: string;
  transliteration: string;
  english: string;
  indonesian: string;
}

export interface DetectedObjectItem {
  confidence: 'high' | 'medium' | 'low' | string;
  indonesianName: string;
  arabicWord: string;
  arabicTransliteration: string;
  englishWord: string;
  ipaTranscription?: string;
  indonesianMeaning: string;
  category: string;
  funNote: string;
  relatedVocabulary: RelatedVocab[];
  exampleSentences: ExampleSentence[];
}

export interface ObjectScanResponse {
  uncertain: boolean;
  confidenceNote: string;
  objects: DetectedObjectItem[];
}

export interface WordByWordItem {
  word: string;
  transliteration?: string;
  meaning: string;
  partOfSpeech: string;
  note?: string;
}

export interface KeyVocabItem {
  word: string;
  harakatOrOriginal?: string;
  transliteration?: string;
  english?: string;
  indonesian: string;
  partOfSpeech: string;
  contextualMeaning?: string;
  exampleSentence?: string;
  explanation: string;
}

export interface GrammarErrorItem {
  originalSentence: string;
  correctedSentence: string;
  category: string;
  explanation: string;
  whyAppropriate: string;
  isStylisticOnly?: boolean;
}

export interface GrammarCheckResult {
  hasErrors: boolean;
  hasStylisticSuggestions?: boolean;
  statusMessage: string;
  correctedText: string;
  errors: GrammarErrorItem[];
}

export interface TranslatedSentencePair {
  index: number;
  original: string;
  corrected?: string;
  indonesianOriginal: string;
  indonesianCorrected?: string;
  ambiguousNote?: string;
}

export interface CompleteTranslationResult {
  originalFullTranslation: string;
  correctedFullTranslation?: string;
  sourceSentenceCount: number;
  translatedSentenceCount: number;
  isComplete: boolean;
  ambiguousExpressions?: Array<{
    expression: string;
    note: string;
  }>;
  unprocessedNotice?: string;
  sentencePairs: TranslatedSentencePair[];
}

export interface SentenceAnalysisItem {
  originalSentence: string;
  correctedSentence?: string;
  language: 'arabic' | 'english' | 'mixed' | string;
  indonesianTranslation: string;
  englishBreakdown?: {
    subject?: string;
    verb?: string;
    object?: string;
    complementOrAdverbial?: string;
    tense?: string;
    sentencePattern?: string;
  } | null;
  arabicBreakdown?: {
    nahwu?: string;
    sharaf?: string;
    irab?: string;
    wordByWord?: Array<{
      word: string;
      meaning: string;
      role?: string;
    }>;
    sentenceStructure?: string;
  } | null;
}

export interface LearnMoreItem {
  title: string;
  exampleTarget: string;
  transliteration?: string;
  indonesian: string;
  simpleExplanation: string;
}

export interface LanguageAnalysisResponse {
  detectedLanguage: 'arabic' | 'english' | 'mixed' | string;
  introMessage: string;
  isParagraph: boolean;
  originalText: string;
  normalizedWithHarakat?: string;
  transliteration?: string;
  indonesianTranslation: string;
  grammarCheck?: GrammarCheckResult;
  translation?: CompleteTranslationResult;
  sentenceAnalyses?: SentenceAnalysisItem[];
  learnMore?: LearnMoreItem[];
  wordByWord: WordByWordItem[];
  keyVocabulary: KeyVocabItem[];
  arabicGrammar?: {
    nahwuSummary?: string;
    sharafSummary?: string;
    sentenceStructure?: string;
    contextWarning?: string;
  } | null;
  englishGrammar?: {
    grammarSummary?: string;
    tenseIdentification?: string;
    subjectVerbObject?: {
      subject?: string;
      verb?: string;
      object?: string;
    };
    sentenceStructure?: string;
  } | null;
  paragraphBreakdown?: {
    sentences: Array<{
      original: string;
      translation: string;
      structureNote: string;
    }>;
    summary: string;
    miniExercises: Array<{
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
    }>;
  } | null;
  exampleSentences: ExampleSentence[];
}

export interface VocabularyItem {
  id: string;
  arabicWord?: string;
  arabicTransliteration?: string;
  englishWord?: string;
  indonesianMeaning: string;
  primaryLanguage: 'arabic' | 'english' | 'both';
  category: string;
  partOfSpeech?: string;
  funNote?: string;
  relatedVocabulary?: RelatedVocab[];
  exampleSentences?: ExampleSentence[];
  isFavorite: boolean;
  status: 'learning' | 'mastered';
  source: 'object-scan' | 'text-scan' | 'manual' | 'daily';
  createdAt: number;
  updatedAt: number;
}

export interface ScanHistoryItem {
  id: string;
  type: 'text' | 'object';
  title: string;
  rawText?: string;
  language?: string;
  summary: string;
  thumbnailDataUrl?: string;
  objectResult?: ObjectScanResponse;
  analysisResult?: LanguageAnalysisResponse;
  createdAt: number;
}

export interface PracticeResultItem {
  id: string;
  mode: string;
  score: number;
  total: number;
  sourceTitle: string;
  createdAt: number;
}

export interface AppSettings {
  interfaceLanguage: 'id' | 'id-en';
  defaultLearningLanguage: LearningLanguage;
  defaultExplanationLevel: ExplanationLevel;
  soundEffectsEnabled: boolean;
  speechRate: number;
}

export interface LearningProgress {
  totalScans: number;
  totalPracticeSessions: number;
  streakDays: number;
  lastActiveDate: string;
  xpPoints: number;
}

export type PracticeMode =
  | 'multiple_choice'
  | 'match'
  | 'fill_blank'
  | 'translate_sentence'
  | 'arrange_words'
  | 'flashcards'
  | 'summary';

export interface PracticePayload {
  mode: PracticeMode;
  introNote: string;
  summaryText?: string;
  keyPoints?: string[];
  flashcards?: Array<{
    front: string;
    back: string;
    transliteration?: string;
    hint?: string;
    example?: string;
  }>;
  multipleChoice?: Array<{
    question: string;
    promptWord?: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>;
  matchPairs?: Array<{
    id: string;
    left: string;
    right: string;
    note?: string;
  }>;
  fillBlanks?: Array<{
    sentenceWithBlank: string;
    translationHint?: string;
    options: string[];
    answer: string;
    explanation: string;
  }>;
  translateSentences?: Array<{
    sourceSentence: string;
    sourceLanguage: string;
    targetLanguage: string;
    referenceTranslation: string;
    acceptableKeywords: string[];
    explanation: string;
  }>;
  arrangeWords?: Array<{
    promptIndonesian: string;
    targetSentence: string;
    tokens: string[];
    language: 'arabic' | 'english' | string;
    explanation: string;
  }>;
}
