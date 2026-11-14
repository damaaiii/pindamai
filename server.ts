import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';
const FALLBACK_MODEL_NAME = 'gemini-3.1-flash-lite';

async function generateContentWithRetry(
  ai: GoogleGenAI,
  params: Parameters<GoogleGenAI['models']['generateContent']>[0]
) {
  const modelsToTry =
    params.model === MODEL_NAME ? [MODEL_NAME, FALLBACK_MODEL_NAME] : [params.model];

  let lastError: unknown;
  for (const model of modelsToTry) {
    const delays = [0, 1000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) {
        await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      }
      try {
        return await ai.models.generateContent({
          ...params,
          model,
        });
      } catch (err) {
        lastError = err;
        const errObj = err as Error & { status?: number; statusCode?: number };
        const status = errObj?.status ?? errObj?.statusCode;
        const msg = errObj?.message || '';
        const isRateOrTransient =
          status === 429 ||
          status === 503 ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('UNAVAILABLE');
        console.warn(
          `[PINDAMAI Gemini] model=${model} attempt=${attempt + 1} status=${status ?? 'unknown'} msg=${msg.slice(0, 180)}`
        );
        if (!isRateOrTransient) {
          throw err;
        }
      }
    }
  }
  throw lastError;
}

function getConfiguredApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY' || key.length < 10) {
    return null;
  }
  return key;
}

