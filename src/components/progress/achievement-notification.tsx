import { Award } from "lucide-react";
import { achievements } from "@/lib/progress/rules";
import type { AchievementId } from "@/lib/progress/types";
export function AchievementNotification({ id }: { id: AchievementId }) {
  const achievement = achievements.find((item) => item.id === id)!;
  return (
    <article className="reward-notice" data-achievement-notification={id}>
      <Award size={24} aria-hidden="true" />
      <div>
        <p className="notice-kind">Новое достижение</p>
        <h4>{achievement.title}</h4>
        <p>{achievement.description}</p>
      </div>
    </article>
  );
}
