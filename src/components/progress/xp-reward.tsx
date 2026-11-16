"use client";

import { useEffect, useState } from "react";
export function XpReward({
  delta,
  total,
  animate,
}: {
  delta: number;
  total: number;
  animate: boolean;
}) {
  const from = total - delta;
  const [displayed, setDisplayed] = useState(from);
  useEffect(() => {
    if (!animate || delta <= 0) return;
    let frame = 0;
    let start: number | null = null;
    function tick(now: number) {
      start ??= now;
      const fraction = Math.min(1, (now - start) / 800);
      setDisplayed(Math.round(from + delta * (1 - (1 - fraction) ** 3)));
      if (fraction < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animate, delta, from]);
  return (
    <div className="xp-reward">
      {delta > 0 ? (
        <p className="xp-earned">
          Начислено +<strong data-testid="xp-delta">{delta} XP</strong>
        </p>
      ) : (
        <p>
          Лучший результат сохранён. Новые XP не начислены —{" "}
          <strong data-testid="xp-delta">0 XP</strong>.
        </p>
      )}
      <p>
        <span className="xp-total-accessible">Общий опыт — {total} XP.</span>
        <span aria-hidden="true">
          Общий опыт —{" "}
          <strong data-testid="animated-total-xp">
            {animate && delta > 0 ? displayed : total} XP
          </strong>
          .
        </span>
      </p>
    </div>
  );
}
