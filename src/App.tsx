import { useCallback, useEffect, useState } from 'react';
import {
  Home,
  Camera,
  BookOpen,
  Bookmark,
  GraduationCap,
  Settings,
  Wifi,
  WifiOff,
  AlertCircle,
} from 'lucide-react';
import type {
  AppSettings,
  LanguageAnalysisResponse,
  LanguageChoice,
  LearningProgress,
  NavRoute,
  PracticeResultItem,
  ScanHistoryItem,
  VocabularyItem,
} from './types/pindamai';
import {
  DEFAULT_PROGRESS,
  DEFAULT_SETTINGS,
  deleteScanHistory,
  deleteVocabulary,
  getAllPracticeResults,
  getAllScanHistory,
  getAllVocabulary,
  getProgress,
  getSettings,
  savePracticeResult,
  saveScanHistory,
  saveSettings,
  saveVocabulary,
} from './lib/db';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { Logo } from './components/Logo';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { ScannerPage } from './pages/ScannerPage';
import { LearnPage } from './pages/LearnPage';
import { MyWordsPage } from './pages/MyWordsPage';
import { PracticePage } from './pages/PracticePage';
import { SettingsPage } from './pages/SettingsPage';

const NAV_ITEMS: Array<{
  id: NavRoute;
  label: string;
  mobileLabel: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'Home', mobileLabel: 'Home', icon: Home },
  { id: 'scanner', label: 'Scanner', mobileLabel: 'Scanner', icon: Camera },
  { id: 'learn', label: 'Learn', mobileLabel: 'Learn', icon: BookOpen },
  { id: 'my-words', label: 'My Words', mobileLabel: 'Words', icon: Bookmark },
  { id: 'practice', label: 'Practice', mobileLabel: 'Practice', icon: GraduationCap },
  { id: 'settings', label: 'Settings', mobileLabel: 'Settings', icon: Settings },
];

