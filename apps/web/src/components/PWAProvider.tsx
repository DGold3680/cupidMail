"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Download, WifiOff, X, Sparkles } from "lucide-react";

interface PWAContextType {
  isInstalled: boolean;
  isInstallable: boolean;
  isOffline: boolean;
  promptInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  isInstalled: false,
  isInstallable: false,
  isOffline: false,
  promptInstall: async () => {},
});

export const usePWA = () => useContext(PWAContext);

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered with scope:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    }

    // 2. Online / Offline listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    // 3. Check if already installed
    if (typeof window !== "undefined") {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      if (isStandalone) {
        setIsInstalled(true);
      }
    }

    // 4. Capture beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      const isBannerDismissed = localStorage.getItem("cupid_pwa_dismissed") === "true";
      if (!isBannerDismissed) {
        setShowInstallBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setShowInstallBanner(false);
      setDeferredPrompt(null);
      console.log("[PWA] Cupid Mail was successfully installed.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setShowInstallBanner(false);
    }
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const dismissBanner = () => {
    setShowInstallBanner(false);
    setDismissedBanner(true);
    try {
      localStorage.setItem("cupid_pwa_dismissed", "true");
    } catch (e) {}
  };

  return (
    <PWAContext.Provider
      value={{
        isInstalled,
        isInstallable,
        isOffline,
        promptInstall,
      }}
    >
      {/* Offline Toast Banner */}
      {isOffline && (
        <div className="fixed top-0 inset-x-0 z-[100] bg-stone-900 text-stone-100 px-4 py-2 text-xs font-mono flex items-center justify-center space-x-2 shadow-md animate-in slide-in-from-top">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>You are currently offline. Viewing cached letters.</span>
        </div>
      )}

      {/* PWA Install Banner */}
      {showInstallBanner && !isInstalled && !dismissedBanner && (
        <aside
          aria-label="PWA install banner"
          className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md z-[90] bg-white border border-rose-200/80 rounded-2xl p-3.5 shadow-xl shadow-cupid-900/15 flex items-center justify-between gap-3 animate-in slide-in-from-bottom"
        >
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cupid-900 to-cupid-700 p-1 flex items-center justify-center shadow-xs shrink-0">
              <img
                src="/assets/Logo.png"
                alt="Cupid Mail"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-mono font-bold text-xs text-stone-900">Install Cupid Mail</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cupid-600" />
              </div>
              <p className="text-[11px] text-stone-500 font-sans leading-tight mt-0.5">
                Add to your home screen for quick offline access
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            <button
              onClick={promptInstall}
              className="px-3 py-1.5 bg-gradient-to-r from-cupid-900 to-cupid-800 hover:from-cupid-950 hover:to-cupid-900 text-white rounded-xl text-xs font-mono font-semibold shadow-xs flex items-center space-x-1.5 transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
            <button
              onClick={dismissBanner}
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg transition"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}

      {children}
    </PWAContext.Provider>
  );
}

