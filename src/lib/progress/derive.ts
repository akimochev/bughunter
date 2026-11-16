import { achievements, emptyMissionProgress } from "./rules";
import type {
  AchievementId,
  ProgressEvent,
  ProgressMission,
  ProgressState,
} from "./types";

export function deriveProgress(
  events: ProgressEvent[],
  missions: ProgressMission[],
): ProgressState {
  const state: ProgressState = {
    version: 1,
    missions: {},
    achievements: {},
    awards: Object.create(null),
    totalXp: 0,
    totalStars: 0,
    completedCount: 0,
  };
  const unique = new Map(events.map((event) => [event.id, event]));
  for (const event of [...unique.values()].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )) {
    if (!missions.some((mission) => mission.id === event.missionId)) continue;
    const progress = (state.missions[event.missionId] ??=
      emptyMissionProgress());
    if (event.kind === "replay") {
      progress.activeSessionId = event.id;
      progress.sessions[event.id] ??= {
        hintsUsed: 0,
        attempts: 0,
        completed: false,
      };
      continue;
    }
    const sessionId = event.kind === "initialize" ? "initial" : event.sessionId;
    const session = (progress.sessions[sessionId] ??= {
      hintsUsed: 0,
      attempts: 0,
      completed: false,
    });
    session.hintsUsed = Math.max(session.hintsUsed, event.hintsUsed);
    if (event.kind === "initialize") progress.initialized = true;
    if (event.kind !== "submission") continue;
    progress.statistics.submissions++;
    if (event.counted) {
      session.attempts++;
      progress.statistics.counted++;
    }
    if (event.outcome === "cancelled") progress.statistics.cancelled++;
    if (event.outcome === "infrastructure")
      progress.statistics.infrastructure++;
    if (!event.reward || event.outcome !== "accepted") continue;
    progress.statistics.accepted++;
    session.completed = true;
    const previousXp = progress.best?.xp ?? 0;
    if (event.reward.xp > previousXp)
      progress.best = { ...event.reward, completedAt: event.createdAt };
    const completed = missions.filter(
      (mission) => state.missions[mission.id]?.best != null,
    ).length;
    const conditions: Record<AchievementId, boolean> = {
      "first-case": completed >= 1,
      perfect: event.reward.stars === 3,
      unassisted: event.reward.hintsUsed === 0,
      experienced: completed >= 3,
      master: missions.length > 0 && completed === missions.length,
    };
    const newAchievements: AchievementId[] = [];
    for (const achievement of achievements) {
      if (conditions[achievement.id] && !state.achievements[achievement.id]) {
        state.achievements[achievement.id] = event.createdAt;
        newAchievements.push(achievement.id);
      }
    }
    state.awards[event.id] = {
      ...event.reward,
      requestId: event.id,
      missionId: event.missionId,
      xpDelta: Math.max(0, event.reward.xp - previousXp),
      newAchievements,
    };
  }
  for (const mission of missions) {
    const best = state.missions[mission.id]?.best;
    if (best) {
      state.totalXp += best.xp;
      state.totalStars += best.stars;
      state.completedCount++;
    }
  }
  return state;
}