export default function App() {
  const isOnline = useOnlineStatus();
  const [route, setRoute] = useState<NavRoute>('home');
  const [scannerInitialMode, setScannerInitialMode] = useState<'text' | 'object'>('text');

  // Local IndexedDB state
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [practiceResults, setPracticeResults] = useState<PracticeResultItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState<LearningProgress>(DEFAULT_PROGRESS);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  // Cross-page navigation handoffs
  const [learnInitialText, setLearnInitialText] = useState('');
  const [learnInitialLang, setLearnInitialLang] = useState<LanguageChoice>('auto');
  const [learnInitialAnalysis, setLearnInitialAnalysis] = useState<LanguageAnalysisResponse | null>(
    null
  );
  const [learnAutoTrigger, setLearnAutoTrigger] = useState(false);

  const [practiceScanText, setPracticeScanText] = useState<string | undefined>(undefined);
  const [practiceScanTitle, setPracticeScanTitle] = useState<string | undefined>(undefined);

  // Toast notification
  const [toast, setToast] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const loadLocalData = useCallback(async () => {
    const [vocab, scans, prac, cfg, prog] = await Promise.all([
      getAllVocabulary(),
      getAllScanHistory(),
      getAllPracticeResults(),
      getSettings(),
      getProgress(),
    ]);
    setVocabulary(vocab);
    setScanHistory(scans);
    setPracticeResults(prac);
    setSettings(cfg);
    setProgress(prog);
  }, []);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  useEffect(() => {
    if (!isOnline) return;
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.aiConfigured === 'boolean') {
          setAiConfigured(d.aiConfigured);
        }
      })
      .catch(() => {
        // Ignore transient health check failure
      });
  }, [isOnline]);

  const handleSaveVocab = async (item: VocabularyItem) => {
    await saveVocabulary(item);
    await loadLocalData();
  };

  const handleDeleteVocab = async (id: string) => {
    await deleteVocabulary(id);
    await loadLocalData();
  };

  const handleSaveScanHistory = async (item: ScanHistoryItem) => {
    await saveScanHistory(item);
    await loadLocalData();
  };

  const handleDeleteScan = async (id: string) => {
    await deleteScanHistory(id);
    await loadLocalData();
  };

  const handleSavePracticeResult = async (res: PracticeResultItem) => {
    await savePracticeResult(res);
    await loadLocalData();
  };

  const handleUpdateSettings = async (next: AppSettings) => {
    await saveSettings(next);
    setSettings(next);
    notify('Pengaturan tersimpan!');
  };

  const handleOpenScanInLearn = (scan: ScanHistoryItem) => {
    if (scan.type === 'text') {
      setLearnInitialText(scan.rawText || scan.title);
      setLearnInitialLang(
        scan.language === 'arabic' ? 'arabic' : scan.language === 'english' ? 'english' : 'auto'
      );
      setLearnInitialAnalysis(scan.analysisResult || null);
      setLearnAutoTrigger(!scan.analysisResult);
    } else if (scan.objectResult?.objects?.length) {
      const obj = scan.objectResult.objects[0];
      setLearnInitialText(`${obj.arabicWord} (${obj.englishWord})`);
      setLearnInitialLang('auto');
      setLearnInitialAnalysis(null);
      setLearnAutoTrigger(true);
    }
    setRoute('learn');
  };

  const handlePracticeFromScan = (scan: ScanHistoryItem) => {
    const text =
      scan.rawText ||
      (scan.objectResult?.objects?.length
        ? scan.objectResult.objects
            .map((o) => `${o.arabicWord} (${o.englishWord} = ${o.indonesianName})`)
            .join(', ')
        : scan.summary);
    setPracticeScanText(text);
    setPracticeScanTitle(scan.title);
    setRoute('practice');
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] text-[#2B2226] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:sticky lg:top-0 lg:h-screen bg-white border-r border-[#EADFD5] p-5 justify-between">
        <div className="space-y-8">
          <div className="px-2 pt-1">
            <Logo size="md" />
          </div>

          <nav aria-label="Navigasi utama" className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = route === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setRoute(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-colors min-h-[46px] ${
                    active
                      ? 'bg-[#FCE9ED] text-[#2B2226]'
                      : 'text-[#5C4B51] hover:bg-[#FFF8F0] hover:text-[#2B2226]'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-[#A83B5A]' : ''}`} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-[#EADFD5]">
          <PWAInstallButton variant="compact" onNotify={notify} />
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#FFF8F0] text-xs font-medium text-[#5C4B51]">
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-[#3A6B3E]" />
                <span>Online · AI Siap</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-[#A83B5A]" />
                <span>Offline · Data Lokal</span>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar (scrolls naturally to respect mobile viewport space) */}
      <header className="lg:hidden flex items-center justify-between gap-4 px-4 py-3 bg-white border-b border-[#EADFD5]">
        <Logo size="sm" />
        <div className="flex items-center gap-2">
          <PWAInstallButton variant="compact" onNotify={notify} />
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C4B51] whitespace-nowrap">
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-[#3A6B3E]" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-[#A83B5A]" />
                <span>Offline</span>
              </>
            )}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-10 py-6 pb-24 lg:pb-10">
        <div className="max-w-6xl mx-auto space-y-6">
          {!isOnline && (
            <div className="p-3.5 rounded-2xl bg-[#FFF6D6] border border-[#F8E6A0] text-xs text-[#6B5416] flex items-center gap-2.5">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                Kamu lagi dalam mode Offline. Data My Words dan riwayat scan tetap bisa dibuka, sementara fitur AI (Object Scan, Analisis AI, Generate Kuis) butuh koneksi internet ya!
              </span>
            </div>
          )}

          {aiConfigured === false && (route === 'scanner' || route === 'learn' || route === 'practice') && (
            <div className="p-4 rounded-2xl bg-[#FCE9ED] border border-[#F6C9D5] text-xs text-[#7B233B] flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Catatan konfigurasi: <strong>GEMINI_API_KEY</strong> belum terdeteksi di server. Atur secret <code>GEMINI_API_KEY</code> di panel <strong>Settings &gt; Secrets</strong> supaya fitur AI Vision, Bedah Bahasa, dan Practice Generator berjalan penuh.
              </span>
            </div>
          )}

          <ErrorBoundary key={route} onReset={() => setRoute('home')}>
            {route === 'home' && (
              <HomePage
                vocabulary={vocabulary}
                scanHistory={scanHistory}
                progress={progress}
                settings={settings}
                onNavigate={setRoute}
                onStartScannerMode={(mode) => {
                  setScannerInitialMode(mode);
                  setRoute('scanner');
                }}
                onSaveVocab={handleSaveVocab}
                onOpenScanInLearn={handleOpenScanInLearn}
                onNotify={notify}
              />
            )}

            {route === 'scanner' && (
              <ScannerPage
                initialMode={scannerInitialMode}
                isOnline={isOnline}
                settings={settings}
                savedVocab={vocabulary}
                onSaveVocab={handleSaveVocab}
                onSaveScanHistory={handleSaveScanHistory}
                onOpenAnalysisInLearn={(txt, lang, existingAnalysis) => {
                  setLearnInitialText(txt);
                  setLearnInitialLang(lang);
                  setLearnInitialAnalysis(existingAnalysis || null);
                  setLearnAutoTrigger(!existingAnalysis);
                  setRoute('learn');
                }}
                onNotify={notify}
              />
            )}

            {route === 'learn' && (
              <LearnPage
                initialText={learnInitialText}
                initialLanguage={learnInitialLang}
                initialAnalysis={learnInitialAnalysis}
                autoTrigger={learnAutoTrigger}
                onConsumeAutoTrigger={() => setLearnAutoTrigger(false)}
                isOnline={isOnline}
                settings={settings}
                savedVocab={vocabulary}
                onSaveVocab={handleSaveVocab}
                onSaveScanHistory={handleSaveScanHistory}
                onPracticeFromText={(txt, title) => {
                  setPracticeScanText(txt);
                  setPracticeScanTitle(title);
                  setRoute('practice');
                }}
                onNotify={notify}
              />
            )}

            {route === 'my-words' && (
              <MyWordsPage
                vocabulary={vocabulary}
                scanHistory={scanHistory}
                settings={settings}
                onUpdateVocab={handleSaveVocab}
                onDeleteVocab={handleDeleteVocab}
                onDeleteScan={handleDeleteScan}
                onOpenScanInLearn={handleOpenScanInLearn}
                onPracticeFromScan={handlePracticeFromScan}
                onOpenTextInLearn={(txt) => {
                  setLearnInitialText(txt);
                  setLearnInitialLang('auto');
                  setLearnInitialAnalysis(null);
                  setLearnAutoTrigger(true);
                  setRoute('learn');
                }}
                onNotify={notify}
              />
            )}

            {route === 'practice' && (
              <PracticePage
                vocabulary={vocabulary}
                scanHistory={scanHistory}
                practiceResults={practiceResults}
                settings={settings}
                isOnline={isOnline}
                initialScanText={practiceScanText}
                initialScanTitle={practiceScanTitle}
                onSavePracticeResult={handleSavePracticeResult}
                onNavigateToScanner={() => setRoute('scanner')}
                onNotify={notify}
              />
            )}

            {route === 'settings' && (
              <SettingsPage
                settings={settings}
                onUpdateSettings={handleUpdateSettings}
                onDataChanged={loadLocalData}
                onNotify={notify}
              />
            )}
          </ErrorBoundary>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EADFD5] pb-safe"
      >
        <div className="grid grid-cols-6 items-center h-16 px-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = route === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setRoute(item.id)}
                className={`flex flex-col items-center justify-center gap-1 min-h-[44px] rounded-xl transition-colors ${
                  active ? 'text-[#A83B5A] font-bold' : 'text-[#5C4B51] font-medium'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] leading-none whitespace-nowrap">
                  {item.mobileLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-20 lg:bottom-6 right-4 left-4 sm:left-auto sm:max-w-sm z-50 px-4 py-3 rounded-2xl bg-[#2B2226] text-[#FFF8F0] text-sm font-medium shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
