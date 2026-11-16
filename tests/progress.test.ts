import { describe, expect, it } from "vitest";
import { missions, missionSummaries } from "@/content/missions";
import { createProgressStore } from "@/lib/progress/store";
import {
  LocalProgressRepository,
  PROGRESS_KEY,
  EVENT_PREFIX,
  parseProgressEvent,
} from "@/lib/progress/local-repository";
import {
  calculateReward,
  currentSession,
  isMissionUnlocked,
} from "@/lib/progress/rules";
import { gradeTest } from "@/lib/verification/grading";
import type { SolutionCheck } from "@/lib/verification/use-solution-verifier";
import type { VerificationResult } from "@/lib/verification/types";

export class MemoryStorage {
  data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}
function setup(storage = new MemoryStorage()) {
  return {
    storage,
    store: createProgressStore(
      new LocalProgressRepository(() => storage),
      missionSummaries,
    ),
  };
}
function proof(
  missionId = 1,
  kind: "run" | "submit" = "submit",
  correctLine = true,
) {
  const mission = missions.find((item) => item.id === missionId)!;
  const request: SolutionCheck = {
    requestId: crypto.randomUUID(),
    kind,
    selectedLine: correctLine ? mission.content.buggyLine : 1,
    sourceCode: mission.content.referenceSolution,
    functionName: mission.functionName,
    testCases:
      kind === "run"
        ? mission.content.publicTests
        : [...mission.content.publicTests, ...mission.content.hiddenTests],
  };
  const result: VerificationResult = {
    requestId: request.requestId,
    status: "passed",
    passed: request.testCases.length,
    total: request.testCases.length,
    durationMs: 10,
    errorMessage: null,
    results: request.testCases.map((testCase) =>
      gradeTest(testCase, {
        requestId: testCase.id,
        status: "success",
        hasReturnValue: true,
        returnValue: testCase.expected,
        stdout: "",
        stderr: "",
        durationMs: 1,
        errorType: null,
        errorMessage: null,
      }),
    ),
  };
  return { request, result, buggyLine: mission.content.buggyLine };
}
function finish(
  store: ReturnType<typeof setup>["store"],
  missionId = 1,
  options: {
    hints?: number;
    kind?: "run" | "submit";
    correctLine?: boolean;
    mutate?: (result: VerificationResult) => void;
  } = {},
) {
  store.initialize(missionId, options.hints ?? 0);
  const data = proof(missionId, options.kind, options.correctLine);
  options.mutate?.(data.result);
  const progress = store.getSnapshot().progress.missions[missionId];
  store.recordOutcome(
    missionId,
    progress?.activeSessionId ?? "initial",
    currentSession(progress).hintsUsed,
    data.request,
    data.result,
    data.buggyLine,
  );
  return data;
}

