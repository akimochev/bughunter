"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { useProgress } from "@/components/progress/progress-provider";
import { isMissionUnlocked, lockedReason } from "@/lib/progress/rules";
import type { ProgressMission } from "@/lib/progress/types";

export function MissionAccess({
  mission,
  children,
}: {
  mission: ProgressMission;
  children: ReactNode;
}) {
  const { ready, progress, missions } = useProgress();
  if (!ready)
    return (
      <div className="panel access-panel" role="status">
        Загружаем прогресс…
      </div>
    );
  if (!isMissionUnlocked(mission, progress, missions))
    return (
      <section className="panel access-panel">
        <LockKeyhole size={30} />
        <h2>Уровень пока закрыт</h2>
        <p>{lockedReason(mission)}</p>
        <Link className="button button-primary" href="/missions">
          К доступным миссиям
        </Link>
      </section>
    );
  return children;
}
