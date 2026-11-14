import type { VocabularyItem } from '../types/pindamai';

export interface DailyVocabEntry {
  id: string;
  arabicWord: string;
  arabicTransliteration: string;
  englishWord: string;
  indonesianMeaning: string;
  category: string;
  partOfSpeech: string;
  funNote: string;
  exampleArabic: string;
  exampleEnglish: string;
  exampleIndonesian: string;
}

const DAILY_POOL: DailyVocabEntry[] = [
  {
    id: 'daily-kitab',
    arabicWord: 'كِتَابٌ',
    arabicTransliteration: 'Kitābun',
    englishWord: 'Book',
    indonesianMeaning: 'Buku (benda wajib di tas pelajar sejati!)',
    category: 'Alat Tulis & Edukasi',
    partOfSpeech: 'Isim (Kata Benda)',
    funNote: 'Nah, ini nih kata Arab yang mirip banget sama bahasa Indonesia "kitab"! Bedanya, di bahasa Arab "kitābun" itu buku apa aja, dari komik sampai buku kuliah.',
    exampleArabic: 'أَقْرَأُ كِتَابًا جَدِيدًا كُلَّ يَوْمٍ.',
    exampleEnglish: 'I read a new book every day.',
    exampleIndonesian: 'Saya membaca sebuah buku baru setiap hari.',
  },
  {
    id: 'daily-qahwah',
    arabicWord: 'قَهْوَةٌ',
    arabicTransliteration: 'Qahwatun',
    englishWord: 'Coffee',
    indonesianMeaning: 'Kopi (bahan bakar anti-ngantuk saat belajar)',
    category: 'Makanan & Minuman',
    partOfSpeech: 'Isim (Kata Benda)',
    funNote: 'Fun fact! Kata "Coffee" di bahasa Inggris ternyata berakar dari kata Arab "Qahwah" lho. Jadi tiap ngopi, kamu lagi minum sejarah linguistik!',
    exampleArabic: 'أَشْرَبُ قَهْوَةً سَاخِنَةً فِي الصَّبَاحِ.',
    exampleEnglish: 'I drink hot coffee in the morning.',
    exampleIndonesian: 'Saya minum kopi hangat di pagi hari.',
  },
  {
    id: 'daily-shams',
    arabicWord: 'شَمْسٌ',
    arabicTransliteration: 'Syamsun',
    englishWord: 'Sun',
    indonesianMeaning: 'Matahari',
    category: 'Alam',
    partOfSpeech: 'Isim Muannats (Kata Benda Feminin)',
    funNote: 'Uniknya, di bahasa Arab kata "Syamsun" dianggap feminin (muannats) walaupun nggak pakai ta marbutah di belakangnya. Alam memang penuh kejutan!',
    exampleArabic: 'تُشْرِقُ الشَّمْسُ فِي السَّمَاءِ الصَّافِيَةِ.',
    exampleEnglish: 'The sun shines in the clear sky.',
    exampleIndonesian: 'Matahari bersinar di langit yang cerah.',
  },
  {
    id: 'daily-miftah',
    arabicWord: 'مِفْتَاحٌ',
    arabicTransliteration: 'Miftāḥun',
    englishWord: 'Key',
    indonesianMeaning: 'Kunci',
    category: 'Benda Rumah',
    partOfSpeech: 'Isim Alat (Kata Benda Alat)',
    funNote: 'Di ilmu Sharaf, pola "Mif‘āl" (مِفْعَال) sering dipakai untuk nama alat! Akar katanya F-T-Ḥ (membuka), jadi Miftāḥ = alat pembuka alias kunci. Easy peasy!',
    exampleArabic: 'أَيْنَ مِفْتَاحُ الْبَيْتِ؟',
    exampleEnglish: 'Where is the house key?',
    exampleIndonesian: 'Di mana kunci rumah?',
  },
  {
    id: 'daily-tuffahah',
    arabicWord: 'تُفَّاحَةٌ',
    arabicTransliteration: 'Tuffāḥatun',
    englishWord: 'Apple',
    indonesianMeaning: 'Apel (satu buah apel)',
    category: 'Makanan & Minuman',
    partOfSpeech: 'Isim (Kata Benda)',
    funNote: 'Tambahan "ـةٌ" (ta marbutah) di akhir kata "Tuffāḥatun" bikin artinya spesifik jadi SATU buah apel. Kalau banyak apel, cukup bilang "Tuffāḥun"!',
    exampleArabic: 'أَنَا آكُلُ تُفَّاحَةً حُلْوَةً.',
    exampleEnglish: 'I eat a sweet apple.',
    exampleIndonesian: 'Saya makan sebuah apel manis.',
  },
];

export function getDailyVocab(): DailyVocabEntry {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return DAILY_POOL[dayOfYear % DAILY_POOL.length];
}

export function dailyEntryToVocabItem(entry: DailyVocabEntry): VocabularyItem {
  const now = Date.now();
  return {
    id: `vocab-${entry.id}`,
    arabicWord: entry.arabicWord,
    arabicTransliteration: entry.arabicTransliteration,
    englishWord: entry.englishWord,
    indonesianMeaning: entry.indonesianMeaning,
    primaryLanguage: 'both',
    category: entry.category,
    partOfSpeech: entry.partOfSpeech,
    funNote: entry.funNote,
    exampleSentences: [
      {
        arabic: entry.exampleArabic,
        english: entry.exampleEnglish,
        indonesian: entry.exampleIndonesian,
      },
    ],
    isFavorite: false,
    status: 'learning',
    source: 'daily',
    createdAt: now,
    updatedAt: now,
  };
}
