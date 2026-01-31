"use client";

import { useCallback, useEffect, useState } from "react";
import { driver, type Driver } from "driver.js";
import { tourSteps, driverConfig, type TourId } from "@/lib/tour-config";

const TOUR_STORAGE_KEY = "familyfolio-completed-tours";

export function useTour() {
  const [driverInstance, setDriverInstance] = useState<Driver | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [completedTours, setCompletedTours] = useState<Set<TourId>>(new Set());

  useEffect(() => {
    // Load completed tours from localStorage
    const stored = localStorage.getItem(TOUR_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TourId[];
        setCompletedTours(new Set(parsed));
      } catch {
        // Invalid storage, reset
        localStorage.removeItem(TOUR_STORAGE_KEY);
      }
    }
  }, []);

  const saveCompletedTours = useCallback((tours: Set<TourId>) => {
    localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify([...tours]));
  }, []);

  const startTour = useCallback(
    (tourId: TourId, force = false) => {
      // Don't start if already completed (unless forced)
      if (!force && completedTours.has(tourId)) {
        return;
      }

      const steps = tourSteps[tourId];
      if (!steps || steps.length === 0) return;

      // Check if elements exist
      const firstElement = steps[0]?.element;
      if (
        typeof firstElement === "string" &&
        !document.querySelector(firstElement)
      ) {
        // Elements not yet in DOM, wait a bit
        setTimeout(() => startTour(tourId, force), 500);
        return;
      }

      const instance = driver({
        ...driverConfig,
        steps,
        onDestroyStarted: () => {
          // Mark tour as completed
          const newCompleted = new Set(completedTours);
          newCompleted.add(tourId);
          setCompletedTours(newCompleted);
          saveCompletedTours(newCompleted);
          setIsActive(false);
          instance.destroy();
        },
        onDestroyed: () => {
          setDriverInstance(null);
          setIsActive(false);
        },
      });

      setDriverInstance(instance);
      setIsActive(true);
      instance.drive();
    },
    [completedTours, saveCompletedTours]
  );

  const skipTour = useCallback(() => {
    if (driverInstance) {
      driverInstance.destroy();
      setIsActive(false);
    }
  }, [driverInstance]);

  const resetTour = useCallback(
    (tourId: TourId) => {
      const newCompleted = new Set(completedTours);
      newCompleted.delete(tourId);
      setCompletedTours(newCompleted);
      saveCompletedTours(newCompleted);
    },
    [completedTours, saveCompletedTours]
  );

  const resetAllTours = useCallback(() => {
    setCompletedTours(new Set());
    localStorage.removeItem(TOUR_STORAGE_KEY);
  }, []);

  const hasCompletedTour = useCallback(
    (tourId: TourId) => completedTours.has(tourId),
    [completedTours]
  );

  return {
    startTour,
    skipTour,
    resetTour,
    resetAllTours,
    hasCompletedTour,
    isActive,
    completedTours: [...completedTours],
  };
}
