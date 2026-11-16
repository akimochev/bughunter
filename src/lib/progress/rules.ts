import type { VerificationResult } from "@/lib/verification/types";
import type {
  AchievementId,
  LearningSession,
  MissionProgress,
  ProgressMission,
  ProgressState,
  Reward,
  Stars,
} from "./types";

export const achievements: {
  id: AchievementId;
  title: string;
  description: string;
}[] = [
  {
    id: "first-case",
    title: "Первое дело",
    description: "Завершить свою первую миссию.",
  },
  {
    id: "perfect",
    title: "Идеальный детектив",
    description: "Получить 3 звезды за миссию.",
  },
  {
    id: "unassisted",
    title: "Без подсказок",
    description: "Пройти миссию без помощи.",
  },
  {
    id: "experienced",
    title: "Опытный следователь",
    description: "Завершить 3 миссии.",
  },
  {
    id: "master",
    title: "Мастер отладки",
    description: "Завершить все миссии.",
  },
];

export function calculateReward(hintsUsed: number, attempts: number): Reward {
  let stars: Stars = 1;
  if (hintsUsed === 0 && attempts <= 2) stars = 3;
  else if (hintsUsed <= 1 && attempts <= 4) stars = 2;
  return { stars, xp: xpForStars(stars), hintsUsed, attempts };
}

export function xpForStars(stars: Stars): 50 | 75 | 100 {
  return ({ 1: 50, 2: 75, 3: 100 } as const)[stars];
}

export function emptyMissionProgress(): MissionProgress {
  const sessions: Record<string, LearningSession> = Object.create(null);
  sessions.initial = { hintsUsed: 0, attempts: 0, completed: false };
  return {
    initialized: false,
    activeSessionId: "initial",
    sessions,
    best: null,
    statistics: {
      submissions: 0,
      counted: 0,
      accepted: 0,
      cancelled: 0,
      infrastructure: 0,
    },
  };
}

export function currentSession(
  progress: MissionProgress | undefined,
): LearningSession {
  return (
    progress?.sessions[progress.activeSessionId] ?? {
      hintsUsed: 0,
      attempts: 0,
      completed: false,
    }
  );
}

export function isMissionUnlocked(
  mission: ProgressMission,
  state: ProgressState,
  missions: ProgressMission[],
): boolean {
  const order = ["beginner", "intermediate", "advanced"];
  const tierIndex = order.indexOf(mission.tier);
  return missions
    .filter((item) => order.indexOf(item.tier) < tierIndex)
    .every((item) => state.missions[item.id]?.best != null);
}

export function lockedReason(mission: ProgressMission): string {
  return mission.tier === "intermediate"
    ? "Заверши все дела уровня «Новичок»."
    : "Заверши все дела уровней «Новичок» и «Практик».";
}

export function countsForReward(result: VerificationResult): boolean {
  if (result.status === "cancelled" || result.timeoutPhase === "loading")
    return false;
  if (result.results.length === 0) return false;
  return !result.results.some((row) =>
    ["LoadError", "LoadTimeoutError", "WorkerError", "CancelledError"].includes(
      row.execution?.errorType ?? "",
    ),
  );
}
