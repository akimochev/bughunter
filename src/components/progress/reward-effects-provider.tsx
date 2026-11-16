"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import { createRewardEffects } from "@/lib/reward-effects";
import type { ProgressMission } from "@/lib/progress/types";

const EffectsContext = createContext<ReturnType<
  typeof createRewardEffects
> | null>(null);
export function RewardEffectsProvider({
  missions,
  children,
}: {
  missions: ProgressMission[];
  children: ReactNode;
}) {
  const [effects] = useState(() => createRewardEffects(missions));
  const snapshot = useSyncExternalStore(
    effects.subscribe,
    effects.getSnapshot,
    effects.getServerSnapshot,
  );
  useEffect(() => {
    if (!snapshot.expiresAt) return;
    const timer = setTimeout(
      () => effects.expireHighlights(snapshot.expiresAt),
      Math.max(0, snapshot.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [effects, snapshot.expiresAt]);
  return (
    <EffectsContext.Provider value={effects}>
      {children}
    </EffectsContext.Provider>
  );
}
export function useRewardEffects() {
  const effects = useContext(EffectsContext);
  if (!effects) throw new Error("RewardEffectsProvider is required");
  const snapshot = useSyncExternalStore(
    effects.subscribe,
    effects.getSnapshot,
    effects.getServerSnapshot,
  );
  return { effects, ...snapshot };
}
