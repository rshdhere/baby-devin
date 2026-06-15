"use client";

import { useEffect, useState } from "react";

export const MIN_LOADING_DURATION_MS = 5000;

export function useMinimumLoadingDuration(
  minMs: number = MIN_LOADING_DURATION_MS,
) {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setElapsed(true), minMs);
    return () => clearTimeout(timer);
  }, [minMs]);

  return elapsed;
}
