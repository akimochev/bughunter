import { isValidLine } from "./line-selection";

import { MAX_CODE_LENGTH } from "./python/constants";
export { MAX_CODE_LENGTH } from "./python/constants";

export interface MissionDraft {
  version: 1;
  source: string;
  code: string;
  selectedLine: number | null;
  hintsUsed: number;
  submitAttempts: number;
}

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function draftKey(slug: string): string {
  return `bughunter_draft_v1:${slug}`;
}

export function createDraft(source: string): MissionDraft {
  return {
    version: 1,
    source,
    code: source,
    selectedLine: null,
    hintsUsed: 0,
    submitAttempts: 0,
  };
}

export function parseDraft(raw: string | null, source: string): MissionDraft {
  if (!raw) return createDraft(source);
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return createDraft(source);
    const draft = value as Partial<MissionDraft>;
    if (
      draft.version !== 1 ||
      draft.source !== source ||
      typeof draft.code !== "string" ||
      draft.code.length > MAX_CODE_LENGTH
    )
      return createDraft(source);
    return {
      version: 1,
      source,
      code: draft.code,
      submitAttempts:
        Number.isSafeInteger(draft.submitAttempts) && draft.submitAttempts! >= 0
          ? draft.submitAttempts!
          : 0,
      selectedLine: isValidLine(draft.selectedLine ?? null, source)
        ? draft.selectedLine!
        : null,
      hintsUsed:
        Number.isInteger(draft.hintsUsed) &&
        draft.hintsUsed! >= 0 &&
        draft.hintsUsed! <= 3
          ? draft.hintsUsed!
          : 0,
    };
  } catch {
    return createDraft(source);
  }
}

export interface DraftSnapshot {
  draft: MissionDraft;
  storage: "pending" | "saved" | "unavailable";
}

// One store per mounted mission. Writes affect only that mission's storage key.
export function createDraftStore(
  slug: string,
  source: string,
  getStorage: () => DraftStorage,
) {
  const initial: DraftSnapshot = {
    draft: createDraft(source),
    storage: "pending",
  };
  let snapshot = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  return {
    getServerSnapshot: () => initial,
    getSnapshot() {
      if (!loaded) {
        loaded = true;
        try {
          snapshot = {
            draft: parseDraft(getStorage().getItem(draftKey(slug)), source),
            storage: "saved",
          };
        } catch {
          snapshot = { draft: createDraft(source), storage: "unavailable" };
        }
      }
      return snapshot;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(
      change: Partial<
        Pick<
          MissionDraft,
          "code" | "selectedLine" | "hintsUsed" | "submitAttempts"
        >
      >,
    ) {
      const draft = { ...snapshot.draft, ...change };
      let storage: DraftSnapshot["storage"] = "saved";
      try {
        getStorage().setItem(draftKey(slug), JSON.stringify(draft));
      } catch {
        storage = "unavailable";
      }
      snapshot = { draft, storage };
      listeners.forEach((listener) => listener());
    },
    recordSubmission() {
      this.update({ submitAttempts: snapshot.draft.submitAttempts + 1 });
    },
  };
}
