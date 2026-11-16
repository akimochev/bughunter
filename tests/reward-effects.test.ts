import { describe, expect, it, vi } from "vitest";
import { createRewardEffects } from "@/lib/reward-effects";
import { deriveProgress } from "@/lib/progress/derive";
import { calculateReward } from "@/lib/progress/rules";
import { missionSummaries } from "@/content/missions";
import type { ProgressEvent } from "@/lib/progress/types";

function accepted(
  missionId: number,
  id = `accepted-${missionId}`,
  hints = 0,
  timestamp = 1,
): ProgressEvent {
  return {
    version: 1,
    kind: "submission",
    missionId,
    id,
    sessionId: "initial",
    createdAt: new Date(timestamp).toISOString(),
    counted: true,
    outcome: "accepted",
    hintsUsed: hints,
    reward: calculateReward(hints, 1),
  };
}
function confirmation(events: ProgressEvent[] = [], event = accepted(1)) {
  return {
    missionId: event.missionId,
    request: {
      requestId: event.id,
      kind: "submit" as "submit" | "run",
      sourceCode: "code",
      selectedLine: 3 as number | null,
    },
    currentDraft: { code: "code", selectedLine: 3 as number | null },
    before: deriveProgress(events, missionSummaries),
    after: deriveProgress([...events, event], missionSummaries),
    motionAllowed: true,
  };
}

describe("визуальные эффекты подтверждённого прогресса", () => {
  it("не показывает награды при создании, чтении снимка и повторной гидратации", () => {
    const effects = createRewardEffects(missionSummaries);
    expect(effects.getSnapshot()).toEqual({ highlightedIds: [], expiresAt: 0 });
    const loaded = confirmation().after;
    expect(loaded.totalXp).toBe(100);
    // Hydration has no publish event, including a fresh provider after a reload.
    expect(createRewardEffects(missionSummaries).getSnapshot()).toEqual(
      effects.getSnapshot(),
    );
  });
  it("показывает фактическую награду и компактную группу новых достижений", () => {
    const effects = createRewardEffects(missionSummaries);
    const event = confirmation();
    const result = effects.publish(event)!;
    expect(result.award.xpDelta).toBe(100);
    expect(result.totalXp).toBe(100);
    expect(result.achievements).toEqual([
      "first-case",
      "perfect",
      "unassisted",
    ]);
    expect(result.completedBefore).toBe(0);
    expect(result.completedAfter).toBe(1);
    expect(result.levels).toEqual([]);
  });
  it("один requestId нельзя повторно показать из-за re-render или Strict Mode", () => {
    const effects = createRewardEffects(missionSummaries);
    const event = confirmation();
    expect(effects.publish(event)).not.toBeNull();
    expect(effects.publish({ ...event })).toBeNull();
    expect(effects.publish({ ...event, motionAllowed: false })).toBeNull();
  });
  it.each(["run", "failed", "wrong-mission", "stale-code", "stale-line"])(
    "не запускает награды для %s",
    (scenario) => {
      const effects = createRewardEffects(missionSummaries);
      const event = confirmation();
      if (scenario === "run") event.request.kind = "run";
      if (scenario === "failed") event.after = event.before;
      if (scenario === "wrong-mission") event.missionId = 2;
      if (scenario === "stale-code") event.currentDraft.code = "changed";
      if (scenario === "stale-line") event.currentDraft.selectedLine = 2;
      expect(effects.publish(event)).toBeNull();
      expect(effects.getSnapshot().highlightedIds).toEqual([]);
    },
  );
  it("возврат к прежнему коду не возобновляет устаревшую награду", () => {
    const effects = createRewardEffects(missionSummaries);
    const event = confirmation();
    expect(
      effects.publish({
        ...event,
        currentDraft: { ...event.currentDraft, code: "changed" },
      }),
    ).toBeNull();
    expect(effects.publish(event)).toBeNull();
  });
  it("показывает разницу 50 → 100 и не повторяет старые достижения", () => {
    const effects = createRewardEffects(missionSummaries);
    const first = accepted(1, "low", 2, 1);
    const event = confirmation([first], accepted(1, "improved", 0, 2));
    const result = effects.publish(event)!;
    expect(result.award.xpDelta).toBe(50);
    expect(result.totalXp).toBe(100);
    expect(result.achievements).toEqual(["perfect", "unassisted"]);
  });
  it("повторное прохождение без улучшения имеет нулевой XP и не повторяет достижения", () => {
    const event = confirmation([accepted(1)], accepted(1, "repeat", 0, 2));
    const result = createRewardEffects(missionSummaries).publish(event)!;
    expect(result.award.xpDelta).toBe(0);
    expect(result.achievements).toEqual([]);
    expect(result.levels).toEqual([]);
    expect(result.totalXp).toBe(100);
  });
  it("выделяет миссии только при реальном открытии следующего уровня", () => {
    const effects = createRewardEffects(missionSummaries);
    const partial = confirmation([accepted(1)], accepted(2));
    expect(effects.publish(partial)?.levels).toEqual([]);
    const event = confirmation([accepted(1), accepted(2)], accepted(3));
    expect(effects.publish(event)?.levels).toEqual(["intermediate"]);
    expect(effects.getSnapshot().highlightedIds).toEqual([4, 5, 6]);
    expect(effects.publish(event)).toBeNull();
    const repeat = confirmation(
      [accepted(1), accepted(2), accepted(3)],
      accepted(3, "again", 0, 2),
    );
    expect(effects.publish(repeat)?.levels).toEqual([]);
  });
  it("обнаруживает открытие Детектива существующими правилами", () => {
    const event = confirmation(
      [1, 2, 3, 4, 5].map((id) => accepted(id)),
      accepted(6),
    );
    expect(
      createRewardEffects(missionSummaries).publish(event)?.levels,
    ).toEqual(["advanced"]);
  });
  it("Reduce Motion сохраняет награды и не меняет исходный прогресс", () => {
    const event = confirmation();
    const original = JSON.stringify({
      before: event.before,
      after: event.after,
    });
    const result = createRewardEffects(missionSummaries).publish({
      ...event,
      motionAllowed: false,
    })!;
    expect(result.motionAllowed).toBe(false);
    expect(result.award.xpDelta).toBe(100);
    expect(result.achievements).toHaveLength(3);
    expect(JSON.stringify({ before: event.before, after: event.after })).toBe(
      original,
    );
  });
  it("выделение карточек исчезает, старый таймер не удаляет более новое выделение", () => {
    const effects = createRewardEffects(missionSummaries);
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      effects.publish(confirmation([accepted(1), accepted(2)], accepted(3)));
      const old = effects.getSnapshot().expiresAt;
      now.mockReturnValue(2000);
      effects.publish(
        confirmation(
          [1, 2, 3, 4, 5].map((id) => accepted(id)),
          accepted(6),
        ),
      );
      effects.expireHighlights(old);
      expect(effects.getSnapshot().highlightedIds).toContain(7);
      effects.expireHighlights(effects.getSnapshot().expiresAt);
      expect(effects.getSnapshot().highlightedIds).toEqual([]);
    } finally {
      now.mockRestore();
    }
  });
});