describe("звёзды и XP", () => {
  it.each([
    [0, 1, 3, 100],
    [0, 2, 3, 100],
    [0, 3, 2, 75],
    [0, 4, 2, 75],
    [0, 5, 1, 50],
    [1, 1, 2, 75],
    [1, 4, 2, 75],
    [1, 5, 1, 50],
    [2, 1, 1, 50],
    [3, 2, 1, 50],
  ])("подсказок %i, отправок %i", (hints, attempts, stars, xp) => {
    expect(calculateReward(hints, attempts)).toMatchObject({ stars, xp });
  });
  it("не выдаёт награду за Run, неверную строку и ошибочное решение", () => {
    const { store } = setup();
    finish(store, 1, { kind: "run" });
    expect(store.getSnapshot().progress.totalXp).toBe(0);
    expect(
      currentSession(store.getSnapshot().progress.missions[1]).attempts,
    ).toBe(0);
    finish(store, 1, { correctLine: false });
    finish(store, 1, {
      mutate: (result) => {
        result.status = "failed";
        result.passed = 0;
        result.results[0].status = "failed";
      },
    });
    expect(store.getSnapshot().progress.totalXp).toBe(0);
    expect(
      currentSession(store.getSnapshot().progress.missions[1]).attempts,
    ).toBe(2);
    finish(store);
    expect(store.getSnapshot().progress.missions[1].best).toMatchObject({
      stars: 2,
      xp: 75,
      attempts: 3,
    });
  });
  it("начисляет только улучшение и не дублирует один requestId", () => {
    const { store } = setup();
    const first = finish(store, 1, { hints: 2 });
    expect(store.getSnapshot().progress.totalXp).toBe(50);
    const entry = store.getSnapshot().progress.missions[1];
    store.recordOutcome(
      1,
      entry.activeSessionId,
      2,
      first.request,
      first.result,
      first.buggyLine,
    );
    expect(
      store.getSnapshot().progress.missions[1].statistics.submissions,
    ).toBe(1);
    finish(store);
    expect(store.getSnapshot().progress.totalXp).toBe(50);
    expect(store.startReplay(1)).toBe(true);
    const improved = finish(store);
    expect(store.getSnapshot().progress.totalXp).toBe(100);
    expect(
      store.getSnapshot().progress.awards[improved.request.requestId].xpDelta,
    ).toBe(50);
    finish(store);
    expect(store.getSnapshot().progress.totalXp).toBe(100);
  });
  it("не позволяет сбрасывать штрафы незавершённого прохождения", () => {
    const { store } = setup();
    store.initialize(1, 1);
    expect(store.startReplay(1)).toBe(false);
    finish(store, 1, { correctLine: false });
    expect(store.startReplay(1)).toBe(false);
    finish(store);
    expect(store.startReplay(1)).toBe(true);
    store.openHint(1);
    expect(store.startReplay(1)).toBe(false);
    expect(
      currentSession(store.getSnapshot().progress.missions[1]).hintsUsed,
    ).toBe(1);
  });
  it("исключает отмену, сбои загрузки и ожидание загрузки из попыток награды", () => {
    const { store } = setup();
    finish(store, 1, {
      mutate: (result) => {
        result.status = "cancelled";
      },
    });
    for (const errorType of ["LoadError", "LoadTimeoutError", "WorkerError"])
      finish(store, 1, {
        mutate: (result) => {
          result.status = "error";
          result.results[0].execution = {
            requestId: "error",
            status: "error",
            hasReturnValue: false,
            errorType,
            errorMessage: "offline",
            stdout: "",
            stderr: "",
            durationMs: 0,
          };
        },
      });
    finish(store, 1, {
      mutate: (result) => {
        result.status = "timeout";
        result.timeoutPhase = "loading";
      },
    });
    expect(
      currentSession(store.getSnapshot().progress.missions[1]).attempts,
    ).toBe(0);
    finish(store);
    expect(store.getSnapshot().progress.missions[1].best).toMatchObject({
      stars: 3,
      attempts: 1,
    });
  });
  it("учитывает тайм-аут исполнения и подсказки, открытые во время проверки", () => {
    const { store } = setup();
    finish(store, 1, {
      mutate: (result) => {
        result.status = "timeout";
        result.timeoutPhase = "running";
      },
    });
    store.openHint(1);
    const data = proof();
    store.openHint(1);
    store.recordOutcome(
      1,
      "initial",
      1,
      data.request,
      data.result,
      data.buggyLine,
    );
    expect(store.getSnapshot().progress.missions[1].best).toMatchObject({
      stars: 1,
      hintsUsed: 2,
      attempts: 2,
    });
  });
});

