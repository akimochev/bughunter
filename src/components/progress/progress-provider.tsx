"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactNode } from "react";
import {
  LocalProgressRepository,
  PROGRESS_KEY,
} from "@/lib/progress/local-repository";
import { createProgressStore } from "@/lib/progress/store";
import type { ProgressStore } from "@/lib/progress/store";
import type { ProgressMission } from "@/lib/progress/types";
import { RewardEffectsProvider } from "./reward-effects-provider";

const ProgressContext = createContext<{
  store: ProgressStore;
  missions: ProgressMission[];
} | null>(null);

export function ProgressProvider({
  missions,
  children,
}: {
  missions: ProgressMission[];
  children: ReactNode;
}) {
  const [store] = useState(() =>
    createProgressStore(
      new LocalProgressRepository(() => window.localStorage),
      missions,
    ),
  );
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(PROGRESS_KEY))
        store.refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [store]);
  return (
    <ProgressContext.Provider value={{ store, missions }}>
      <RewardEffectsProvider missions={missions}>
        <ProgressStorageNotice />
        {children}
      </RewardEffectsProvider>
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error("ProgressProvider is required");
  const snapshot = useSyncExternalStore(
    context.store.subscribe,
    context.store.getSnapshot,
    context.store.getServerSnapshot,
  );
  return { ...context, ...snapshot };
}

function ProgressStorageNotice() {
  const { ready, storage } = useProgress();
  if (!ready || storage === "saved") return null;
  const text =
    storage === "recovered"
      ? "Повреждённые записи прогресса пропущены. Доступные результаты восстановлены."
      : storage === "unsupported"
        ? "Формат сохранённого прогресса пока не поддерживается. Он сохранён без изменений. Новые результаты доступны в этой вкладке."
        : "Сохранение прогресса недоступно. Новые результаты останутся в этой вкладке до её закрытия.";
  return (
    <div className="container progress-storage-notice" role="status">
      {text}
    </div>
  );
}
