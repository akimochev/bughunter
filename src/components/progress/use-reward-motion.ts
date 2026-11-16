"use client";

import { useEffect, useState } from "react";

// A finite window, latched off on Reduce Motion. Turning motion back on cannot
// restart an old reward. Strict Mode's effect cleanup also cancels the timer.
export function useRewardMotion(eligible: boolean) {
  const [running, setRunning] = useState(
    () =>
      eligible &&
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (!eligible) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stopOnReduce = (event: MediaQueryListEvent) => {
      if (event.matches) setRunning(false);
    };
    query.addEventListener("change", stopOnReduce);
    const timer = setTimeout(() => setRunning(false), 1800);
    return () => {
      clearTimeout(timer);
      query.removeEventListener("change", stopOnReduce);
    };
  }, [eligible]);
  return eligible && running;
}
