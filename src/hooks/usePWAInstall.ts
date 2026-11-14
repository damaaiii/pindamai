import { useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallListener = () => void;

let globalDeferredPrompt: BeforeInstallPromptEvent | null = null;
let globalInstalled = false;
let globalJustInstalled = false;
const listeners = new Set<InstallListener>();

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const mediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return mediaStandalone || iosStandalone;
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isClassicIOS = /iphone|ipad|ipod/.test(ua);
  const isIPadOS =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return isClassicIOS || isIPadOS;
}

function detectSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /safari/.test(ua) && !/chrome|crios|fxios|edgios|android/.test(ua);
}

function notifyAll() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== 'undefined') {
  globalInstalled = checkIsStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    globalDeferredPrompt = e as BeforeInstallPromptEvent;
    notifyAll();
  });

  window.addEventListener('appinstalled', () => {
    globalInstalled = true;
    globalJustInstalled = true;
    globalDeferredPrompt = null;
    notifyAll();
  });

  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(display-mode: standalone)');
    const onChange = (ev: MediaQueryListEvent) => {
      if (ev.matches) {
        globalInstalled = true;
        globalDeferredPrompt = null;
        notifyAll();
      }
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
    }
  }
}

export function usePWAInstall() {
  const [, setTick] = useState(0);
  const [isIOS] = useState<boolean>(() => detectIOS());
  const [isSafari] = useState<boolean>(() => detectSafari());

  useEffect(() => {
    globalInstalled = checkIsStandalone() || globalInstalled;
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const install = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!globalDeferredPrompt) return 'unavailable';
    try {
      const promptEvent = globalDeferredPrompt;
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      // A BeforeInstallPromptEvent can only be consumed once
      globalDeferredPrompt = null;
      if (outcome === 'accepted') {
        notifyAll();
        return 'accepted';
      }
      notifyAll();
      return 'dismissed';
    } catch {
      globalDeferredPrompt = null;
      notifyAll();
      return 'unavailable';
    }
  };

  return {
    isInstallable: Boolean(globalDeferredPrompt),
    isInstalled: globalInstalled,
    justInstalled: globalJustInstalled,
    isIOS,
    isIOSSafari: isIOS && isSafari,
    install,
  };
}
