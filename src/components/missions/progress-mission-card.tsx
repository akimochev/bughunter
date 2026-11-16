"use client";

import { MissionCard } from "@/components/ui";
import { useProgress } from "@/components/progress/progress-provider";
import { isMissionUnlocked, lockedReason } from "@/lib/progress/rules";
import type { MissionSummary } from "@/types/mission";
import { useRewardEffects } from "@/components/progress/reward-effects-provider";

export function ProgressMissionCard({ mission }: { mission: MissionSummary }) {
  const { ready, progress, missions } = useProgress();
  const best = progress.missions[mission.id]?.best;
  const { highlightedIds } = useRewardEffects();
  return (
    <MissionCard
      mission={mission}
      state={{
        loading: !ready,
        locked: !isMissionUnlocked(mission, progress, missions),
        reason: lockedReason(mission),
        stars: best?.stars ?? 0,
        xp: best?.xp ?? 0,
        newlyUnlocked: highlightedIds.includes(mission.id),
      }}
    />
  );
}
