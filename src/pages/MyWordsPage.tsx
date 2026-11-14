import React, { useMemo, useState } from 'react';
import {
  Search,
  Heart,
  CheckCircle2,
  Clock,
  Trash2,
  BookOpen,
  GraduationCap,
  X,
} from 'lucide-react';
import type { AppSettings, ScanHistoryItem, VocabularyItem } from '../types/pindamai';
import { AudioPlayerButton } from '../components/AudioPlayerButton';
import words3dImg from '../assets/images/words_3d_collection_1794619235506.jpg';

interface MyWordsPageProps {
  vocabulary: VocabularyItem[];
  scanHistory: ScanHistoryItem[];
  settings: AppSettings;
  onUpdateVocab: (item: VocabularyItem) => Promise<void>;
  onDeleteVocab: (id: string) => Promise<void>;
  onDeleteScan: (id: string) => Promise<void>;
  onOpenScanInLearn: (scan: ScanHistoryItem) => void;
  onPracticeFromScan: (scan: ScanHistoryItem) => void;
  onOpenTextInLearn: (text: string) => void;
  onNotify: (msg: string) => void;
}

type FolderTab = 'all' | 'favorites' | 'arabic' | 'english' | 'history';

export const MyWordsPage: React.FC<MyWordsPageProps> = ({
  vocabulary,
  scanHistory,
  settings,
  onUpdateVocab,
  onDeleteVocab,
  onDeleteScan,
  onOpenScanInLearn,
  onPracticeFromScan,
  onOpenTextInLearn,
  onNotify,
}) => {
  const [tab, setTab] = useState<FolderTab>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learning' | 'mastered'>('all');
  const [selectedVocab, setSelectedVocab] = useState<VocabularyItem | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    vocabulary.forEach((v) => {
      if (v.category) set.add(v.category);
    });
    return ['all', ...Array.from(set)];
  }, [vocabulary]);

  const filteredVocab = useMemo(() => {
    return vocabulary.filter((v) => {
      if (tab === 'favorites' && !v.isFavorite) return false;
      if (tab === 'arabic' && !v.arabicWord && v.primaryLanguage === 'english') return false;
      if (tab === 'english' && !v.englishWord && v.primaryLanguage === 'arabic') return false;
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && v.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hit =
          v.indonesianMeaning.toLowerCase().includes(q) ||
          (v.englishWord || '').toLowerCase().includes(q) ||
          (v.arabicWord || '').includes(search) ||
          (v.arabicTransliteration || '').toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [vocabulary, tab, categoryFilter, statusFilter, search]);

  const toggleFavorite = async (item: VocabularyItem) => {
    const updated = { ...item, isFavorite: !item.isFavorite, updatedAt: Date.now() };
    await onUpdateVocab(updated);
    if (selectedVocab?.id === item.id) setSelectedVocab(updated);
  };

  const toggleStatus = async (item: VocabularyItem) => {
    const nextStatus: 'learning' | 'mastered' =
      item.status === 'mastered' ? 'learning' : 'mastered';
    const updated = { ...item, status: nextStatus, updatedAt: Date.now() };
    await onUpdateVocab(updated);
    if (selectedVocab?.id === item.id) setSelectedVocab(updated);
    onNotify(
      nextStatus === 'mastered'
        ? 'Wih, Good job! Kata ini ditandai sudah dikuasai.'
        : 'Oke, kita masukin lagi ke daftar yang masih dipelajari ya.'
    );
  };

  const handleDeleteVocab = async (id: string) => {
    await onDeleteVocab(id);
    if (selectedVocab?.id === id) setSelectedVocab(null);
    onNotify('Kosakata dihapus dari My Words.');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white border border-[#EADFD5] p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        <div className="md:col-span-8 space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B2226]">
            My Words & Riwayat
          </h1>
          <p className="text-sm text-[#5C4B51]">
            Semua kosakata dan riwayat scan kamu tersimpan rapi di browser (IndexedDB), lengkap dengan suara Arab & English yang bisa diputar kapan saja.
          </p>
        </div>
        <div className="md:col-span-4 flex justify-center md:justify-end">
          <img
            src={words3dImg}
            alt="Ilustrasi koleksi kartu kata PINDAMAI"
            referrerPolicy="no-referrer"
            className="w-full max-w-[200px] aspect-[16/10] object-cover rounded-2xl border border-[#EADFD5]"
          />
        </div>
      </div>

      {/* Folder Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl bg-white border border-[#EADFD5]">
        {(
          [
            { id: 'all', label: `Semua (${vocabulary.length})` },
            { id: 'favorites', label: 'Favorit' },
            { id: 'arabic', label: 'Folder Arab' },
            { id: 'english', label: 'Folder English' },
            { id: 'history', label: `Scan History (${scanHistory.length})` },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors min-h-[40px] whitespace-nowrap ${
              tab === t.id
                ? 'bg-[#FCE9ED] text-[#2B2226]'
                : 'text-[#5C4B51] hover:text-[#2B2226]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search & Filters (for vocab tabs) */}
      {tab !== 'history' && (
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#7B5D66] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kata Arab, English, arti Indonesia, atau kategori..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white border border-[#EADFD5] text-sm focus:outline-none focus:border-[#A83B5A]"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filter kategori"
            className="px-4 py-3 rounded-2xl bg-white border border-[#EADFD5] text-sm font-medium text-[#2B2226] min-h-[44px]"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'all' ? 'Semua Kategori' : c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'learning' | 'mastered')}
            aria-label="Filter status belajar"
            className="px-4 py-3 rounded-2xl bg-white border border-[#EADFD5] text-sm font-medium text-[#2B2226] min-h-[44px]"
          >
            <option value="all">Semua Status</option>
            <option value="learning">Sedang Dipelajari</option>
            <option value="mastered">Sudah Dikuasai</option>
          </select>
        </div>
      )}

      {/* SCAN HISTORY TAB */}
      {tab === 'history' ? (
        scanHistory.length === 0 ? (
          <div className="p-8 rounded-3xl bg-white border border-[#EADFD5] text-center space-y-3">
            <img
              src={words3dImg}
              alt="Riwayat scan kosong"
              referrerPolicy="no-referrer"
              className="w-36 h-24 object-cover rounded-2xl mx-auto border border-[#EADFD5]"
            />
            <p className="font-display font-bold text-[#2B2226]">Belum ada riwayat scan nih!</p>
            <p className="text-sm text-[#5C4B51]">
              Setiap kamu scan teks atau objek pakai AI, jejak belajarnya bakal otomatis muncul di sini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scanHistory.map((scan) => (
              <div
                key={scan.id}
                className="p-5 rounded-3xl bg-white border border-[#EADFD5] flex flex-col justify-between gap-4"
              >
                <div className="flex gap-4">
                  {scan.thumbnailDataUrl && (
                    <img
                      src={scan.thumbnailDataUrl}
                      alt={scan.title}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-2xl object-cover shrink-0 border border-[#EADFD5]"
                    />
                  )}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-xs text-[#7B5D66]">
                      <span>{scan.type === 'object' ? 'Object Scan' : 'Text Scan'}</span>
                      <span>{new Date(scan.createdAt).toLocaleString('id-ID')}</span>
                    </div>
                    <h3 className="font-display font-bold text-[#2B2226] truncate">{scan.title}</h3>
                    <p className="text-sm text-[#5C4B51] line-clamp-2">{scan.summary}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EADFD5]">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenScanInLearn(scan)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FCE9ED] text-xs font-semibold text-[#2B2226] min-h-[38px]"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Buka di Learn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onPracticeFromScan(scan)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E7F0DF] text-xs font-semibold text-[#263B27] min-h-[38px]"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Buat Latihan</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label="Hapus riwayat"
                    onClick={() => onDeleteScan(scan.id)}
                    className="p-2 rounded-xl hover:bg-[#FCE9ED] text-[#7B5D66] min-h-[38px] min-w-[38px] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredVocab.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white border border-[#EADFD5] text-center space-y-3">
          <img
            src={words3dImg}
            alt="Belum ada kosakata cocok"
            referrerPolicy="no-referrer"
            className="w-36 h-24 object-cover rounded-2xl mx-auto border border-[#EADFD5]"
          />
          <p className="font-display font-bold text-[#2B2226]">Belum ada kosakata yang cocok nih</p>
          <p className="text-sm text-[#5C4B51]">
            Coba ubah filter pencarian, atau scan benda/teks baru lalu klik Save to My Words!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVocab.map((item) => (
            <div
              key={item.id}
              className="p-5 rounded-3xl bg-white border border-[#EADFD5] flex flex-col justify-between gap-4 hover:border-[#F6C9D5] transition-colors"
            >
              <button
                type="button"
                onClick={() => setSelectedVocab(item)}
                className="text-left space-y-2 w-full"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-[#7B5D66]">
                  <span className="truncate">{item.category}</span>
                  <span>{item.status === 'mastered' ? 'Mastered' : 'Learning'}</span>
                </div>

                {item.arabicWord && (
                  <div>
                    <p className="font-arabic text-2xl font-bold text-[#2B2226]">{item.arabicWord}</p>
                    {item.arabicTransliteration && (
                      <p className="text-xs text-[#7B3449]">{item.arabicTransliteration}</p>
                    )}
                  </div>
                )}

                {item.englishWord && (
                  <p className="font-display text-lg font-bold text-[#2B2226]">{item.englishWord}</p>
                )}

                <p className="text-sm text-[#5C4B51] line-clamp-2">{item.indonesianMeaning}</p>
              </button>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#EADFD5]">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Toggle favorit"
                    onClick={() => toggleFavorite(item)}
                    className={`p-2 rounded-xl min-h-[38px] min-w-[38px] flex items-center justify-center ${
                      item.isFavorite ? 'bg-[#FCE9ED] text-[#A83B5A]' : 'hover:bg-[#FFF8F0] text-[#7B5D66]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${item.isFavorite ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    aria-label="Tandai sudah dikuasai"
                    onClick={() => toggleStatus(item)}
                    className={`p-2 rounded-xl min-h-[38px] min-w-[38px] flex items-center justify-center ${
                      item.status === 'mastered'
                        ? 'bg-[#E7F0DF] text-[#263B27]'
                        : 'hover:bg-[#FFF8F0] text-[#7B5D66]'
                    }`}
                  >
                    {item.status === 'mastered' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {item.arabicWord && (
                    <AudioPlayerButton
                      text={item.arabicWord}
                      lang="ar-SA"
                      label="AR"
                      speechRate={settings.speechRate}
                      compact
                      tone="pink"
                    />
                  )}
                  {item.englishWord && (
                    <AudioPlayerButton
                      text={item.englishWord}
                      lang="en-US"
                      label="EN"
                      speechRate={settings.speechRate}
                      compact
                      tone="green"
                    />
                  )}
                  <button
                    type="button"
                    aria-label="Hapus kosakata"
                    onClick={() => handleDeleteVocab(item.id)}
                    className="p-2 rounded-xl hover:bg-[#FCE9ED] text-[#7B5D66] min-h-[36px] min-w-[36px] flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vocabulary Detail Modal */}
      {selectedVocab && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl bg-[#FFF8F0] border border-[#EADFD5] p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-[#7B5D66]">
                  {selectedVocab.category} ·{' '}
                  {selectedVocab.status === 'mastered' ? 'Sudah Dikuasai' : 'Sedang Dipelajari'}
                </span>
                <h2 className="font-display text-2xl font-extrabold text-[#2B2226]">
                  {selectedVocab.englishWord || selectedVocab.arabicWord}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVocab(null)}
                aria-label="Tutup detail"
                className="p-2 rounded-xl hover:bg-[#FCE9ED] min-h-[42px] min-w-[42px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedVocab.arabicWord && (
                <div className="p-4 rounded-2xl bg-white border border-[#EADFD5] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#7B5D66]">Bahasa Arab</span>
                    <AudioPlayerButton
                      text={selectedVocab.arabicWord}
                      lang="ar-SA"
                      label="Listen AR"
                      speechRate={settings.speechRate}
                      compact
                      tone="pink"
                    />
                  </div>
                  <p className="font-arabic text-3xl font-bold text-[#2B2226]">
                    {selectedVocab.arabicWord}
                  </p>
                  {selectedVocab.arabicTransliteration && (
                    <p className="text-xs text-[#7B3449]">{selectedVocab.arabicTransliteration}</p>
                  )}
                </div>
              )}

              <div className="p-4 rounded-2xl bg-white border border-[#EADFD5] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[#7B5D66]">English & Arti</span>
                  {selectedVocab.englishWord && (
                    <AudioPlayerButton
                      text={selectedVocab.englishWord}
                      lang="en-US"
                      label="Listen EN"
                      speechRate={settings.speechRate}
                      compact
                      tone="green"
                    />
                  )}
                </div>
                {selectedVocab.englishWord && (
                  <p className="font-display text-2xl font-bold text-[#2B2226]">
                    {selectedVocab.englishWord}
                  </p>
                )}
                <p className="text-sm text-[#5C4B51]">{selectedVocab.indonesianMeaning}</p>
              </div>
            </div>

            {selectedVocab.funNote && (
              <p className="p-4 rounded-2xl bg-[#FFF6D6]/75 text-sm text-[#4C3D14] leading-relaxed">
                {selectedVocab.funNote}
              </p>
            )}

            {selectedVocab.exampleSentences && selectedVocab.exampleSentences.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-display text-sm font-bold text-[#2B2226]">Contoh Kalimat</h3>
                {selectedVocab.exampleSentences.map((ex, i) => (
                  <div key={i} className="p-3.5 rounded-2xl bg-white border border-[#EADFD5] space-y-2">
                    {ex.arabic && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-arabic text-lg font-bold">{ex.arabic}</p>
                        <AudioPlayerButton
                          text={ex.arabic}
                          lang="ar-SA"
                          label="Listen"
                          speechRate={settings.speechRate}
                          compact
                          tone="pink"
                        />
                      </div>
                    )}
                    {ex.english && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{ex.english}</p>
                        <AudioPlayerButton
                          text={ex.english}
                          lang="en-US"
                          label="Listen"
                          speechRate={settings.speechRate}
                          compact
                          tone="green"
                        />
                      </div>
                    )}
                    <p className="text-xs text-[#5C4B51]">{ex.indonesian}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleStatus(selectedVocab)}
                  className="px-4 py-2.5 rounded-2xl bg-[#E7F0DF] text-[#263B27] text-xs font-semibold min-h-[42px]"
                >
                  {selectedVocab.status === 'mastered' ? 'Mark as Learning' : 'Mark as Mastered'}
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(selectedVocab)}
                  className="px-4 py-2.5 rounded-2xl bg-[#FCE9ED] text-[#2B2226] text-xs font-semibold min-h-[42px]"
                >
                  {selectedVocab.isFavorite ? 'Hapus Favorit' : 'Jadikan Favorit'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  const txt = selectedVocab.arabicWord || selectedVocab.englishWord || '';
                  setSelectedVocab(null);
                  onOpenTextInLearn(txt);
                }}
                className="px-4 py-2.5 rounded-2xl bg-[#2B2226] text-[#FFF8F0] text-xs font-semibold min-h-[42px]"
              >
                Bedah di Learn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
