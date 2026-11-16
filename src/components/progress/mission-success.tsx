"use client";

import Link from "next/link";
import { ArrowRight, Award } from "lucide-react";
import type { CSSProperties } from "react";
import { useProgress } from "./progress-provider";
import { isMissionUnlocked } from "@/lib/progress/rules";
import type { AwardReceipt } from "@/lib/progress/types";
import type { RewardPresentation } from "@/lib/reward-effects";
import { StarReveal } from "./star-reveal";
import { XpReward } from "./xp-reward";
import { ProgressMeter } from "./progress-meter";
import { RewardNotifications } from "./reward-notifications";
import { useRewardMotion } from "./use-reward-motion";

export function MissionSuccess({
  award,
  explanation,
  presentation,
}: {
  award: AwardReceipt;
  explanation: string;
  presentation: RewardPresentation | null;
}) {
  const { progress, missions } = useProgress();
  const current =
    presentation?.id === award.requestId &&
    presentation.missionId === award.missionId
      ? presentation
      : null;
  const motion = useRewardMotion(current?.motionAllowed === true);
  const next =
    missions.find(
      (mission) =>
        mission.id > award.missionId &&
        !progress.missions[mission.id]?.best &&
        isMissionUnlocked(mission, progress, missions),
    ) ??
    missions.find(
      (mission) =>
        !progress.missions[mission.id]?.best &&
        isMissionUnlocked(mission, progress, missions),
    );
  const mission = missions.find((mission) => mission.id === award.missionId)!;
  const celebrate = motion && award.xpDelta > 0;
  return (
    <section
      className={`panel mission-success${motion ? " reward-enter" : ""}${celebrate ? " reward-glow" : ""}`}
      aria-label="Награда за прохождение"
      data-reward-request={award.requestId}
      data-reward-animated={motion}
    >
      {celebrate && (
        <div
          className="reward-particles"
          data-testid="reward-particles"
          aria-hidden="true"
        >
          {Array.from({ length: 14 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  left: `${7 + ((index * 19) % 85)}%`,
                  "--particle-dx": `${((index % 5) - 2) * 13}px`,
                  "--particle-delay": `${(index % 4) * 70}ms`,
                  "--particle-rotate": `${index % 2 ? 70 : -70}deg`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="success-heading">
        <Award size={28} aria-hidden="true" />
        <h2>Дело раскрыто!</h2>
      </div>
      <h3 className="reward-mission-title">{mission.title}</h3>
      <StarReveal stars={award.stars} animate={celebrate} />
      <XpReward
        delta={award.xpDelta}
        total={progress.totalXp}
        animate={celebrate && progress.totalXp === current?.totalXp}
      />
      <p className="reward-explanation">{explanation}</p>
      <p className="muted">
        Подсказок — {award.hintsUsed}, учтено отправок — {award.attempts}.
        Лучший результат — {progress.missions[award.missionId]?.best?.xp} XP.
      </p>
      <div className="success-learning-progress">
        <p>
          Раскрыто дел: {progress.completedCount} из {missions.length}
        </p>
        <ProgressMeter
          label="Прогресс обучения"
          value={progress.completedCount}
          max={missions.length}
          from={current?.completedBefore}
          animate={motion}
        />
      </div>
      {current &&
        (current.achievements.length > 0 || current.levels.length > 0) && (
          <RewardNotifications
            key={current.id}
            presentation={current}
            animate={motion}
          />
        )}
      <div className="success-actions">
        <Link
          className="button button-primary"
          href={next ? `/missions/${next.slug}` : "/profile"}
        >
          {next ? "Следующая миссия" : "К профилю"}
          <ArrowRight size={17} />
        </Link>
        <Link className="button button-secondary" href="/missions">
          Вернуться к заданиям
        </Link>
      </div>
    </section>
  );
}