describe("уровни и достижения", () => {
  it("открывает уровни только после всех миссий предыдущих уровней", () => {
    const { store } = setup();
    const unlocked = (id: number) =>
      isMissionUnlocked(
        missions[id - 1],
        store.getSnapshot().progress,
        missionSummaries,
      );
    expect([1, 2, 3].every(unlocked)).toBe(true);
    expect(unlocked(4)).toBe(false);
    finish(store, 4);
    expect(store.getSnapshot().progress.missions[4]).toBeUndefined();
    finish(store, 1);
    finish(store, 2);
    expect(unlocked(4)).toBe(false);
    finish(store, 3);
    expect([4, 5, 6].every(unlocked)).toBe(true);
    finish(store, 4);
    finish(store, 5);
    expect(unlocked(7)).toBe(false);
    finish(store, 6);
    expect(unlocked(7) && unlocked(8)).toBe(true);
  });
  it("открывает пять достижений один раз и сохраняет их", () => {
    const { store, storage } = setup();
    finish(store, 2);
    expect(
      store.getSnapshot().progress.achievements["first-case"],
    ).toBeDefined();
    for (const id of [1, 3, 4, 5, 6, 7, 8]) finish(store, id);
    const before = store.getSnapshot().progress.achievements;
    expect(Object.keys(before)).toHaveLength(5);
    finish(store, 1);
    expect(store.getSnapshot().progress.achievements).toEqual(before);
    expect(setup(storage).store.getSnapshot().progress.achievements).toEqual(
      before,
    );
  });
});

describe("хранилище прогресса", () => {
  it("восстанавливает прогресс, объединяет вкладки и сохраняет чужие черновики", () => {
    const storage = new MemoryStorage();
    storage.setItem("bughunter_draft_v1:missing-purchase", "keep draft");
    const first = setup(storage).store;
    const second = setup(storage).store;
    finish(first, 1);
    finish(second, 2);
    first.refresh();
    expect(first.getSnapshot().progress.totalXp).toBe(200);
    expect(setup(storage).store.getSnapshot().progress.completedCount).toBe(2);
    expect(JSON.parse(storage.getItem(PROGRESS_KEY)!).missions[1].best.xp).toBe(
      100,
    );
    first.clear();
    expect(storage.getItem("bughunter_draft_v1:missing-purchase")).toBe(
      "keep draft",
    );
    expect(first.getSnapshot().progress.totalXp).toBe(0);
  });
  it("восстанавливает журнал при повреждении кеша и пропускает повреждённые события", () => {
    const { store, storage } = setup();
    finish(store);
    storage.setItem(PROGRESS_KEY, "broken");
    storage.setItem(EVENT_PREFIX + "broken", "{}");
    const recovered = setup(storage).store.getSnapshot();
    expect(recovered.storage).toBe("recovered");
    expect(recovered.progress.totalXp).toBe(100);
    expect(parseProgressEvent('{"version":1}')).toBeNull();
  });
  it("сохраняет неподдерживаемый формат и продолжает работу в памяти", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, '{"version":0,"old":"keep"}');
    const { store } = setup(storage);
    finish(store);
    expect(store.getSnapshot().storage).toBe("unsupported");
    expect(store.getSnapshot().progress.totalXp).toBe(100);
    expect(storage.getItem(PROGRESS_KEY)).toBe('{"version":0,"old":"keep"}');
  });
  it("обрабатывает недоступный localStorage", () => {
    const repository = new LocalProgressRepository(() => {
      throw new Error("blocked");
    });
    const store = createProgressStore(repository, missionSummaries);
    finish(store);
    expect(store.getSnapshot().storage).toBe("unavailable");
    expect(store.getSnapshot().progress.totalXp).toBe(100);
    expect(store.clear()).toBe(false);
  });
  it("сохраняет награду в памяти при переполнении и повторяет запись после восстановления", () => {
    let full = false;
    class LimitedStorage extends MemoryStorage {
      override setItem(key: string, value: string) {
        if (full) throw new Error("QuotaExceededError");
        super.setItem(key, value);
      }
    }
    const storage = new LimitedStorage();
    const { store } = setup(storage);
    store.initialize(1, 0);
    full = true;
    finish(store);
    expect(store.getSnapshot().storage).toBe("unavailable");
    expect(store.getSnapshot().progress.totalXp).toBe(100);
    full = false;
    store.openHint(1);
    expect(store.getSnapshot().storage).toBe("saved");
    expect(setup(storage).store.getSnapshot().progress.totalXp).toBe(100);
  });
});
