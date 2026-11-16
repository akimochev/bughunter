import { isMissionUnlocked } from "@/lib/progress/rules";
import type {
  AchievementId,
  AwardReceipt,
  ProgressMission,
  ProgressState,
} from "@/lib/progress/types";
import type { MissionDraft } from "@/lib/mission-draft";
import type { MissionTier } from "@/types/mission";

export interface RewardPresentation {
  id: string;
  missionId: number;
  award: AwardReceipt;
  totalXp: number;
  completedBefore: number;
  completedAfter: number;
  achievements: AchievementId[];
  levels: MissionTier[];
  motionAllowed: boolean;
}
interface Confirmation {
  missionId: number;
  request: {
    requestId: string;
    kind: "run" | "submit";
    sourceCode: string;
    selectedLine: number | null;
  };
  currentDraft: Pick<MissionDraft, "code" | "selectedLine">;
  before: ProgressState;
  after: ProgressState;
  motionAllowed: boolean;
}

// Ephemeral presentation only. Never reads/writes storage or awards XP.
// publish is called by the verification completion handler, never by hydration.
export function createRewardEffects(missions: ProgressMission[]) {
  const seen = new Set<string>();
  const listeners = new Set<() => void>();
  const empty = { highlightedIds: [] as number[], expiresAt: 0 };
  let snapshot = empty;
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => empty,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish({
      missionId,
      request,
      currentDraft,
      before,
      after,
      motionAllowed,
    }: Confirmation): RewardPresentation | null {
      const award = after.awards[request.requestId];
      if (
        request.kind !== "submit" ||
        !award ||
        award.missionId !== missionId ||
        seen.has(request.requestId)
      )
        return null;
      seen.add(request.requestId);
      if (
        request.sourceCode !== currentDraft.code ||
        request.selectedLine !== currentDraft.selectedLine
      )
        return null;
      const newlyUnlocked = missions.filter(
        (mission) =>
          !isMissionUnlocked(mission, before, missions) &&
          isMissionUnlocked(mission, after, missions),
      );
      if (newlyUnlocked.length) {
        snapshot = {
          highlightedIds: [
            ...new Set([
              ...snapshot.highlightedIds,
              ...newlyUnlocked.map((mission) => mission.id),
            ]),
          ],
          expiresAt: Date.now() + 20_000,
        };
        listeners.forEach((listener) => listener());
      }
      return {
        id: award.requestId,
        missionId,
        award,
        totalXp: after.totalXp,
        completedBefore: before.completedCount,
        completedAfter: after.completedCount,
        achievements: award.newAchievements.filter(
          (id) => !before.achievements[id] && Boolean(after.achievements[id]),
        ),
        levels: [...new Set(newlyUnlocked.map((mission) => mission.tier))],
        motionAllowed,
      };
    },
    expireHighlights(expiresAt: number) {
      if (snapshot.expiresAt !== expiresAt) return;
      snapshot = empty;
      listeners.forEach((listener) => listener());
    },
  };
}
