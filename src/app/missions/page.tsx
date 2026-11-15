import type { Metadata } from "next";
import { Info } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { MissionCatalog } from "@/components/mission-catalog";
import { missions } from "@/content/missions";

export const metadata: Metadata = {
  title: "Карта дел",
  description:
    "Детективные миссии по Python — от первых циклов до двух указателей. Исследуй код и подготовь исправление в BugHunter.",
};

export default function MissionsPage() {
  return (
    <div className="container page-content">
      <PageHeading eyebrow="АРХИВ РАССЛЕДОВАНИЙ" title="Карта дел">
        У каждой программы своя история. Выбери дело и посмотри, что предстоит
        расследовать.
      </PageHeading>
      <div className="stage-notice">
        <Info size={19} />
        <p>
          Все дела доступны для исследования, редактирования и запуска Python.
          Проверка решений появится на следующем этапе, открытие уровней — на
          этапе 4.
        </p>
      </div>
      <MissionCatalog
        missions={missions.map(
          ({ id, slug, title, tier, description, topic, functionName }) => ({
            id,
            slug,
            title,
            tier,
            description,
            topic,
            functionName,
          }),
        )}
      />
    </div>
  );
}
