import Link from "next/link";
import {
  ArrowUpRight,
  Bug,
  Fingerprint,
  GitBranch,
  Hash,
  ListFilter,
  Search,
  ShoppingBag,
  Timer,
  CornerDownLeft,
  LockKeyhole,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { MissionSummary, MissionTier } from "@/types/mission";
import { tiers } from "@/content/mission-tiers";
import { StarRating } from "@/components/progress/star-rating";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="BugHunter — главная">
      <span className="brand-icon">
        <Bug size={22} strokeWidth={1.8} />
      </span>
      <span>
        Bug<span className="brand-light">Hunter</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}

export function TierBadge({ tier }: { tier: MissionTier }) {
  return (
    <span className={`tier-badge tier-${tier}`}>
      <span className="tier-bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {tiers[tier].label}
    </span>
  );
}

const missionIcons: LucideIcon[] = [
  ShoppingBag,
  Hash,
  CornerDownLeft,
  Fingerprint,
  Timer,
  ListFilter,
  Search,
  GitBranch,
];

export function MissionCard({
  mission,
  state,
}: {
  mission: MissionSummary;
  state?: {
    loading: boolean;
    locked: boolean;
    reason: string;
    stars: number;
    xp: number;
  };
}) {
  const Icon = missionIcons[mission.id - 1] ?? Bug;
  const className = `mission-card card-${mission.tier}${state?.locked ? " mission-card-locked" : ""}${state?.stars ? " mission-card-completed" : ""}`;
  const body = (
    <>
      <div className="mission-card-top">
        <span className="mission-icon">
          <Icon size={24} strokeWidth={1.6} />
        </span>
        <span className="case-number">
          ДЕЛО {String(mission.id).padStart(2, "0")}
        </span>
        {state?.locked ? (
          <LockKeyhole className="card-arrow" size={19} />
        ) : (
          <ArrowUpRight className="card-arrow" size={19} />
        )}
      </div>
      <TierBadge tier={mission.tier} />
      <h3>{mission.title}</h3>
      <p>{mission.description}</p>
      {state?.locked && <p className="lock-reason">{state.reason}</p>}
      {Boolean(state?.stars) && (
        <div className="card-reward">
          <StarRating stars={state!.stars} />
          <span>{state!.xp} XP</span>
        </div>
      )}
      <div className="mission-card-bottom">
        <span>{mission.topic}</span>
        <span className="preview-label">
          {state?.loading
            ? "Загрузка…"
            : state?.locked
              ? "Заблокировано"
              : state?.stars
                ? "Дело пройдено"
                : "Открыть дело"}
        </span>
      </div>
    </>
  );
  if (state?.loading || state?.locked)
    return (
      <article className={className} aria-busy={state.loading}>
        {body}
      </article>
    );
  return (
    <Link href={`/missions/${mission.slug}`} className={className}>
      {body}
    </Link>
  );
}

export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="page-description">{children}</p>
    </div>
  );
}
