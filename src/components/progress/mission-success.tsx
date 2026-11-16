import Link from "next/link";
import { ArrowRight, Award } from "lucide-react";
import { useProgress } from "./progress-provider";
import { StarRating } from "./star-rating";
import { achievements, isMissionUnlocked } from "@/lib/progress/rules";
import type { AwardReceipt } from "@/lib/progress/types";
export function MissionSuccess({ award }: { award: AwardReceipt }) {
  const { progress, missions } = useProgress();
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
  return (
    <section
      className="panel mission-success"
      aria-label="Награда за прохождение"
    >
      <div className="success-heading">
        <Award size={28} />
        <h2>Дело пройдено</h2>
      </div>
      <StarRating stars={award.stars} />
      <p>
        Результат прохождения — <strong>{award.xp} XP</strong>
      </p>
      <p>
        К общему опыту добавлено{" "}
        <strong data-testid="xp-delta">{award.xpDelta} XP</strong>. Всего —{" "}
        <strong>{progress.totalXp} XP</strong>.
      </p>
      <p className="muted">
        Учтено отправок — {award.attempts}, подсказок — {award.hintsUsed}.
        Лучший результат — {progress.missions[award.missionId]?.best?.xp} XP.
      </p>
      {award.newAchievements.length > 0 && (
        <ul className="new-achievements">
          {award.newAchievements.map((id) => (
            <li key={id}>
              Открыто достижение «
              {achievements.find((item) => item.id === id)?.title}»
            </li>
          ))}
        </ul>
      )}
      <Link
        className="button button-primary"
        href={next ? `/missions/${next.slug}` : "/profile"}
      >
        {next ? "Следующая миссия" : "К профилю"}
        <ArrowRight size={17} />
      </Link>
    </section>
  );
}
