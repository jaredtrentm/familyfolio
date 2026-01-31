'use client';

import { useState, useEffect, useRef } from 'react';

interface UseAnimatedValueOptions {
  duration?: number;
  easing?: (t: number) => number;
  delay?: number;
}

// Easing functions
export const easings = {
  linear: (t: number) => t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeIn: (t: number) => t * t * t,
  easeInOut: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

export function useAnimatedValue(
  targetValue: number,
  options: UseAnimatedValueOptions = {}
): number {
  const { duration = 1000, easing = easings.easeOut, delay = 0 } = options;

  const [animatedValue, setAnimatedValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    startValueRef.current = animatedValue;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp + delay;
      }

      const elapsed = timestamp - startTimeRef.current;

      if (elapsed < 0) {
        frameRef.current = requestAnimationFrame(animate);
        return;
      }

      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const newValue =
        startValueRef.current +
        (targetValue - startValueRef.current) * easedProgress;

      setAnimatedValue(newValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetValue, duration, delay]);

  return animatedValue;
}

export function useAnimatedCounter(
  targetValue: number,
  options: UseAnimatedValueOptions & { decimals?: number } = {}
): string {
  const { decimals = 0, ...animationOptions } = options;
  const animatedValue = useAnimatedValue(targetValue, animationOptions);

  return animatedValue.toFixed(decimals);
}

export function useAnimatedPercentage(
  targetValue: number,
  options: UseAnimatedValueOptions = {}
): string {
  const animatedValue = useAnimatedValue(targetValue, options);
  return `${animatedValue.toFixed(2)}%`;
}
