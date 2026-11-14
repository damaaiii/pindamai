import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Trash2,
  Volume2,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  ExplanationLevel,
  LearningLanguage,
} from '../types/pindamai';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { clearAllData, exportAllData, importAllData } from '../lib/db';
import { speakText } from '../lib/speech';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => Promise<void>;
  onDataChanged: () => Promise<void>;
  onNotify: (msg: string) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onDataChanged,
  onNotify,
}) => {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pindamai-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onNotify('Sip! File backup data kamu berhasil diunduh.');
    } catch {
      onNotify('Waduh, gagal mengekspor data lokal.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const res = await importAllData(parsed);
      await onDataChanged();
      onNotify(
        `Berhasil! ${res.importedVocab} kosakata dan ${res.importedScans} riwayat scan dipulihkan.`
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'File backup JSON tidak valid atau rusak nih.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleClearData = async () => {
    await clearAllData();
    await onDataChanged();
    setConfirmClearOpen(false);
    onNotify('Semua data lokal di browser ini sudah dibersihkan.');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#2B2226]">
          Settings
        </h1>
        <p className="text-sm text-[#5C4B51]">
          Atur gaya belajar, suara, instalasi PWA, dan cadangan data lokalmu.
        </p>
      </div>

      {/* Install PWA */}
      <PWAInstallButton variant="card" onNotify={onNotify} />

      {/* Learning Preferences */}
      <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-5">
        <h2 className="font-display text-lg font-bold text-[#2B2226]">Preferensi Belajar</h2>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-[#2B2226] block">
            Bahasa Penjelasan (Interface)
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'id', label: 'Indonesia Kasual (Default)' },
                { id: 'id-en', label: 'Indonesia + Istilah English' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, interfaceLanguage: opt.id })
                }
                className={`px-4 py-2.5 rounded-2xl text-xs font-semibold border min-h-[42px] ${
                  settings.interfaceLanguage === opt.id
                    ? 'bg-[#FCE9ED] border-[#F6C9D5] text-[#2B2226]'
                    : 'bg-[#FFF8F0] border-[#EADFD5] text-[#5C4B51]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-[#2B2226] block">
            Fokus Bahasa Belajar Default
          </label>
          <div className="flex flex-wrap gap-2">
            {(['both', 'arabic', 'english'] as LearningLanguage[]).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, defaultLearningLanguage: lang })
                }
                className={`px-4 py-2.5 rounded-2xl text-xs font-semibold border min-h-[42px] ${
                  settings.defaultLearningLanguage === lang
                    ? 'bg-[#E7F0DF] border-[#C9DFC0] text-[#263B27]'
                    : 'bg-[#FFF8F0] border-[#EADFD5] text-[#5C4B51]'
                }`}
              >
                {lang === 'both' ? 'Arab & Inggris' : lang === 'arabic' ? 'Bahasa Arab' : 'Bahasa Inggris'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-[#2B2226] block">
            Tingkat Penjelasan AI Default
          </label>
          <div className="flex flex-wrap gap-2">
            {(['beginner', 'intermediate', 'advanced'] as ExplanationLevel[]).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, defaultExplanationLevel: lv })
                }
                className={`px-4 py-2.5 rounded-2xl text-xs font-semibold capitalize border min-h-[42px] ${
                  settings.defaultExplanationLevel === lv
                    ? 'bg-[#FFF6D6] border-[#F8E6A0] text-[#2B2226]'
                    : 'bg-[#FFF8F0] border-[#EADFD5] text-[#5C4B51]'
                }`}
              >
                {lv}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sound Settings */}
      <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
        <h2 className="font-display text-lg font-bold text-[#2B2226]">Pengaturan Suara</h2>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#2B2226]">Efek Suara Latihan</p>
            <p className="text-xs text-[#5C4B51]">Bunyi lembut saat jawaban benar atau perlu dicek lagi.</p>
          </div>
          <button
            type="button"
            onClick={() =>
              onUpdateSettings({
                ...settings,
                soundEffectsEnabled: !settings.soundEffectsEnabled,
              })
            }
            className={`px-4 py-2 rounded-xl text-xs font-bold min-h-[40px] ${
              settings.soundEffectsEnabled
                ? 'bg-[#E7F0DF] text-[#263B27]'
                : 'bg-[#FFF8F0] border border-[#EADFD5] text-[#5C4B51]'
            }`}
          >
            {settings.soundEffectsEnabled ? 'Aktif' : 'Mati'}
          </button>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[#2B2226]">
              Kecepatan Pengucapan (TTS): {settings.speechRate.toFixed(2)}x
            </span>
            <button
              type="button"
              onClick={() => speakText('Hello! Welcome to PINDAMAI.', 'en-US', settings.speechRate)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#A83B5A]"
            >
              <Volume2 className="w-3.5 h-3.5" /> Tes Suara
            </button>
          </div>
          <input
            type="range"
            min={0.65}
            max={1.25}
            step={0.05}
            value={settings.speechRate}
            onChange={(e) =>
              onUpdateSettings({ ...settings, speechRate: Number(e.target.value) })
            }
            className="w-full accent-[#A83B5A]"
          />
        </div>
      </div>

      {/* Data & Backup (No Login, IndexedDB) */}
      <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-4">
        <h2 className="font-display text-lg font-bold text-[#2B2226]">
          Data Lokal & Cadangan (Tanpa Login)
        </h2>

        <div className="p-4 rounded-2xl bg-[#FFF6D6]/75 border border-[#F8E6A0] flex items-start gap-3 text-xs text-[#5C4B51] leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-[#8A6712] shrink-0 mt-0.5" />
          <span>
            PINDAMAI nggak pakai akun atau login, jadi semua kosakata, favorit, riwayat scan, dan skor latihan disimpan lokal di browser ini (IndexedDB). Data bisa hilang kalau kamu menghapus data browser atau pindah perangkat tanpa melakukan backup Export Data ya!
          </span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#E7F0DF] hover:bg-[#d8e8cb] text-[#263B27] text-xs font-semibold min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>Export Data (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FCE9ED] hover:bg-[#F6C9D5] text-[#2B2226] text-xs font-semibold min-h-[44px]"
          >
            <Upload className="w-4 h-4" />
            <span>Import Data (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmClearOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#FFF8F0] border border-[#EADFD5] hover:bg-[#FCE9ED] text-[#7B233B] text-xs font-semibold min-h-[44px]"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Local Data</span>
          </button>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      {/* About PINDAMAI */}
      <div className="p-6 rounded-3xl bg-white border border-[#EADFD5] space-y-2">
        <div className="flex items-center gap-2 font-display text-base font-bold text-[#2B2226]">
          <Info className="w-4 h-4 text-[#A83B5A]" />
          <span>Tentang PINDAMAI</span>
        </div>
        <p className="text-sm text-[#5C4B51] leading-relaxed">
          <strong>PINDAMAI — Scan the world. Learn the language.</strong> Teman belajar bahasa Arab dan Inggris berbasis kamera, OCR, dan AI Vision yang santai dan tanpa ribet login.
        </p>
        <p className="text-xs text-[#7B5D66]">App Version: 1.0.0</p>
      </div>

      {/* In-app confirmation modal for clearing data */}
      {confirmClearOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#FFF8F0] border border-[#EADFD5] p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-[#2B2226]">
                Yakin hapus semua data lokal?
              </h3>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                aria-label="Tutup"
                className="p-2 rounded-xl hover:bg-[#FCE9ED]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[#5C4B51]">
              Semua kosakata tersimpan, riwayat scan, dan skor latihan di browser ini bakal terhapus permanen kecuali kamu udah Export Data sebelumnya.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="px-4 py-2.5 rounded-2xl bg-white border border-[#EADFD5] text-xs font-semibold text-[#2B2226] min-h-[42px]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClearData}
                className="px-5 py-2.5 rounded-2xl bg-[#A83B5A] text-white text-xs font-semibold min-h-[42px]"
              >
                Ya, Hapus Semua
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
