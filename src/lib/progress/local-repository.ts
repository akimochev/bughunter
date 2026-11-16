import { calculateReward } from "./rules";
import type {
  ProgressEvent,
  ProgressRepository,
  ProgressState,
  StorageStatus,
} from "./types";

export const PROGRESS_KEY = "bughunter_progress_v1";
export const EVENT_PREFIX = `${PROGRESS_KEY}:event:`;
export interface ProgressStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function parseProgressEvent(raw: string): ProgressEvent | null {
  try {
    const event = JSON.parse(raw) as ProgressEvent;
    if (
      !event ||
      event.version !== 1 ||
      typeof event.id !== "string" ||
      event.id.length > 160 ||
      !Number.isSafeInteger(event.missionId) ||
      typeof event.createdAt !== "string" ||
      !Number.isFinite(Date.parse(event.createdAt))
    )
      return null;
    // Invalid UTF-16 must not escape the parser and abort the entire journal load.
    encodeURIComponent(event.id);
    if (event.kind === "replay") return event;
    if (
      !Number.isInteger(event.hintsUsed) ||
      event.hintsUsed < 0 ||
      event.hintsUsed > 3
    )
      return null;
    if (event.kind === "initialize") return event;
    if (typeof event.sessionId !== "string") return null;
    if (event.kind === "hint") return event;
    if (
      event.kind !== "submission" ||
      typeof event.counted !== "boolean" ||
      !["accepted", "rejected", "cancelled", "infrastructure"].includes(
        event.outcome,
      )
    )
      return null;
    if (
      ["cancelled", "infrastructure"].includes(event.outcome) &&
      event.counted
    )
      return null;
    if (event.outcome !== "accepted")
      return event.reward === null ? event : null;
    const reward = event.reward;
    if (
      !event.counted ||
      !reward ||
      !Number.isSafeInteger(reward.attempts) ||
      reward.attempts < 1 ||
      reward.hintsUsed !== event.hintsUsed
    )
      return null;
    const expected = calculateReward(reward.hintsUsed, reward.attempts);
    return reward.stars === expected.stars && reward.xp === expected.xp
      ? event
      : null;
  } catch {
    return null;
  }
}

export class LocalProgressRepository implements ProgressRepository {
  constructor(private readonly getStorage: () => ProgressStorage) {}
  load(): { events: ProgressEvent[]; status: StorageStatus } {
    const events: ProgressEvent[] = [];
    let status: StorageStatus = "saved";
    try {
      const storage = this.getStorage();
      const raw = storage.getItem(PROGRESS_KEY);
      if (raw) {
        try {
          const document = JSON.parse(raw);
          status = document?.version === 1 ? "saved" : "unsupported";
        } catch {
          status = "recovered";
        }
      }
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (!key?.startsWith(EVENT_PREFIX)) continue;
        const event = parseProgressEvent(storage.getItem(key) ?? "");
        if (event && key === EVENT_PREFIX + encodeURIComponent(event.id))
          events.push(event);
        else if (status === "saved") status = "recovered";
      }
      return { events, status };
    } catch {
      return { events, status: "unavailable" };
    }
  }
  append(event: ProgressEvent, state: ProgressState): StorageStatus {
    if (this.load().status === "unsupported") return "unsupported";
    try {
      const storage = this.getStorage();
      const key = EVENT_PREFIX + encodeURIComponent(event.id);
      if (!storage.getItem(key)) storage.setItem(key, JSON.stringify(event));
      // The snapshot is a cache. Immutable event keys remain authoritative across tabs.
      storage.setItem(PROGRESS_KEY, JSON.stringify(state));
      return "saved";
    } catch {
      return "unavailable";
    }
  }
  clear(): void {
    const storage = this.getStorage();
    const keys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    );
    for (const key of keys)
      if (key === PROGRESS_KEY || key?.startsWith(EVENT_PREFIX))
        storage.removeItem(key);
  }
}
