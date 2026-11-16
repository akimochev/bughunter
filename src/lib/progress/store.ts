import { assessSubmission } from "@/lib/verification/grading";
import type { SolutionCheck } from "@/lib/verification/use-solution-verifier";
import type { VerificationResult } from "@/lib/verification/types";
import { deriveProgress } from "./derive";
import {
  calculateReward,
  countsForReward,
  currentSession,
  isMissionUnlocked,
} from "./rules";
import type {
  ProgressEvent,
  ProgressMission,
  ProgressRepository,
  ProgressSnapshot,
} from "./types";

export function createProgressStore(
  repository: ProgressRepository,
  missions: ProgressMission[],
) {
  const initial: ProgressSnapshot = {
    ready: false,
    storage: "saved",
    progress: deriveProgress([], missions),
  };
  let snapshot = initial;
  let events: ProgressEvent[] = [];
  const pending = new Map<string, ProgressEvent>();
  const listeners = new Set<() => void>();

  function refresh() {
    const loaded = repository.load();
    events = [
      ...new Map(
        [...loaded.events, ...pending.values()].map((event) => [
          event.id,
          event,
        ]),
      ).values(),
    ];
    snapshot = {
      ready: true,
      storage:
        pending.size > 0 && loaded.status !== "unsupported"
          ? "unavailable"
          : loaded.status,
      progress: deriveProgress(events, missions),
    };
  }
  function notify() {
    listeners.forEach((listener) => listener());
  }
  function record(event: ProgressEvent) {
    if (events.some((existing) => existing.id === event.id)) return;
    pending.set(event.id, event);
    const state = deriveProgress([...events, event], missions);
    for (const item of pending.values())
      if (repository.append(item, state) === "saved") pending.delete(item.id);
    refresh();
    notify();
  }
  function available(missionId: number): boolean {
    refresh();
    const mission = missions.find((item) => item.id === missionId);
    return Boolean(
      mission && isMissionUnlocked(mission, snapshot.progress, missions),
    );
  }
  function base(missionId: number) {
    const lastTimestamp = events.reduce(
      (latest, event) => Math.max(latest, Date.parse(event.createdAt)),
      0,
    );
    const timestamp = Math.min(
      8640000000000000,
      Math.max(Date.now(), lastTimestamp + 1),
    );
    return {
      version: 1 as const,
      id: crypto.randomUUID(),
      missionId,
      createdAt: new Date(timestamp).toISOString(),
    };
  }

  return {
    getServerSnapshot: () => initial,
    getSnapshot() {
      if (!snapshot.ready) refresh();
      return snapshot;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh() {
      refresh();
      notify();
    },
    initialize(missionId: number, legacyHints: number) {
      if (
        !available(missionId) ||
        snapshot.progress.missions[missionId]?.initialized
      )
        return;
      record({
        ...base(missionId),
        kind: "initialize",
        hintsUsed: Math.min(3, Math.max(0, legacyHints)),
      });
    },
    openHint(missionId: number) {
      if (!available(missionId)) return;
      const progress = snapshot.progress.missions[missionId];
      const session = currentSession(progress);
      if (session.hintsUsed >= 3) return;
      record({
        ...base(missionId),
        kind: "hint",
        sessionId: progress?.activeSessionId ?? "initial",
        hintsUsed: session.hintsUsed + 1,
      });
    },
    startReplay(missionId: number): boolean {
      if (
        !available(missionId) ||
        !currentSession(snapshot.progress.missions[missionId]).completed
      )
        return false;
      record({ ...base(missionId), kind: "replay" });
      return true;
    },
    recordOutcome(
      missionId: number,
      sessionId: string,
      hintsAtStart: number,
      request: SolutionCheck,
      result: VerificationResult,
      buggyLine: number,
    ) {
      if (
        request.kind !== "submit" ||
        result.requestId !== request.requestId ||
        !available(missionId) ||
        events.some((event) => event.id === request.requestId)
      )
        return;
      const progress = snapshot.progress.missions[missionId];
      const session = progress?.sessions[sessionId];
      if (!session) return;
      const counted = countsForReward(result);
      const hintsUsed = Math.max(session.hintsUsed, hintsAtStart);
      const accepted =
        counted &&
        result.total > 0 &&
        result.total === request.testCases.length &&
        result.results.length === result.total &&
        result.passed === result.total &&
        result.results.every((row) => row.status === "passed") &&
        assessSubmission(request.selectedLine, buggyLine, result).accepted;
      record({
        ...base(missionId),
        id: request.requestId,
        kind: "submission",
        sessionId,
        counted,
        hintsUsed,
        outcome: accepted
          ? "accepted"
          : result.status === "cancelled"
            ? "cancelled"
            : counted
              ? "rejected"
              : "infrastructure",
        reward: accepted
          ? calculateReward(hintsUsed, session.attempts + 1)
          : null,
      });
    },
    clear(): boolean {
      try {
        repository.clear();
        pending.clear();
        refresh();
        notify();
        return true;
      } catch {
        snapshot = { ...snapshot, storage: "unavailable" };
        notify();
        return false;
      }
    },
  };
}

export type ProgressStore = ReturnType<typeof createProgressStore>;
