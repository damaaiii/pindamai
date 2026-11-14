import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type {
  AppSettings,
  LearningProgress,
  PracticeResultItem,
  ScanHistoryItem,
  VocabularyItem,
} from '../types/pindamai';

interface PindamaiDB extends DBSchema {
  vocabulary: {
    key: string;
    value: VocabularyItem;
    indexes: {
      'by-created': number;
      'by-category': string;
      'by-status': string;
    };
  };
  scanHistory: {
    key: string;
    value: ScanHistoryItem;
    indexes: {
      'by-created': number;
    };
  };
  practiceResults: {
    key: string;
    value: PracticeResultItem;
    indexes: {
      'by-created': number;
    };
  };
  meta: {
    key: string;
    value: unknown;
  };
}

const DB_NAME = 'pindamai-local-db';
const DB_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  interfaceLanguage: 'id',
  defaultLearningLanguage: 'both',
  defaultExplanationLevel: 'beginner',
  soundEffectsEnabled: true,
  speechRate: 0.92,
};

export const DEFAULT_PROGRESS: LearningProgress = {
  totalScans: 0,
  totalPracticeSessions: 0,
  streakDays: 1,
  lastActiveDate: new Date().toISOString().slice(0, 10),
  xpPoints: 0,
};

let dbPromise: Promise<IDBPDatabase<PindamaiDB>> | null = null;

function getDB(): Promise<IDBPDatabase<PindamaiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PindamaiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('vocabulary')) {
          const vocabStore = db.createObjectStore('vocabulary', { keyPath: 'id' });
          vocabStore.createIndex('by-created', 'createdAt');
          vocabStore.createIndex('by-category', 'category');
          vocabStore.createIndex('by-status', 'status');
        }
        if (!db.objectStoreNames.contains('scanHistory')) {
          const scanStore = db.createObjectStore('scanHistory', { keyPath: 'id' });
          scanStore.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('practiceResults')) {
          const pracStore = db.createObjectStore('practiceResults', { keyPath: 'id' });
          pracStore.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
      },
    });
  }
  return dbPromise;
}

export async function getAllVocabulary(): Promise<VocabularyItem[]> {
  const db = await getDB();
  const items = await db.getAll('vocabulary');
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveVocabulary(item: VocabularyItem): Promise<void> {
  const db = await getDB();
  await db.put('vocabulary', item);
}

export async function deleteVocabulary(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('vocabulary', id);
}

export async function getAllScanHistory(): Promise<ScanHistoryItem[]> {
  const db = await getDB();
  const items = await db.getAll('scanHistory');
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveScanHistory(item: ScanHistoryItem): Promise<void> {
  const db = await getDB();
  await db.put('scanHistory', item);
  await bumpProgress({ totalScans: 1, xpPoints: 15 });
}

export async function deleteScanHistory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('scanHistory', id);
}

export async function getAllPracticeResults(): Promise<PracticeResultItem[]> {
  const db = await getDB();
  const items = await db.getAll('practiceResults');
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function savePracticeResult(item: PracticeResultItem): Promise<void> {
  const db = await getDB();
  await db.put('practiceResults', item);
  const earnedXp = Math.max(10, item.score * 10);
  await bumpProgress({ totalPracticeSessions: 1, xpPoints: earnedXp });
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDB();
  const saved = (await db.get('meta', 'settings')) as Partial<AppSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(saved || {}) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDB();
  await db.put('meta', settings, 'settings');
}

export async function getProgress(): Promise<LearningProgress> {
  const db = await getDB();
  const saved = (await db.get('meta', 'progress')) as Partial<LearningProgress> | undefined;
  return { ...DEFAULT_PROGRESS, ...(saved || {}) };
}

export async function bumpProgress(delta: {
  totalScans?: number;
  totalPracticeSessions?: number;
  xpPoints?: number;
}): Promise<LearningProgress> {
  const db = await getDB();
  const current = await getProgress();
  const today = new Date().toISOString().slice(0, 10);
  let streakDays = current.streakDays || 1;
  if (current.lastActiveDate !== today) {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    streakDays = current.lastActiveDate === yesterday ? streakDays + 1 : 1;
  }
  const updated: LearningProgress = {
    totalScans: current.totalScans + (delta.totalScans || 0),
    totalPracticeSessions: current.totalPracticeSessions + (delta.totalPracticeSessions || 0),
    xpPoints: current.xpPoints + (delta.xpPoints || 0),
    streakDays,
    lastActiveDate: today,
  };
  await db.put('meta', updated, 'progress');
  return updated;
}

export interface PindamaiBackupPayload {
  app: 'PINDAMAI';
  version: number;
  exportedAt: string;
  vocabulary: VocabularyItem[];
  scanHistory: ScanHistoryItem[];
  practiceResults: PracticeResultItem[];
  settings: AppSettings;
  progress: LearningProgress;
}

export async function exportAllData(): Promise<PindamaiBackupPayload> {
  const [vocabulary, scanHistory, practiceResults, settings, progress] = await Promise.all([
    getAllVocabulary(),
    getAllScanHistory(),
    getAllPracticeResults(),
    getSettings(),
    getProgress(),
  ]);
  return {
    app: 'PINDAMAI',
    version: 1,
    exportedAt: new Date().toISOString(),
    vocabulary,
    scanHistory,
    practiceResults,
    settings,
    progress,
  };
}

export async function importAllData(raw: unknown): Promise<{ importedVocab: number; importedScans: number }> {
  if (!raw || typeof raw !== 'object') {
    throw new Error('File backup tidak valid nih.');
  }
  const data = raw as Partial<PindamaiBackupPayload>;
  if (data.app !== 'PINDAMAI') {
    throw new Error('Sepertinya ini bukan file backup PINDAMAI ya.');
  }
  const db = await getDB();
  const vocabList = Array.isArray(data.vocabulary) ? data.vocabulary : [];
  const scanList = Array.isArray(data.scanHistory) ? data.scanHistory : [];
  const pracList = Array.isArray(data.practiceResults) ? data.practiceResults : [];

  const tx = db.transaction(['vocabulary', 'scanHistory', 'practiceResults', 'meta'], 'readwrite');
  for (const v of vocabList) {
    if (v && v.id) await tx.objectStore('vocabulary').put(v);
  }
  for (const s of scanList) {
    if (s && s.id) await tx.objectStore('scanHistory').put(s);
  }
  for (const p of pracList) {
    if (p && p.id) await tx.objectStore('practiceResults').put(p);
  }
  if (data.settings) {
    await tx.objectStore('meta').put({ ...DEFAULT_SETTINGS, ...data.settings }, 'settings');
  }
  if (data.progress) {
    await tx.objectStore('meta').put({ ...DEFAULT_PROGRESS, ...data.progress }, 'progress');
  }
  await tx.done;

  return {
    importedVocab: vocabList.length,
    importedScans: scanList.length,
  };
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['vocabulary', 'scanHistory', 'practiceResults', 'meta'], 'readwrite');
  await tx.objectStore('vocabulary').clear();
  await tx.objectStore('scanHistory').clear();
  await tx.objectStore('practiceResults').clear();
  await tx.objectStore('meta').clear();
  await tx.done;
}
