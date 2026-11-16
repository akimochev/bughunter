import Link from "next/link";
import { LockKeyholeOpen } from "lucide-react";
import { tiers } from "@/content/mission-tiers";
import type { MissionTier } from "@/types/mission";
export function LevelUnlockedNotification({ tier }: { tier: MissionTier }) {
  return (
    <article
      className="reward-notice level-unlocked-notice"
      data-level-notification={tier}
    >
      <LockKeyholeOpen size={24} aria-hidden="true" />
      <div>
        <p className="notice-kind">Новые дела доступны</p>
        <h4>Открыт уровень «{tiers[tier].label}»</h4>
        <p>Можно продолжить обучение на новом уровне.</p>
        <Link className="text-link" href={`/missions#level-${tier}`}>
          Перейти к уровню «{tiers[tier].label}»
        </Link>
      </div>
    </article>
  );
}
