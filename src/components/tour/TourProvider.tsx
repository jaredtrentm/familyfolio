"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useTour } from "@/hooks/useTour";
import type { TourId } from "@/lib/tour-config";
import "driver.js/dist/driver.css";

interface TourContextValue {
  startTour: (tourId: TourId, force?: boolean) => void;
  skipTour: () => void;
  resetTour: (tourId: TourId) => void;
  resetAllTours: () => void;
  hasCompletedTour: (tourId: TourId) => boolean;
  isActive: boolean;
  completedTours: TourId[];
}

const TourContext = createContext<TourContextValue | null>(null);

export function TourProvider({ children }: { children: ReactNode }) {
  const tour = useTour();

  return (
    <TourContext.Provider value={tour}>
      {children}
      <style jsx global>{`
        .familyfolio-tour-popover {
          --driver-theme-color: #10b981;
        }

        .driver-popover {
          background: linear-gradient(
            135deg,
            rgba(16, 185, 129, 0.1),
            rgba(6, 95, 70, 0.1)
          );
          border: 1px solid rgba(16, 185, 129, 0.3);
          backdrop-filter: blur(10px);
        }

        .driver-popover-title {
          color: #10b981;
          font-weight: 600;
        }

        .driver-popover-description {
          color: #e2e8f0;
        }

        .driver-popover-progress-text {
          color: #94a3b8;
        }

        .driver-popover-next-btn,
        .driver-popover-prev-btn {
          background: #10b981;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .driver-popover-next-btn:hover,
        .driver-popover-prev-btn:hover {
          background: #059669;
        }

        .driver-popover-close-btn {
          color: #94a3b8;
        }

        .driver-popover-close-btn:hover {
          color: #e2e8f0;
        }
      `}</style>
    </TourContext.Provider>
  );
}

export function useTourContext() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTourContext must be used within a TourProvider");
  }
  return context;
}