function createGeminiClient(): GoogleGenAI {
  const apiKey = getConfiguredApiKey();
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY_MISSING');
    (err as Error & { statusCode?: number; needsConfig?: boolean }).statusCode = 503;
    (err as Error & { statusCode?: number; needsConfig?: boolean }).needsConfig = true;
    throw err;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const PINDAMAI_PERSONALITY = `
Kamu adalah PINDAMAI: teman belajar bahasa Arab dan Inggris yang pintar, santai, lucu, witty, dan suportif (bukan guru galak atau buku teks kaku).
Aturan gaya bahasa:
- Gunakan Bahasa Indonesia kasual sehari-hari untuk semua penjelasan, komentar, dan pesan antar-muka ("Okeee!", "Nah, gini nih!", "Wait, interesting!", "Easy peasy!", "Gas!", sesekali humor ringan yang pas).
- Jangan kaku atau terlalu formal, tapi tetap jelas, edukatif, dan tidak lebay.
- Gunakan emoji secukupnya dan natural.
- PEMISAHAN BAHASA PENTING:
  1. Kosakata Bahasa Arab WAJIB akurat dan dilengkapi harakat lengkap jika dapat dipastikan secara linguistik.
  2. Kosakata dan contoh kalimat Bahasa Inggris WAJIB gramatikal dan natural.
  3. Penjelasan Nahwu, Sharaf, dan Grammar Inggris WAJIB akurat secara akademis—jangan mengarang istilah atau memelintir definisi demi bercanda. Jelaskan istilah teknis dengan bahasa teman yang mudah dicerna.
  4. Jika suatu kata/objek tidak jelas atau memiliki konteks ambigu, katakan dengan jujur. Jangan pernah mengarang hasil!
`;

function handleAiError(res: Response, error: unknown, fallbackMsg: string) {
  const errObj = error as Error & { statusCode?: number; status?: number; needsConfig?: boolean };
  const message = errObj?.message || '';

  if (message === 'GEMINI_API_KEY_MISSING' || errObj?.needsConfig) {
    return res.status(503).json({
      error:
        'Waduh, mesin AI PINDAMAI belum terhubung ke Gemini API Key nih. Pastikan GEMINI_API_KEY sudah diatur di Settings > Secrets atau environment variables ya!',
      code: 'GEMINI_API_KEY_MISSING',
      needsConfig: true,
    });
  }

  if (
    message.includes('API_KEY_INVALID') ||
    message.includes('PERMISSION_DENIED') ||
    errObj?.status === 403
  ) {
    return res.status(400).json({
      error:
        'Ups, Gemini API Key sepertinya belum valid atau izinnya ditolak. Cek lagi key kamu di Settings > Secrets ya!',
      code: 'API_KEY_ERROR',
      needsConfig: true,
    });
  }

  if (message.includes('RESOURCE_EXHAUSTED') || errObj?.status === 429) {
    console.warn('[PINDAMAI AI Rate Limit 429]', message.slice(0, 300));
    return res.status(429).json({
      error:
        'Wah, kuota request AI lagi padat nih! Tunggu sebentar ya lalu coba scan lagi.',
      code: 'RATE_LIMIT',
    });
  }

  console.error('[PINDAMAI AI Error]', error);
  return res.status(errObj?.status && errObj.status >= 400 && errObj.status < 500 ? errObj.status : 500).json({
    error: `${fallbackMsg} (${message || 'Terjadi gangguan pada layanan AI'})`,
    code: 'AI_REQUEST_FAILED',
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const apiKey = getConfiguredApiKey();
    res.json({
      ok: true,
      aiConfigured: Boolean(apiKey),
      model: MODEL_NAME,
    });
  });

  // 1. Object Scanner (Gemini Vision)
  app.post('/api/ai/scan-objects', async (req: Request, res: Response) => {
    try {
      const { imageBase64, mimeType = 'image/jpeg', mode = 'single', hint } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        mode?: 'single' | 'multiple';
        hint?: string;
      };

      if (!imageBase64) {
        return res.status(400).json({ error: 'Gambarnya belum ada nih! Upload atau jepret dulu ya.' });
      }

      const ai = createGeminiClient();
      const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');

      const prompt = `
Analisis gambar ini untuk aplikasi belajar bahasa Arab & Inggris (PINDAMAI).
Mode scan: ${mode === 'single' ? 'SINGLE OBJECT (fokus ke 1 objek paling utama dan jelas di gambar)' : 'MULTIPLE OBJECTS (kenali maksimal 6 objek nyata yang terlihat jelas di gambar)'}.
${hint ? `Catatan koreksi dari pengguna: "${hint}". Gunakan petunjuk ini sebagai acuan utama bila relevan dengan gambar.` : ''}

Aturan WAJIB:
- Jika gambar terlalu gelap, buram, kosong, atau objek tidak bisa dipastikan dengan yakin, set "uncertain": true dan jelaskan dengan jujur di "confidenceNote". JANGAN mengarang nama objek!
- Untuk setiap objek yang dikenali dengan cukup yakin, berikan:
  - indonesianName: Nama objek dalam Bahasa Indonesia.
  - arabicWord: Kosakata Bahasa Arab yang tepat dengan HARAKAT LENGKAP (contoh: تُفَّاحَةٌ).
  - arabicTransliteration: Transliterasi Latin yang rapi dan mudah dibaca (contoh: Tuffāḥatun).
  - englishWord: Kosakata Bahasa Inggris yang tepat (contoh: Apple).
  - ipaTranscription: Transkripsi fonetik IPA untuk kata bahasa Inggris tersebut (contoh: /ˈæp.əl/).
  - indonesianMeaning: Arti & penjelasan singkat santai dalam Bahasa Indonesia.
  - category: Kategori kosakata (misal: Makanan & Minuman, Benda Rumah, Alam, Alat Tulis, Elektronik, Pakaian, Transportasi, dll).
  - funNote: Komentar singkat yang lucu, ramah, atau trivia bahasa menarik tentang kata ini dalam Bahasa Indonesia kasual.
  - relatedVocabulary: 2-3 kosakata terkait (arabic berharakat, transliteration, english, indonesian).
  - exampleSentences: 2 contoh kalimat nyata memakai kata ini (english, arabic berharakat, indonesian).
- Pada "confidenceNote", sapa pengguna dengan gaya PINDAMAI (misal: "Object detected! 👀 Kita nemu sesuatu nih!").
`;

      const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            { text: prompt },
          ],
        },
        config: {
          systemInstruction: PINDAMAI_PERSONALITY,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              uncertain: { type: Type.BOOLEAN },
              confidenceNote: { type: Type.STRING },
              objects: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    confidence: { type: Type.STRING },
                    indonesianName: { type: Type.STRING },
                    arabicWord: { type: Type.STRING },
                    arabicTransliteration: { type: Type.STRING },
                    englishWord: { type: Type.STRING },
                    ipaTranscription: { type: Type.STRING },
                    indonesianMeaning: { type: Type.STRING },
                    category: { type: Type.STRING },
                    funNote: { type: Type.STRING },
                    relatedVocabulary: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          arabic: { type: Type.STRING },
                          transliteration: { type: Type.STRING },
                          english: { type: Type.STRING },
                          indonesian: { type: Type.STRING },
                        },
                      },
                    },
                    exampleSentences: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          english: { type: Type.STRING },
                          arabic: { type: Type.STRING },
                          indonesian: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json(parsed);
    } catch (error) {
      return handleAiError(res, error, 'Gagal menganalisis objek dari gambar');
    }
  });

  // Helper: split user text into individual sentences across paragraphs without dropping any content
  function splitIntoSourceSentences(rawText: string): string[] {
    const trimmed = rawText.trim();
    if (!trimmed) return [];

    // Protect common abbreviations and decimal numbers from splitting
    const abbrevMap: Array<[RegExp, string]> = [
      [/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|U\.S|U\.K)\./gi, '$1__DOT__'],
      [/(\d)\.(\d)/g, '$1__DOT__$2'],
    ];

    const paragraphs = trimmed.split(/\r?\n+/).map((p) => p.trim()).filter(Boolean);
    const sentences: string[] = [];

    for (const para of paragraphs) {
      let safe = para;
      for (const [re, rep] of abbrevMap) {
        safe = safe.replace(re, rep);
      }

      // Split on sentence-ending punctuation (. ! ? ؟ ۔) followed by whitespace or end
      const rawParts = safe
        .split(/(?<=[.!?؟۔]+)\s+/)
        .map((s) => s.replace(/__DOT__/g, '.').trim())
        .filter(Boolean);

      if (rawParts.length > 0) {
        sentences.push(...rawParts);
      } else {
        sentences.push(para);
      }
    }

    return sentences.length > 0 ? sentences : [trimmed];
  }

  function buildSentenceChunks(
    sentences: string[],
    maxSentencesPerChunk = 6,
    maxCharsPerChunk = 950
  ): string[][] {
    const chunks: string[][] = [];
    let current: string[] = [];
    let currentChars = 0;

    for (const s of sentences) {
      if (
        current.length > 0 &&
        (current.length >= maxSentencesPerChunk || currentChars + s.length > maxCharsPerChunk)
      ) {
        chunks.push(current);
        current = [];
        currentChars = 0;
      }
      current.push(s);
      currentChars += s.length;
    }

    if (current.length > 0) {
      chunks.push(current);
    }
    return chunks;
  }

  // 2. Language Analysis & AI Tutor (Grammar Check + Correction + Complete Translation + Deep Breakdown)
  app.post('/api/ai/analyze-language', async (req: Request, res: Response) => {
    try {
      const {
        text,
        language = 'auto',
        level = 'beginner',
        simplify = false,
      } = req.body as {
        text?: string;
        language?: 'auto' | 'arabic' | 'english';
        level?: 'beginner' | 'intermediate' | 'advanced';
        simplify?: boolean;
      };

      const rawText = (text || '').trim();
      if (!rawText) {
        return res.status(400).json({ error: 'Teksnya masih kosong nih! Ketik atau scan teks dulu ya.' });
      }

      const ai = createGeminiClient();
      const levelGuide =
        level === 'beginner'
          ? 'BEGINNER: Penjelasan super sederhana, ramah pemula, istilah tata bahasa dijelaskan dengan perumpamaan sehari-hari.'
          : level === 'intermediate'
            ? 'INTERMEDIATE: Penjelasan lengkap dan seimbang antara santai dan detail tata bahasa (I’rab / tenses / pola kata).'
            : 'ADVANCED: Analisis linguistik lebih mendalam (detail Nahwu-Sharaf / sintaksis & nuansa semantik Inggris), tetap dengan gaya teman ngobrol yang enak dibaca.';

      const simplifyGuide = simplify
        ? 'MODE "EXPLAIN IT SIMPLY" AKTIF: Buat penjelasan se-simpel mungkin seolah menjelaskan ke teman dalam 15 detik, tanpa mengurangi ketepatan fakta bahasanya!'
        : '';

      const sourceSentences = splitIntoSourceSentences(rawText);
      const chunks = buildSentenceChunks(sourceSentences, 6, 950);
      const totalSourceSentences = sourceSentences.length;

      interface ChunkSentenceItem {
        index: number;
        originalSentence: string;
        correctedSentence: string;
        language: string;
        indonesianOriginal: string;
        indonesianCorrected?: string;
        ambiguousNote?: string;
        englishBreakdown?: {
          subject?: string;
          verb?: string;
          object?: string;
          complementOrAdverbial?: string;
          tense?: string;
          sentencePattern?: string;
        };
        arabicBreakdown?: {
          nahwu?: string;
          sharaf?: string;
          irab?: string;
          wordByWord?: Array<{ word: string; meaning: string; role?: string }>;
          sentenceStructure?: string;
        };
      }

      interface ChunkOutput {
        detectedLanguage?: string;
        introMessage?: string;
        normalizedWithHarakat?: string;
        transliteration?: string;
        grammarErrors?: Array<{
          originalSentence: string;
          correctedSentence: string;
          category: string;
          explanation: string;
          whyAppropriate: string;
          isStylisticOnly?: boolean;
        }>;
        sentenceTranslations?: ChunkSentenceItem[];
        wordByWord?: Array<{
          word: string;
          transliteration?: string;
          meaning: string;
          partOfSpeech: string;
          note?: string;
        }>;
        keyVocabulary?: Array<{
          word: string;
          harakatOrOriginal?: string;
          transliteration?: string;
          english?: string;
          indonesian: string;
          partOfSpeech: string;
          contextualMeaning?: string;
          exampleSentence?: string;
          explanation: string;
        }>;
        arabicGrammarSummary?: {
          nahwuSummary?: string;
          sharafSummary?: string;
          sentenceStructure?: string;
          contextWarning?: string;
        };
        englishGrammarSummary?: {
          grammarSummary?: string;
          tenseIdentification?: string;
          subjectVerbObject?: {
            subject?: string;
            verb?: string;
            object?: string;
          };
          sentenceStructure?: string;
        };
        paragraphSummary?: string;
        learnMore?: Array<{
          title: string;
          exampleTarget: string;
          transliteration?: string;
          indonesian: string;
          simpleExplanation: string;
        }>;
        miniExercises?: Array<{
          question: string;
          options: string[];
          correctIndex: number;
          explanation: string;
        }>;
      }

      const chunkSchema = {
        type: Type.OBJECT,
        properties: {
          detectedLanguage: { type: Type.STRING },
          introMessage: { type: Type.STRING },
          normalizedWithHarakat: { type: Type.STRING },
          transliteration: { type: Type.STRING },
          grammarErrors: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalSentence: { type: Type.STRING },
                correctedSentence: { type: Type.STRING },
                category: { type: Type.STRING },
                explanation: { type: Type.STRING },
                whyAppropriate: { type: Type.STRING },
                isStylisticOnly: { type: Type.BOOLEAN },
              },
              required: ['originalSentence', 'correctedSentence', 'category', 'explanation', 'whyAppropriate', 'isStylisticOnly'],
            },
          },
          sentenceTranslations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                index: { type: Type.INTEGER },
                originalSentence: { type: Type.STRING },
                correctedSentence: { type: Type.STRING },
                language: { type: Type.STRING },
                indonesianOriginal: { type: Type.STRING },
                indonesianCorrected: { type: Type.STRING },
                ambiguousNote: { type: Type.STRING },
                englishBreakdown: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING },
                    verb: { type: Type.STRING },
                    object: { type: Type.STRING },
                    complementOrAdverbial: { type: Type.STRING },
                    tense: { type: Type.STRING },
                    sentencePattern: { type: Type.STRING },
                  },
                },
                arabicBreakdown: {
                  type: Type.OBJECT,
                  properties: {
                    nahwu: { type: Type.STRING },
                    sharaf: { type: Type.STRING },
                    irab: { type: Type.STRING },
                    sentenceStructure: { type: Type.STRING },
                    wordByWord: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          word: { type: Type.STRING },
                          meaning: { type: Type.STRING },
                          role: { type: Type.STRING },
                        },
                        required: ['word', 'meaning'],
                      },
                    },
                  },
                },
              },
              required: ['index', 'originalSentence', 'correctedSentence', 'language', 'indonesianOriginal'],
            },
          },
          wordByWord: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                transliteration: { type: Type.STRING },
                meaning: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
                note: { type: Type.STRING },
              },
              required: ['word', 'meaning', 'partOfSpeech'],
            },
          },
          keyVocabulary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                word: { type: Type.STRING },
                harakatOrOriginal: { type: Type.STRING },
                transliteration: { type: Type.STRING },
                english: { type: Type.STRING },
                indonesian: { type: Type.STRING },
                partOfSpeech: { type: Type.STRING },
                contextualMeaning: { type: Type.STRING },
                exampleSentence: { type: Type.STRING },
                explanation: { type: Type.STRING },
              },
              required: ['word', 'indonesian', 'partOfSpeech', 'contextualMeaning', 'exampleSentence', 'explanation'],
            },
          },
          arabicGrammarSummary: {
            type: Type.OBJECT,
            properties: {
              nahwuSummary: { type: Type.STRING },
              sharafSummary: { type: Type.STRING },
              sentenceStructure: { type: Type.STRING },
              contextWarning: { type: Type.STRING },
            },
          },
          englishGrammarSummary: {
            type: Type.OBJECT,
            properties: {
              grammarSummary: { type: Type.STRING },
              tenseIdentification: { type: Type.STRING },
              subjectVerbObject: {
                type: Type.OBJECT,
                properties: {
                  subject: { type: Type.STRING },
                  verb: { type: Type.STRING },
                  object: { type: Type.STRING },
                },
              },
              sentenceStructure: { type: Type.STRING },
            },
          },
          paragraphSummary: { type: Type.STRING },
          learnMore: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                exampleTarget: { type: Type.STRING },
                transliteration: { type: Type.STRING },
                indonesian: { type: Type.STRING },
                simpleExplanation: { type: Type.STRING },
              },
              required: ['title', 'exampleTarget', 'indonesian', 'simpleExplanation'],
            },
          },
          miniExercises: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING },
              },
              required: ['question', 'options', 'correctIndex', 'explanation'],
            },
          },
        },
        required: [
          'detectedLanguage',
          'introMessage',
          'grammarErrors',
          'sentenceTranslations',
          'wordByWord',
          'keyVocabulary',
          'learnMore',
        ],
      };

      const repairMissingTranslations = async (
        missingEntries: Array<{ index: number; sentence: string }>
      ): Promise<Map<number, { indonesianOriginal: string; ambiguousNote?: string }>> => {
        const result = new Map<number, { indonesianOriginal: string; ambiguousNote?: string }>();
        if (missingEntries.length === 0) return result;
        try {
          const numbered = missingEntries.map((m) => `[${m.index}] ${m.sentence}`).join('\n');
          const repairResp = await generateContentWithRetry(ai, {
            model: MODEL_NAME,
            contents: `Terjemahkan SEMUA kalimat bernomor berikut ke Bahasa Indonesia secara lengkap, akurat, kata-per-kata sesuai konteks (jangan disingkat dan jangan lewati satu klausa pun):\n${numbered}`,
            config: {
              systemInstruction: PINDAMAI_PERSONALITY,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        index: { type: Type.INTEGER },
                        indonesianOriginal: { type: Type.STRING },
                        ambiguousNote: { type: Type.STRING },
                      },
                      required: ['index', 'indonesianOriginal'],
                    },
                  },
                },
                required: ['items'],
              },
            },
          });
          const parsedRepair = JSON.parse((repairResp.text ?? '{}').trim()) as {
            items?: Array<{ index: number; indonesianOriginal: string; ambiguousNote?: string }>;
          };
          for (const item of parsedRepair.items || []) {
            if (typeof item.index === 'number' && item.indonesianOriginal?.trim()) {
              result.set(item.index, {
                indonesianOriginal: item.indonesianOriginal.trim(),
                ambiguousNote: item.ambiguousNote?.trim() || undefined,
              });
            }
          }
        } catch {
          // If repair fails, leave missing so caller tracks honestly via unprocessedNotice
        }
        return result;
      };

      let detectedLanguage: 'arabic' | 'english' | 'mixed' = language === 'auto' ? 'english' : language;
      let introMessage = '';
      const normalizedHarakatParts: string[] = [];
      const transliterationParts: string[] = [];
      const allGrammarErrors: NonNullable<ChunkOutput['grammarErrors']> = [];
      const allSentenceItems: ChunkSentenceItem[] = [];
      const allWordByWord: NonNullable<ChunkOutput['wordByWord']> = [];
      const allKeyVocab: NonNullable<ChunkOutput['keyVocabulary']> = [];
      const allLearnMore: NonNullable<ChunkOutput['learnMore']> = [];
      const allMiniExercises: NonNullable<ChunkOutput['miniExercises']> = [];
      let arabicGrammarSummary: ChunkOutput['arabicGrammarSummary'] | undefined;
      let englishGrammarSummary: ChunkOutput['englishGrammarSummary'] | undefined;
      const paragraphSummaries: string[] = [];
      let previousContext = '';
      let globalOffset = 0;
      let failedChunkStartSentence: number | null = null;

      for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
        const chunkSentences = chunks[chunkIdx];
        const numberedList = chunkSentences
          .map((s, idx) => `${idx + 1}. ${s}`)
          .join('\n');

        const prompt = `
Kamu adalah PINDAMAI AI Language Tutor (CHECK -> CORRECT -> TRANSLATE -> EXPLAIN -> ANALYZE).
Analisis bagian ${chunkIdx + 1} dari ${chunks.length} teks pengguna berikut:
Preferensi bahasa pengguna: ${language}
Tingkat penjelasan: ${levelGuide}
${simplifyGuide}
${previousContext ? `Konteks bagian sebelumnya (untuk menjaga konsistensi terjemahan tanpa mengulang teks lama):\n${previousContext}\n` : ''}

DAFTAR KALIMAT SUMBER (TOTAL ${chunkSentences.length} KALIMAT):
${numberedList}

ATURAN WAJIB #1 — CEK & KOREKSI GRAMMAR (JANGAN MENGASUMSIKAN TEKS SUDAH BENAR!):
- Periksa SETIAP kalimat sumber dengan teliti sebelum menerjemahkan.
- Untuk Bahasa Inggris: cek grammatical errors, spelling mistakes, incorrect verb forms, subject-verb agreement (mis. "She go" -> "She goes"), incorrect tenses, word order, missing/unnecessary articles & prepositions, dan punctuation.
- Untuk Bahasa Arab: cek struktur gramatikal salah, word order, bentuk kata (shighah) tidak tepat, kesalahan Nahwu (i'rab/marfu'-manshub-majrur) & Sharaf, serta salah ketik/ejaan. Bedakan antara kesalahan grammar asli ("isStylisticOnly": false) dan saran gaya bahasa opsional ("isStylisticOnly": true).
- Jika suatu kalimat SUDAH BENAR secara tata bahasa, JANGAN mengarang kesalahan! Jika semua kalimat di bagian ini sudah benar, kembalikan "grammarErrors": [].
- Untuk setiap kesalahan di "grammarErrors", isi lengkap: originalSentence, correctedSentence, category (mis. "Subject-Verb Agreement", "Verb Form", "Nahwu / I'rab", "Spelling", dll.), explanation (dalam Bahasa Indonesia kasual lucu ala PINDAMAI, mis. "Nah, ketemu salahnya! Karena subject-nya 'She', verb-nya harus pakai -es. Jadi, 'go' berubah jadi 'goes'."), whyAppropriate (alasan linguistik kenapa koreksi ini tepat), dan isStylisticOnly.

ATURAN WAJIB #2 — TERJEMAHAN LENGKAP 1-PER-1 (TIDAK BOLEH ADA YANG DILEWATI!):
- "sentenceTranslations" WAJIB berisi TEPAT ${chunkSentences.length} item berurutan dengan "index": 1 sampai ${chunkSentences.length}.
- Setiap item harus menerjemahkan SELURUH klausa di kalimat tersebut ke Bahasa Indonesia secara natural, lengkap, dan berurutan. JANGAN meringkas, JANGAN memotong klausa (mis. jika ada 3 klausa berangkai dalam 1 kalimat Arab/Inggris, terjemahkan ketiganya secara utuh!), dan JANGAN melewati kalimat mana pun!
- Isi "correctedSentence" dengan versi yang sudah diperbaiki (atau sama persis dengan "originalSentence" jika sudah benar).
- Jika kalimat mengalami koreksi grammar, isi "indonesianCorrected" dengan terjemahan versi yang sudah diperbaiki; jika sama saja dengan aslinya, kosongkan atau samakan.
- Jika ada ungkapan ambigu/idiomatik, jelaskan di "ambiguousNote".

ATURAN WAJIB #3 — ANALISIS PER KALIMAT, KOSAKATA & LEARN MORE (TIDAK BOLEH KOSONG!):
- Untuk SETIAP item di "sentenceTranslations":
  - Jika kalimat Inggris (atau mengandung Inggris): WAJIB isi objek "englishBreakdown" lengkap (subject, verb, object, complementOrAdverbial, tense, sentencePattern). Jangan kembalikan null!
  - Jika kalimat Arab (atau mengandung Arab): WAJIB isi objek "arabicBreakdown" lengkap (nahwu, sharaf, irab yang didukung konteks, sentenceStructure, dan wordByWord [{word, meaning, role}]). Jangan kembalikan null!
- Jika teks berbahasa Inggris: WAJIB isi "englishGrammarSummary" (grammarSummary, tenseIdentification, subjectVerbObject, sentenceStructure).
- Jika teks berbahasa Arab: WAJIB isi "arabicGrammarSummary" (nahwuSummary, sharafSummary, sentenceStructure, contextWarning) serta "normalizedWithHarakat" (berharakat lengkap) dan "transliteration".
- WAJIB isi "keyVocabulary" minimal 2-5 kata penting dari teks (JANGAN pernah array kosong []), masing-masing lengkap dengan word, harakatOrOriginal, transliteration (jika Arab), english (jika ada), indonesian, partOfSpeech, contextualMeaning, exampleSentence, dan explanation.
- WAJIB isi "wordByWord" minimal 3-8 kata penting dari teks ini (JANGAN array kosong []).
- WAJIB isi "learnMore" minimal 2-3 contoh kalimat tambahan yang relevan & penjelasan singkat sederhana (JANGAN array kosong []).
${chunkIdx === 0 ? '- WAJIB isi 2-3 "miniExercises" pilihan ganda untuk latihan cepat sesuai isi teks ini.' : ''}
${chunkIdx === 0 && totalSourceSentences >= 2 ? '- Karena teks multi-kalimat, WAJIB isi "paragraphSummary" yang merangkum alur maknanya.' : ''}
`;

        try {
          const response = await generateContentWithRetry(ai, {
            model: MODEL_NAME,
            contents: prompt,
            config: {
              systemInstruction: PINDAMAI_PERSONALITY,
              responseMimeType: 'application/json',
              responseSchema: chunkSchema,
            },
          });

          const parsed = JSON.parse((response.text ?? '{}').trim()) as ChunkOutput;
          const chunkLangRaw = parsed.detectedLanguage?.toLowerCase();
          const chunkLang: 'arabic' | 'english' | 'mixed' | undefined =
            chunkLangRaw === 'arabic' || chunkLangRaw === 'english' || chunkLangRaw === 'mixed'
              ? chunkLangRaw
              : undefined;
          if (chunkIdx === 0) {
            if (chunkLang) detectedLanguage = chunkLang;
            if (parsed.introMessage) introMessage = parsed.introMessage;
            arabicGrammarSummary = parsed.arabicGrammarSummary;
            englishGrammarSummary = parsed.englishGrammarSummary;
          } else if (chunkLang && chunkLang !== detectedLanguage) {
            detectedLanguage = 'mixed';
          }

          if (parsed.normalizedWithHarakat?.trim()) {
            normalizedHarakatParts.push(parsed.normalizedWithHarakat.trim());
          }
          if (parsed.transliteration?.trim()) {
            transliterationParts.push(parsed.transliteration.trim());
          }
          if (parsed.paragraphSummary?.trim()) {
            paragraphSummaries.push(parsed.paragraphSummary.trim());
          }
          if (Array.isArray(parsed.grammarErrors)) {
            allGrammarErrors.push(...parsed.grammarErrors);
          }
          if (Array.isArray(parsed.wordByWord)) {
            allWordByWord.push(...parsed.wordByWord);
          }
          if (Array.isArray(parsed.keyVocabulary)) {
            allKeyVocab.push(...parsed.keyVocabulary);
          }
          if (Array.isArray(parsed.learnMore) && allLearnMore.length < 4) {
            allLearnMore.push(...parsed.learnMore);
          }
          if (chunkIdx === 0 && Array.isArray(parsed.miniExercises)) {
            allMiniExercises.push(...parsed.miniExercises);
          }

          // Match each source sentence in this chunk 1-to-1 by index (1..K) or position
          const returnedByIndex = new Map<number, ChunkSentenceItem>();
          (parsed.sentenceTranslations || []).forEach((st, arrIdx) => {
            const idx =
              typeof st.index === 'number' && st.index >= 1 && st.index <= chunkSentences.length
                ? st.index
                : arrIdx + 1;
            if (!returnedByIndex.has(idx)) {
              returnedByIndex.set(idx, st);
            }
          });

          // Check for any skipped or empty translations in this chunk
          const missingInChunk: Array<{ index: number; sentence: string }> = [];
          for (let i = 1; i <= chunkSentences.length; i++) {
            const entry = returnedByIndex.get(i);
            if (!entry || !entry.indonesianOriginal?.trim()) {
              missingInChunk.push({ index: i, sentence: chunkSentences[i - 1] });
            }
          }

          let repairedMap = new Map<number, { indonesianOriginal: string; ambiguousNote?: string }>();
          if (missingInChunk.length > 0) {
            repairedMap = await repairMissingTranslations(missingInChunk);
          }

          for (let i = 1; i <= chunkSentences.length; i++) {
            const src = chunkSentences[i - 1];
            const entry = returnedByIndex.get(i);
            const repaired = repairedMap.get(i);
            const finalIndonesian =
              entry?.indonesianOriginal?.trim() || repaired?.indonesianOriginal || '';

            allSentenceItems.push({
              index: globalOffset + i,
              originalSentence: src,
              correctedSentence: entry?.correctedSentence?.trim() || src,
              language: entry?.language || detectedLanguage,
              indonesianOriginal: finalIndonesian,
              indonesianCorrected: entry?.indonesianCorrected?.trim() || undefined,
              ambiguousNote: entry?.ambiguousNote?.trim() || repaired?.ambiguousNote || undefined,
              englishBreakdown: entry?.englishBreakdown || undefined,
              arabicBreakdown: entry?.arabicBreakdown || undefined,
            });
          }

          previousContext = chunkSentences
            .slice(-2)
            .map((s, i) => {
              const lastIdx = allSentenceItems.length - (chunkSentences.slice(-2).length - i);
              const tr = allSentenceItems[lastIdx]?.indonesianOriginal || '';
              return `${s} -> ${tr}`;
            })
            .join('\n');

          globalOffset += chunkSentences.length;
        } catch (chunkErr) {
          if (chunkIdx === 0) {
            throw chunkErr;
          }
          // Partial multi-chunk failure: preserve completed chunks transparently
          failedChunkStartSentence = globalOffset + 1;
          break;
        }
      }

      // Deduplicate vocabulary by lowercase word
      const seenVocab = new Set<string>();
      const uniqueKeyVocab = allKeyVocab.filter((v) => {
        const key = (v.harakatOrOriginal || v.word || '').trim().toLowerCase();
        if (!key || seenVocab.has(key)) return false;
        seenVocab.add(key);
        return true;
      });

      const realErrors = allGrammarErrors.filter((e) => !e.isStylisticOnly);
      const stylisticNotes = allGrammarErrors.filter((e) => e.isStylisticOnly);
      const hasErrors = realErrors.length > 0;
      const hasStylisticSuggestions = stylisticNotes.length > 0;

      const correctedFullText = allSentenceItems
        .map((s) => s.correctedSentence || s.originalSentence)
        .join(' ')
        .trim();

      const translatedCount = allSentenceItems.filter((s) => s.indonesianOriginal.trim().length > 0).length;
      const isComplete =
        failedChunkStartSentence === null && translatedCount === totalSourceSentences;

      const originalFullTranslation = allSentenceItems
        .map((s) => s.indonesianOriginal.trim())
        .filter(Boolean)
        .join(' ');

      const correctedFullTranslation = hasErrors
        ? allSentenceItems
            .map((s) => (s.indonesianCorrected?.trim() || s.indonesianOriginal.trim()))
            .filter(Boolean)
            .join(' ')
        : undefined;

      const ambiguousExpressions = allSentenceItems
        .filter((s) => s.ambiguousNote)
        .map((s) => ({
          expression: s.originalSentence,
          note: s.ambiguousNote as string,
        }));

      let unprocessedNotice: string | undefined;
      if (failedChunkStartSentence !== null) {
        unprocessedNotice = `Ups, terjemahannya sempat terhenti di kalimat ke-${failedChunkStartSentence} dari ${totalSourceSentences} kalimat. Coba analisis bagian sisanya ya supaya nggak ada yang ketinggalan!`;
      } else if (!isComplete) {
        unprocessedNotice = `Ups, baru ${translatedCount} dari ${totalSourceSentences} kalimat yang berhasil diterjemahkan lengkap. Coba klik Analisis Sekarang lagi ya supaya nggak ada kalimat yang ketinggalan.`;
      }

      const statusMessage = hasErrors
        ? `Nah, ketemu ${realErrors.length} catatan grammar yang perlu diperbaiki supaya makin pas!`
        : hasStylisticSuggestions
          ? 'Secara tata bahasa sudah benar nih! Ada sedikit catatan gaya bahasa opsional di bawah kalau mau terdengar lebih natural.'
          : 'Mantap! Nggak ada kesalahan grammar yang berarti — kalimatmu sudah benar secara tata bahasa.';

      const isParagraph = totalSourceSentences >= 2 || rawText.split(/\s+/).length >= 18;

      const responsePayload = {
        detectedLanguage,
        introMessage:
          introMessage ||
          (hasErrors
            ? 'Okeey! PINDAMAI udah cek teks kamu dari ujung ke ujung—ada beberapa bagian yang kita rapikan bareng ya!'
            : 'Wih, cakep! Teks kamu udah diperiksa lengkap beserta terjemahan dan bedah bahasanya nih!'),
        isParagraph,
        originalText: rawText,
        normalizedWithHarakat: normalizedHarakatParts.join(' ').trim() || undefined,
        transliteration: transliterationParts.join(' ').trim() || undefined,
        indonesianTranslation:
          originalFullTranslation ||
          'Ups, terjemahannya belum lengkap nih. Coba kita proses lagi supaya nggak ada kalimat yang ketinggalan.',
        grammarCheck: {
          hasErrors,
          hasStylisticSuggestions,
          statusMessage,
          correctedText: hasErrors ? correctedFullText || rawText : rawText,
          errors: allGrammarErrors,
        },
        translation: {
          originalFullTranslation,
          correctedFullTranslation,
          sourceSentenceCount: totalSourceSentences,
          translatedSentenceCount: translatedCount,
          isComplete,
          ambiguousExpressions,
          unprocessedNotice,
          sentencePairs: allSentenceItems.map((s) => ({
            index: s.index,
            original: s.originalSentence,
            corrected: s.correctedSentence !== s.originalSentence ? s.correctedSentence : undefined,
            indonesianOriginal: s.indonesianOriginal,
            indonesianCorrected: s.indonesianCorrected,
            ambiguousNote: s.ambiguousNote,
          })),
        },
        sentenceAnalyses: allSentenceItems.map((s) => ({
          originalSentence: s.originalSentence,
          correctedSentence:
            s.correctedSentence !== s.originalSentence ? s.correctedSentence : undefined,
          language: s.language,
          indonesianTranslation: s.indonesianOriginal,
          englishBreakdown: s.englishBreakdown || null,
          arabicBreakdown: s.arabicBreakdown || null,
        })),
        learnMore: allLearnMore.slice(0, 4),
        wordByWord: allWordByWord.slice(0, 36),
        keyVocabulary: uniqueKeyVocab.slice(0, 18),
        arabicGrammar: arabicGrammarSummary || null,
        englishGrammar: englishGrammarSummary || null,
        paragraphBreakdown: isParagraph
          ? {
              sentences: allSentenceItems.map((s) => ({
                original: s.originalSentence,
                translation: s.indonesianOriginal,
                structureNote:
                  s.englishBreakdown?.sentencePattern ||
                  s.arabicBreakdown?.sentenceStructure ||
                  s.arabicBreakdown?.nahwu ||
                  s.englishBreakdown?.tense ||
                  '',
              })),
              summary:
                paragraphSummaries.join(' ') ||
                'Semua kalimat sudah dibedah secara lengkap dari awal sampai akhir.',
              miniExercises: allMiniExercises.slice(0, 3),
            }
          : null,
        exampleSentences: allLearnMore.slice(0, 3).map((lm) => ({
          target: lm.exampleTarget,
          transliteration: lm.transliteration,
          indonesian: lm.indonesian,
        })),
      };

      return res.json(responsePayload);
    } catch (error) {
      return handleAiError(res, error, 'Gagal menganalisis teks');
    }
  });

  // 3. Practice & "Learn From My Scan" Generator
  app.post('/api/ai/generate-practice', async (req: Request, res: Response) => {
    try {
      const {
        mode = 'multiple_choice',
        sourceText,
        vocabularyList = [],
        count = 5,
        category,
        targetLanguage = 'all',
      } = req.body as {
        mode?:
          | 'multiple_choice'
          | 'match'
          | 'fill_blank'
          | 'translate_sentence'
          | 'arrange_words'
          | 'flashcards'
          | 'summary';
        sourceText?: string;
        vocabularyList?: Array<{
          arabic?: string;
          transliteration?: string;
          english?: string;
          indonesian: string;
        }>;
        count?: number;
        category?: string;
        targetLanguage?: 'all' | 'arabic' | 'english';
      };

      if (!sourceText && vocabularyList.length === 0) {
        return res.status(400).json({
          error: 'Belum ada bahan latihan nih! Scan sesuatu dulu atau simpan minimal beberapa kosakata ya.',
        });
      }

      const ai = createGeminiClient();
      const contextBlock = [
        sourceText ? `Teks hasil scan:\n"""${sourceText}"""` : '',
        vocabularyList.length > 0
          ? `Daftar kosakata pengguna:\n${JSON.stringify(vocabularyList.slice(0, 20))}`
          : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const langConstraint =
        targetLanguage === 'arabic'
          ? 'Fokus soal dan kosakata HANYA untuk Bahasa Arab (lengkapi dengan harakat!).'
          : targetLanguage === 'english'
            ? 'Fokus soal dan kosakata HANYA untuk Bahasa Inggris.'
            : 'Campurkan Bahasa Arab (berharakat) dan Bahasa Inggris secara seimbang.';

      const categoryConstraint =
        category && category !== 'all' ? `Fokus topik/kategori: ${category}.` : '';

      const prompt = `
Buat materi latihan interaktif PINDAMAI mode "${mode}" sebanyak ${count} item berdasarkan materi pengguna berikut:
${contextBlock}

${langConstraint}
${categoryConstraint}

Aturan struktur WAJIB (jangan pernah mengembalikan array kosong untuk mode yang dipilih):
- Selalu isi "introNote" (kalimat penyemangat santai & lucu dari PINDAMAI).
- Jika mode = "summary": isi "summaryText" (ringkasan seru & mudah diingat), "keyPoints" (3-5 poin penting), dan 3 "multipleChoice" cepat.
- Jika mode = "flashcards": isi "flashcards" (array ${count} kartu: front, back, transliteration, hint, example).
- Jika mode = "multiple_choice": isi "multipleChoice" (array ${count} soal: question, promptWord, options [4 pilihan wajib], correctIndex [0-3], explanation dalam gaya santai PINDAMAI).
- Jika mode = "match": isi "matchPairs" (array ${Math.min(6, Math.max(4, count))} pasangan: id unik, left [kata Arab berharakat atau Inggris], right [arti Indonesia], note).
- Jika mode = "fill_blank": isi "fillBlanks" (array ${count} soal: sentenceWithBlank [pakai ___ untuk bagian kosong], translationHint, options [4 pilihan kata wajib], answer, explanation).
- Jika mode = "translate_sentence": isi "translateSentences" (array ${count} soal: sourceSentence, sourceLanguage, targetLanguage, referenceTranslation, acceptableKeywords [array kata kunci penting], explanation).
- Jika mode = "arrange_words": isi "arrangeWords" (array ${count} soal: promptIndonesian, targetSentence, tokens [array minimal 3 kata/potongan kalimat dalam urutan BENAR—frontend yang akan mengacaknya], language ['arabic'|'english'], explanation).

PENTING: Bahasa Arab wajib berharakat lengkap dan akurat. Penjelasan menggunakan Bahasa Indonesia kasual PINDAMAI (ramah saat benar, menyemangati saat salah).
`;

      const schemaByMode = (() => {
        if (mode === 'flashcards') {
          return {
            type: Type.OBJECT,
            properties: {
              introNote: { type: Type.STRING },
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    front: { type: Type.STRING },
                    back: { type: Type.STRING },
                    transliteration: { type: Type.STRING },
                    hint: { type: Type.STRING },
                    example: { type: Type.STRING },
                  },
                  required: ['front', 'back'],
                },
              },
            },
            required: ['introNote', 'flashcards'],
          };
        }
        if (mode === 'match') {
          return {
            type: Type.OBJECT,
            properties: {
              introNote: { type: Type.STRING },
              matchPairs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    left: { type: Type.STRING },
                    right: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                  required: ['id', 'left', 'right'],
                },
              },
            },
            required: ['introNote', 'matchPairs'],
          };
        }
        if (mode === 'fill_blank') {
          return {
            type: Type.OBJECT,
            properties: {
              introNote: { type: Type.STRING },
              fillBlanks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sentenceWithBlank: { type: Type.STRING },
                    translationHint: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    answer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['sentenceWithBlank', 'options', 'answer', 'explanation'],
                },
              },
            },
            required: ['introNote', 'fillBlanks'],
          };
        }
        if (mode === 'translate_sentence') {
          return {
            type: Type.OBJECT,
            properties: {
              introNote: { type: Type.STRING },
              translateSentences: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sourceSentence: { type: Type.STRING },
                    sourceLanguage: { type: Type.STRING },
                    targetLanguage: { type: Type.STRING },
                    referenceTranslation: { type: Type.STRING },
                    acceptableKeywords: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    explanation: { type: Type.STRING },
                  },
                  required: ['sourceSentence', 'referenceTranslation', 'acceptableKeywords', 'explanation'],
                },
              },
            },
            required: ['introNote', 'translateSentences'],
          };
        }
        if (mode === 'arrange_words') {
          return {
            type: Type.OBJECT,
            properties: {
              introNote: { type: Type.STRING },
              arrangeWords: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    promptIndonesian: { type: Type.STRING },
                    targetSentence: { type: Type.STRING },
                    tokens: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    language: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['promptIndonesian', 'targetSentence', 'tokens', 'language', 'explanation'],
                },
              },
            },
            required: ['introNote', 'arrangeWords'],
          };
        }
        if (mode === 'summary') {
          return {
            type: Type.OBJECT,
            properties: {
              introNote: { type: Type.STRING },
              summaryText: { type: Type.STRING },
              keyPoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              multipleChoice: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    promptWord: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                  },
                  required: ['question', 'options', 'correctIndex', 'explanation'],
                },
              },
            },
            required: ['introNote', 'summaryText', 'keyPoints', 'multipleChoice'],
          };
        }
        return {
          type: Type.OBJECT,
          properties: {
            introNote: { type: Type.STRING },
            multipleChoice: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  promptWord: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: ['question', 'options', 'correctIndex', 'explanation'],
              },
            },
          },
          required: ['introNote', 'multipleChoice'],
        };
      })();

      const response = await generateContentWithRetry(ai, {
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction: PINDAMAI_PERSONALITY,
          responseMimeType: 'application/json',
          responseSchema: schemaByMode,
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      return res.json({ ...parsed, mode });
    } catch (error) {
      return handleAiError(res, error, 'Gagal membuat latihan interaktif');
    }
  });

  // 4. Server-side Gemini TTS Fallback (especially for Arabic & unsupported browsers)
  app.post('/api/ai/tts', async (req: Request, res: Response) => {
    try {
      const { text, lang = 'ar', slow = false } = req.body as {
        text?: string;
        lang?: 'ar' | 'en' | 'id';
        slow?: boolean;
      };

      if (!text || !text.trim()) {
        return res.status(400).json({ error: 'Teks untuk dibacakan masih kosong.' });
      }

      const apiKey = getConfiguredApiKey();
      if (!apiKey) {
        const err = new Error('GEMINI_API_KEY_MISSING');
        (err as Error & { statusCode?: number; needsConfig?: boolean }).statusCode = 503;
        (err as Error & { statusCode?: number; needsConfig?: boolean }).needsConfig = true;
        throw err;
      }

      const ai = new GoogleGenAI({
        apiKey,
        apiVersion: 'v1beta',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      const langLabel =
        lang === 'ar'
          ? 'Modern Standard Arabic with clear harakat pronunciation'
          : lang === 'id'
            ? 'Indonesian'
            : 'English';

      const styleInstruction = slow
        ? `Clear, slow, and well-articulated ${langLabel} pronunciation for a language learner`
        : `Clear, natural ${langLabel} pronunciation`;

      let ttsResponse;
      try {
        ttsResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: text.trim().slice(0, 800),
                  speechMetadata: {
                    style: styleInstruction,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: lang === 'ar' ? 'Charon' : 'Kore',
                },
              },
            },
          },
        });
      } catch (metaErr) {
        // Retry without speechMetadata if the gateway rejects that optional part field
        const metaMsg = metaErr instanceof Error ? metaErr.message : '';
        if (metaMsg.includes('speechMetadata')) {
          ttsResponse = await ai.models.generateContent({
            model: 'gemini-3.8-flash-lite-tts',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `${styleInstruction}: ${text.trim().slice(0, 800)}`,
                  },
                ],
              },
            ],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: lang === 'ar' ? 'Charon' : 'Kore',
                  },
                },
              },
            },
          });
        } else {
          throw metaErr;
        }
      }

      const base64Audio =
        ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        return res.status(502).json({
          error: 'Suara TTS belum berhasil dibuat oleh server AI. Coba lagi ya!',
        });
      }

      return res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (error) {
      return handleAiError(res, error, 'Gagal menghasilkan audio pengucapan');
    }
  });

  const httpServer = http.createServer(app);

  // Vite middleware in dev, static serving in prod
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const hmrDisabled =
      process.env.DISABLE_HMR === 'true' || Boolean(process.env.APP_URL) || Boolean(process.env.K_SERVICE);

    if (hmrDisabled) {
      app.get('/@vite/client', (_req: Request, res: Response) => {
        res.type('application/javascript').send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
      if (el.getAttribute('data-vite-dev-id') === id) el.remove();
    });
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    invalidate() {},
    decline() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return pathname + '?' + queryToInject + (search ? '&' + search.slice(1) : '') + (hash || '');
}
export class ErrorOverlay extends HTMLElement {}
`);
      });
    }

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PINDAMAI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
