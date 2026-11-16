"use client";

import { useState } from "react";
import { FolderSearch } from "lucide-react";
import { tiers } from "@/content/mission-tiers";
import { ProgressMissionCard } from "@/components/missions/progress-mission-card";
import { useProgress } from "@/components/progress/progress-provider";
import { isMissionUnlocked } from "@/lib/progress/rules";
import type { MissionSummary, MissionTier } from "@/types/mission";

const tierOrder: MissionTier[] = ["beginner", "intermediate", "advanced"];

export function MissionCatalog({ missions }: { missions: MissionSummary[] }) {
  const [filter, setFilter] = useState<MissionTier | "all">("all");
  const { ready, progress } = useProgress();
  const visibleTiers = filter === "all" ? tierOrder : [filter];

  return (
    <>
      <div className="catalog-toolbar">
        <div className="filter-list" role="group" aria-label="Фильтр по уровню">
          <button
            onClick={() => setFilter("all")}
            aria-pressed={filter === "all"}
          >
            Все дела <span>{missions.length}</span>
          </button>
          {tierOrder.map((tier) => (
            <button
              key={tier}
              onClick={() => setFilter(tier)}
              aria-pressed={filter === tier}
            >
              {tiers[tier].label}
            </button>
          ))}
        </div>
        <span className="catalog-count">
          <FolderSearch size={16} /> Доступно дел —{" "}
          {ready
            ? missions.filter((mission) =>
                isMissionUnlocked(mission, progress, missions),
              ).length
            : "…"}
        </span>
      </div>
      <div aria-live="polite">
        {visibleTiers.map((tier) => (
          <section
            key={tier}
            id={`level-${tier}`}
            className="catalog-group"
            aria-label={tiers[tier].label}
          >
            <div className="group-heading">
              <h2>{tiers[tier].label}</h2>
              <p>{tiers[tier].description}</p>
            </div>
            <div className="missions-grid">
              {missions
                .filter((mission) => mission.tier === tier)
                .map((mission) => (
                  <ProgressMissionCard key={mission.id} mission={mission} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
