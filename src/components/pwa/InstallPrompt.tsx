"use client";

import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  // Initialize dismissed state by checking sessionStorage (only runs once)
  const [dismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem("pwa-prompt-dismissed") === "true";
  });
  const [localDismissed, setLocalDismissed] = useState(false);

  useEffect(() => {
    // Skip if already dismissed
    if (dismissed || localDismissed) {
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, [dismissed, localDismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setLocalDismissed(true);
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  };

  if (!showPrompt || dismissed || localDismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-emerald-200 dark:border-emerald-800 p-4">
        <div className="relative">
          <button
            onClick={handleDismiss}
            className="absolute -right-1 -top-1 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Download className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Install FamilyFolio
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Add to your home screen for quick access
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
