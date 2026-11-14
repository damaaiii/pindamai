export function speakText(
  text: string,
  lang: 'ar-SA' | 'en-US' | 'id-ID',
  rate = 0.92
): { supported: boolean; message?: string } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return {
      supported: false,
      message: 'Browser kamu belum mendukung fitur pengucapan suara (Web Speech API).',
    };
  }

  const clean = text.trim();
  if (!clean) {
    return { supported: false, message: 'Tidak ada kata yang bisa dibaca nih.' };
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.lang = lang;
  utterance.rate = rate;

  const voices = window.speechSynthesis.getVoices();
  const prefix = lang.split('-')[0];
  const matchedVoice =
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(prefix));

  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);

  if (lang === 'ar-SA' && voices.length > 0 && !matchedVoice) {
    return {
      supported: true,
      message:
        'Suara Arab native belum terpasang di perangkat ini, jadi sistem mencoba voice default ya.',
    };
  }

  return { supported: true };
}

export function playFeedbackTone(kind: 'success' | 'oops' | 'tap', enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (kind === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.09);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (kind === 'oops') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.14);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now);
      osc.stop(now + 0.18);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.start(now);
      osc.stop(now + 0.07);
    }
  } catch {
    // Ignore audio context autoplay restrictions silently
  }
}
