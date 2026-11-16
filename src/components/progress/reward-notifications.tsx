"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AchievementNotification } from "./achievement-notification";
import { LevelUnlockedNotification } from "./level-unlocked-notification";
import type { RewardPresentation } from "@/lib/reward-effects";

export function RewardNotifications({
  presentation,
  animate,
}: {
  presentation: RewardPresentation;
  animate: boolean;
}) {
  const [phase, setPhase] = useState<"shown" | "leaving" | "hidden">("shown");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => {
    timers.current = [
      setTimeout(
        () => setPhase((old) => (old === "hidden" ? old : "leaving")),
        9000,
      ),
      setTimeout(() => setPhase("hidden"), 9250),
    ];
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [presentation.id]);
  if (
    phase === "hidden" ||
    (!presentation.achievements.length && !presentation.levels.length)
  )
    return null;
  return (
    <div
      className={`reward-notifications${animate ? " notices-enter" : ""}${phase === "leaving" ? " notices-exit" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Открытые награды"
      onFocusCapture={() => {
        clear();
        setPhase("shown");
      }}
      onMouseEnter={() => {
        clear();
        setPhase("shown");
      }}
    >
      <div className="reward-notices-heading">
        <span>Новые возможности</span>
        <button
          className="notice-close"
          aria-label="Закрыть уведомления"
          onClick={(event) => {
            clear();
            event.currentTarget
              .closest(".mission-success")
              ?.querySelector<HTMLAnchorElement>(".success-actions a")
              ?.focus();
            setPhase("hidden");
          }}
        >
          <X size={18} />
        </button>
      </div>
      <div className="reward-notices-grid">
        {presentation.achievements.map((id) => (
          <AchievementNotification key={id} id={id} />
        ))}
        {presentation.levels.map((tier) => (
          <LevelUnlockedNotification key={tier} tier={tier} />
        ))}
      </div>
    </div>
  );
}
