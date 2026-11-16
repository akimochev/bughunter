import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { getMission, missions, toLearnerMission } from "@/content/missions";
import { TierBadge } from "@/components/ui";
import { MissionWorkspace } from "@/components/missions/mission-workspace";
import { MissionAccess } from "@/components/missions/mission-access";

interface MissionPageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return missions.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: MissionPageProps): Promise<Metadata> {
  const mission = getMission((await params).slug);
  return { title: mission ? mission.title : "Дело не найдено" };
}

export default async function MissionPage({ params }: MissionPageProps) {
  const mission = getMission((await params).slug);
  if (!mission) notFound();

  return (
    <div className="container page-content mission-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <Link href="/missions">Карта дел</Link>
        <ChevronRight size={14} />
        <span>Дело {String(mission.id).padStart(2, "0")}</span>
      </nav>
      <div className="mission-heading">
        <div>
          <div className="mission-heading-meta">
            <TierBadge tier={mission.tier} />
            <span className="preview-label">Учебное дело</span>
          </div>
          <h1>{mission.title}</h1>
          <p className="muted">{mission.topic}</p>
        </div>
        <Link className="text-link" href="/missions">
          <ArrowLeft size={16} />К карте дел
        </Link>
      </div>
      <MissionAccess
        mission={{
          id: mission.id,
          slug: mission.slug,
          title: mission.title,
          tier: mission.tier,
        }}
      >
        <MissionWorkspace
          key={mission.slug}
          mission={toLearnerMission(mission)}
        />
      </MissionAccess>
    </div>
  );
}
