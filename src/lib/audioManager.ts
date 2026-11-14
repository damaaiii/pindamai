export type AudioLang = 'ar-SA' | 'en-US' | 'id-ID';
export type AudioStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface AudioSnapshot {
  activeId: string | null;
  status: AudioStatus;
  slow: boolean;
  errorMessage: string | null;
}

type Listener = (snapshot: AudioSnapshot) => void;

const ttsCache = new Map<string, string>(); // key -> blob object URL

class PindamaiAudioManager {
  private snapshot: AudioSnapshot = {
    activeId: null,
    status: 'idle',
    slow: false,
    errorMessage: null,
  };
  private listeners = new Set<Listener>();
  private currentAudio: HTMLAudioElement | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private lastPlayedParams: {
    id: string;
    text: string;
    lang: AudioLang;
    rate: number;
    slow: boolean;
  } | null = null;
  private playCounter = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AudioSnapshot {
    return this.snapshot;
  }

  private emit(partial: Partial<AudioSnapshot>) {
    this.snapshot = { ...this.snapshot, ...partial };
    this.listeners.forEach((fn) => fn(this.snapshot));
  }

  stop() {
    this.playCounter += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio.onended = null;
      this.currentAudio.onerror = null;
      this.currentAudio = null;
    }
    this.currentUtterance = null;
    this.emit({ activeId: null, status: 'idle', errorMessage: null });
  }

  pause() {
    if (this.snapshot.status !== 'playing') return;
    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.emit({ status: 'paused' });
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.emit({ status: 'paused' });
    }
  }

  resume() {
    if (this.snapshot.status !== 'paused') return;
    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().then(() => {
        this.emit({ status: 'playing' });
      }).catch(() => {
        this.emit({ status: 'error', errorMessage: 'Gagal melanjutkan audio.' });
      });
      return;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.emit({ status: 'playing' });
    }
  }

  async replay() {
    if (!this.lastPlayedParams) return;
    const { id, text, lang, rate, slow } = this.lastPlayedParams;
    await this.play(id, text, lang, rate, slow);
  }

  private async getVoicesWithWait(): Promise<SpeechSynthesisVoice[]> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    const immediate = window.speechSynthesis.getVoices();
    if (immediate.length > 0) return immediate;
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.addEventListener('voiceschanged', finish, { once: true });
      setTimeout(finish, 250);
    });
  }

  async play(
    id: string,
    text: string,
    lang: AudioLang,
    baseRate = 0.92,
    slow = false
  ): Promise<void> {
    const clean = text.trim();
    if (!clean) {
      this.emit({
        activeId: id,
        status: 'error',
        slow,
        errorMessage: 'Tidak ada teks untuk dibacakan.',
      });
      return;
    }

    // Stop any previous audio cleanly so voices never overlap
    this.stop();
    const token = this.playCounter;
    this.lastPlayedParams = { id, text: clean, lang, rate: baseRate, slow };
    this.emit({ activeId: id, status: 'loading', slow, errorMessage: null });

    const effectiveRate = slow ? Math.max(0.55, baseRate * 0.72) : baseRate;
    const langPrefix = lang.split('-')[0].toLowerCase();

    // Try native SpeechSynthesis only if a suitable native voice is available
    const voices = await this.getVoicesWithWait();
    if (token !== this.playCounter) return;

    const matchingVoice =
      voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));

    const canUseSpeechSynth =
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      Boolean(matchingVoice);

    if (canUseSpeechSynth && matchingVoice) {
      const started = await this.playViaSpeechSynthesis(token, id, clean, lang, matchingVoice, effectiveRate, slow);
      if (started || token !== this.playCounter) return;
    }

    // Fallback to reliable server-side Gemini TTS (especially for Arabic on devices without ar voices)
    await this.playViaServerTTS(token, id, clean, langPrefix as 'ar' | 'en' | 'id', slow);
  }

  private playViaSpeechSynthesis(
    token: number,
    id: string,
    text: string,
    lang: AudioLang,
    voice: SpeechSynthesisVoice,
    rate: number,
    slow: boolean
  ): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.voice = voice;
        utterance.rate = rate;
        this.currentUtterance = utterance;

        let settled = false;
        const safetyTimer = setTimeout(() => {
          if (!settled && token === this.playCounter && this.snapshot.status === 'loading') {
            settled = true;
            window.speechSynthesis.cancel();
            resolve(false);
          }
        }, 1800);

        utterance.onstart = () => {
          clearTimeout(safetyTimer);
          if (token !== this.playCounter) return;
          settled = true;
          this.emit({ activeId: id, status: 'playing', slow, errorMessage: null });
          resolve(true);
        };

        utterance.onend = () => {
          clearTimeout(safetyTimer);
          if (token !== this.playCounter) return;
          this.currentUtterance = null;
          this.emit({ activeId: null, status: 'idle', errorMessage: null });
          if (!settled) {
            settled = true;
            resolve(true);
          }
        };

        utterance.onerror = () => {
          clearTimeout(safetyTimer);
          if (!settled) {
            settled = true;
            resolve(false);
          } else if (token === this.playCounter) {
            this.emit({
              activeId: id,
              status: 'error',
              errorMessage: 'Gagal memutar suara browser.',
            });
          }
        };

        window.speechSynthesis.speak(utterance);
      } catch {
        resolve(false);
      }
    });
  }

  private async playViaServerTTS(
    token: number,
    id: string,
    text: string,
    lang: 'ar' | 'en' | 'id',
    slow: boolean
  ): Promise<void> {
    const cacheKey = `${lang}|${slow ? 'slow' : 'normal'}|${text}`;
    let audioUrl = ttsCache.get(cacheKey);

    try {
      if (!audioUrl) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error('Suara perangkat tidak tersedia saat offline. Hubungkan internet untuk suara AI ya!');
        }

        const res = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, lang, slow }),
        });

        const data = await res.json();
        if (!res.ok || !data.audioBase64) {
          throw new Error(data.error || 'Gagal memuat audio pengucapan dari server.');
        }

        const binary = atob(data.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: data.mimeType || 'audio/wav' });
        audioUrl = URL.createObjectURL(blob);
        ttsCache.set(cacheKey, audioUrl);
      }

      if (token !== this.playCounter) return;

      const audio = new Audio(audioUrl);
      audio.playbackRate = slow ? 0.85 : 1.0;
      this.currentAudio = audio;

      audio.onended = () => {
        if (token !== this.playCounter) return;
        this.currentAudio = null;
        this.emit({ activeId: null, status: 'idle', errorMessage: null });
      };

      audio.onerror = () => {
        if (token !== this.playCounter) return;
        this.currentAudio = null;
        this.emit({
          activeId: id,
          status: 'error',
          errorMessage: 'Audio gagal diputar di browser ini.',
        });
      };

      await audio.play();
      if (token !== this.playCounter) {
        audio.pause();
        return;
      }
      this.emit({ activeId: id, status: 'playing', slow, errorMessage: null });
    } catch (err) {
      if (token !== this.playCounter) return;
      this.emit({
        activeId: id,
        status: 'error',
        errorMessage:
          err instanceof Error
            ? err.message
            : 'Audio pengucapan gagal dimuat. Coba lagi sebentar ya!',
      });
    }
  }
}

export const audioManager = new PindamaiAudioManager();
