import type { Metadata } from "next";
import { PageHeading } from "@/components/ui";
import { ProfileProgress } from "@/components/progress/profile-progress";

export const metadata: Metadata = {
  title: "Профиль",
  description:
    "Прогресс детектива BugHunter. Пройденные дела, лучшие звёзды, XP и достижения.",
};
export default function ProfilePage() {
  return (
    <div className="container page-content">
      <PageHeading eyebrow="ЛИЧНОЕ ДЕЛО" title="Профиль детектива">
        Твои расследования, лучшие результаты и достижения.
      </PageHeading>
      <ProfileProgress />
    </div>
  );
}
