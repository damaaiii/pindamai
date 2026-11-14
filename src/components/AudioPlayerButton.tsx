import React, { useEffect, useId, useState } from 'react';
import { Volume2, Pause, Play, RotateCcw, Loader2, Turtle, AlertCircle } from 'lucide-react';
import { audioManager, type AudioLang, type AudioSnapshot } from '../lib/audioManager';

interface AudioPlayerButtonProps {
  text: string;
  lang: AudioLang;
  label?: string;
  speechRate?: number;
  compact?: boolean;
  tone?: 'pink' | 'green' | 'cream' | 'white';
}

export const AudioPlayerButton: React.FC<AudioPlayerButtonProps> = ({
  text,
  lang,
  label = 'Listen',
  speechRate = 0.92,
  compact = false,
  tone = 'white',
}) => {
  const reactId = useId();
  const controlId = `${reactId}-${lang}`;
  const [snap, setSnap] = useState<AudioSnapshot>(audioManager.getSnapshot());
  const [slowMode, setSlowMode] = useState(false);

  useEffect(() => {
    return audioManager.subscribe(setSnap);
  }, []);

  const isThisActive = snap.activeId === controlId;
  const status = isThisActive ? snap.status : 'idle';

  const baseTone =
    tone === 'pink'
      ? 'bg-white hover:bg-[#FCE9ED] text-[#2B2226] border-[#F6C9D5]'
      : tone === 'green'
        ? 'bg-white hover:bg-[#E7F0DF] text-[#263B27] border-[#C9DFC0]'
        : tone === 'cream'
          ? 'bg-[#FFF8F0] hover:bg-[#FCE9ED] text-[#2B2226] border-[#EADFD5]'
          : 'bg-white hover:bg-[#FFF8F0] text-[#2B2226] border-[#EADFD5]';

  const handleMainClick = () => {
    if (!isThisActive || status === 'idle' || status === 'error') {
      audioManager.play(controlId, text, lang, speechRate, slowMode);
    } else if (status === 'playing') {
      audioManager.pause();
    } else if (status === 'paused') {
      audioManager.resume();
    }
  };

  const handleReplay = () => {
    audioManager.play(controlId, text, lang, speechRate, slowMode);
  };

  const handleToggleSlow = () => {
    const nextSlow = !slowMode;
    setSlowMode(nextSlow);
    audioManager.play(controlId, text, lang, speechRate, nextSlow);
  };

  if (!text.trim()) return null;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={handleMainClick}
          aria-label={label}
          className={`inline-flex items-center gap-1.5 border font-semibold transition-colors whitespace-nowrap shrink-0 ${
            compact ? 'px-2.5 py-1.5 rounded-xl text-xs min-h-[34px]' : 'px-3.5 py-2 rounded-xl text-xs min-h-[38px]'
          } ${
            status === 'playing'
              ? 'bg-[#2B2226] text-[#FFF8F0] border-[#2B2226]'
              : status === 'paused'
                ? 'bg-[#FFF6D6] text-[#2B2226] border-[#F8E6A0]'
                : baseTone
          }`}
        >
          {status === 'loading' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          ) : status === 'playing' ? (
            <Pause className="w-3.5 h-3.5 shrink-0" />
          ) : status === 'paused' ? (
            <Play className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Volume2 className="w-3.5 h-3.5 shrink-0" />
          )}

          <span>
            {status === 'loading'
              ? 'Memuat...'
              : status === 'playing'
                ? 'Playing · Jeda'
                : status === 'paused'
                  ? 'Lanjutkan'
                  : label}
          </span>

          {status === 'playing' && (
            <span className="inline-flex items-end gap-0.5 h-3 ml-0.5" aria-hidden="true">
              <span className="w-0.5 h-2 bg-[#F6C9D5] rounded-full animate-pulse" />
              <span className="w-0.5 h-3 bg-[#C9DFC0] rounded-full animate-pulse" />
              <span className="w-0.5 h-1.5 bg-[#F8E6A0] rounded-full animate-pulse" />
            </span>
          )}
        </button>

        {(isThisActive || slowMode) && (
          <>
            <button
              type="button"
              onClick={handleReplay}
              title="Putar ulang"
              aria-label="Putar ulang audio"
              className="p-2 rounded-xl bg-white border border-[#EADFD5] hover:bg-[#FCE9ED] text-[#2B2226] min-h-[34px] min-w-[34px] flex items-center justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleToggleSlow}
              title="Mode pelan"
              aria-label="Kecepatan pelan"
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold min-h-[34px] ${
                slowMode
                  ? 'bg-[#FFF6D6] border-[#F8E6A0] text-[#2B2226]'
                  : 'bg-white border-[#EADFD5] text-[#5C4B51] hover:bg-[#FFF8F0]'
              }`}
            >
              <Turtle className="w-3.5 h-3.5" />
              <span>0.7x</span>
            </button>
          </>
        )}
      </div>

      {isThisActive && status === 'error' && snap.errorMessage && (
        <span className="inline-flex items-center gap-1 text-[11px] text-[#A83B5A]">
          <AlertCircle className="w-3 h-3 shrink-0" />
          <span>{snap.errorMessage}</span>
        </span>
      )}
    </div>
  );
};
