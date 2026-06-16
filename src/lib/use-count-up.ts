"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpOptions {
  duration?: number;          // ms
  skip?: boolean;             // if true, jump straight to value (e.g. for non-numbers)
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Animate a number from previous value → new value over `duration` ms.
 * Returns the current animated value.
 */
export function useCountUp(target: number, opts: CountUpOptions = {}): number {
  const { duration = 600, skip = false } = opts;
  const [value, setValue] = useState<number>(skip ? target : 0);
  const startRef = useRef<number | null>(null);
  const startValRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (skip) {
      setValue(target);
      return;
    }

    startRef.current = null;
    startValRef.current = value;

    const step = (timestamp: number) => {
      if (startRef.current === null) startRef.current = timestamp;
      const elapsed = timestamp - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const next = startValRef.current + (target - startValRef.current) * eased;
      setValue(next);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, skip]);

  return value;
}
