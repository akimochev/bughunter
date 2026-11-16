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
  it.each([
    [0, 2, 3, 100],
    [0, 3, 2, 75],
    [0, 4, 2, 75],
    [0, 5, 1, 50],
    [1, 1, 2, 75],
    [1, 4, 2, 75],
    [1, 5, 1, 50],
    [2, 1, 1, 50],
  ])(
    "сохраняет награду при %i подсказках и %i реальных отправках",
    (hints, attempts, stars, xp) => {
      const { store, storage } = setup();
      store.initialize(1, hints);
      for (let index = 1; index < attempts; index++)
        finish(store, 1, { correctLine: false });
      expect(store.getSnapshot().progress.totalXp).toBe(0);
      const accepted = finish(store);
      const restored = setup(storage).store.getSnapshot().progress;
      expect(restored.missions[1].best).toMatchObject({
        hintsUsed: hints,
        attempts,
        stars,
        xp,
      });
      expect(restored.missions[1].statistics).toMatchObject({
        submissions: attempts,
        counted: attempts,
        accepted: 1,
      });
      expect(restored.totalXp).toBe(xp);
      expect(restored.totalStars).toBe(stars);
      expect(restored.awards[accepted.request.requestId].xpDelta).toBe(xp);
    },
  );
  it("сохраняет лучший результат при худшем повторном прохождении", () => {
    const { store, storage } = setup();
    const draftKey = "bughunter_draft_v1:missing-purchase";
    const draft = JSON.stringify({
      code: "мой черновик",
      selectedLine: 3,
      submitAttempts: 11,
    });
    storage.setItem(draftKey, draft);
    finish(store);
    const best = store.getSnapshot().progress.missions[1].best;
    expect(store.startReplay(1)).toBe(true);
    store.openHint(1);
    store.openHint(1);
    const worse = finish(store);
    const restored = setup(storage).store.getSnapshot().progress;
    expect(restored.missions[1].best).toEqual(best);
    expect(restored.totalXp).toBe(100);
    expect(restored.totalStars).toBe(3);
    expect(restored.completedCount).toBe(1);
    expect(restored.awards[worse.request.requestId]).toMatchObject({
      xp: 50,
      xpDelta: 0,
      newAchievements: [],
    });
    expect(storage.getItem(draftKey)).toBe(draft);
  });
  it("улучшает 50 → 75 → 100 XP после перезагрузок только на разницу", () => {
    const { store, storage } = setup();
    finish(store, 1, { hints: 2 });
    let reloaded = setup(storage).store;
    expect(reloaded.startReplay(1)).toBe(true);
    reloaded.openHint(1);
    const middle = finish(reloaded);
    expect(
      reloaded.getSnapshot().progress.awards[middle.request.requestId].xpDelta,
    ).toBe(25);
    reloaded = setup(storage).store;
    expect(reloaded.startReplay(1)).toBe(true);
    const best = finish(reloaded);
    expect(
      reloaded.getSnapshot().progress.awards[best.request.requestId].xpDelta,
    ).toBe(25);
    const restored = setup(storage).store.getSnapshot().progress;
    expect(restored.totalXp).toBe(100);
    expect(restored.totalStars).toBe(3);
    expect(restored.completedCount).toBe(1);
  });
  it("после перезагрузки не сбрасывает попытки новой сессии и не импортирует подсказки повторно", () => {
    const { store, storage } = setup();
    finish(store, 1, { hints: 2 });
    const best = store.getSnapshot().progress.missions[1].best;
    expect(store.startReplay(1)).toBe(true);
    const sessionId = store.getSnapshot().progress.missions[1].activeSessionId;
    finish(store, 1, { correctLine: false });
    const reloaded = setup(storage).store;
    reloaded.initialize(1, 2);
    const mission = reloaded.getSnapshot().progress.missions[1];
    expect(mission.activeSessionId).toBe(sessionId);
    expect(mission.best).toEqual(best);
    expect(currentSession(mission)).toEqual({
      hintsUsed: 0,
      attempts: 1,
      completed: false,
    });
    finish(reloaded);
    expect(reloaded.getSnapshot().progress.missions[1].best).toMatchObject({
      xp: 100,
      hintsUsed: 0,
      attempts: 2,
    });
  });
  it("хранит подсказки отдельно по миссиям, не сбрасывает их повторной инициализацией и ограничивает тремя", () => {
    const { store, storage } = setup();
    store.initialize(1, 2);
    store.initialize(2, 0);
    for (let index = 0; index < 5; index++) store.openHint(1);
    store.openHint(2);
    const reloaded = setup(storage).store;
    reloaded.initialize(1, 0);
    expect(
      currentSession(reloaded.getSnapshot().progress.missions[1]).hintsUsed,
    ).toBe(3);
    expect(
      currentSession(reloaded.getSnapshot().progress.missions[2]).hintsUsed,
    ).toBe(1);
  });
  it.each([
    "неверный requestId",
    "неполный набор",
    "пропущенный тест",
    "ошибка дополнительного теста",
    "строка не выбрана",
  ])("не выдаёт XP и достижения: %s", (scenario) => {
    const { store } = setup();
    store.initialize(1, 0);
    const data = proof();
    if (scenario === "неверный requestId") data.result.requestId = "stale";
    if (scenario === "неполный набор") {
      data.result.results = data.result.results.slice(0, 1);
      data.result.total = data.result.passed = 1;
    }
    if (scenario === "пропущенный тест")
      data.result.results[0].status = "skipped";
    if (scenario === "ошибка дополнительного теста") {
      data.result.status = "failed";
      data.result.passed--;
      data.result.results.at(-1)!.status = "failed";
    }
    if (scenario === "строка не выбрана") data.request.selectedLine = null;
    store.recordOutcome(
      1,
      "initial",
      0,
      data.request,
      data.result,
      data.buggyLine,
    );
    const progress = store.getSnapshot().progress;
    expect(progress.totalXp).toBe(0);
    expect(progress.totalStars).toBe(0);
    expect(progress.completedCount).toBe(0);
    expect(progress.achievements).toEqual({});
    expect(currentSession(progress.missions[1]).attempts).toBe(
      scenario === "неверный requestId" ? 0 : 1,
    );
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
  it("различает первую победу, 3 звезды и прохождение без подсказок", () => {
    const { store } = setup();
    finish(store, 2, { hints: 1 });
    expect(Object.keys(store.getSnapshot().progress.achievements)).toEqual([
      "first-case",
    ]);
    // Five counted submissions reduce stars, but do not revoke an unassisted pass.
    for (let index = 0; index < 4; index++)
      finish(store, 1, { correctLine: false });
    const unassisted = finish(store);
    expect(
      store.getSnapshot().progress.awards[unassisted.request.requestId],
    ).toMatchObject({ stars: 1, newAchievements: ["unassisted"] });
    expect(store.getSnapshot().progress.achievements.perfect).toBeUndefined();
    expect(store.startReplay(1)).toBe(true);
    const perfect = finish(store);
    expect(
      store.getSnapshot().progress.awards[perfect.request.requestId]
        .newAchievements,
    ).toEqual(["perfect"]);
  });
  it("считает уникальные миссии для достижений за 3 и 8 дел", () => {
    const { store, storage } = setup();
    finish(store, 1, { hints: 2 });
    for (let index = 0; index < 3; index++) finish(store);
    expect(
      store.getSnapshot().progress.achievements.experienced,
    ).toBeUndefined();
    finish(store, 2, { hints: 2 });
    expect(
      store.getSnapshot().progress.achievements.experienced,
    ).toBeUndefined();
    const third = finish(store, 3, { hints: 2 });
    expect(
      store.getSnapshot().progress.awards[third.request.requestId]
        .newAchievements,
    ).toEqual(["experienced"]);
    for (const id of [4, 5, 6, 7]) finish(store, id, { hints: 2 });
    expect(store.getSnapshot().progress.achievements.master).toBeUndefined();
    const eighth = finish(store, 8, { hints: 2 });
    expect(
      store.getSnapshot().progress.awards[eighth.request.requestId]
        .newAchievements,
    ).toEqual(["master"]);
    const before = store.getSnapshot().progress.achievements;
    expect(Object.keys(before).sort()).toEqual([
      "experienced",
      "first-case",
      "master",
    ]);
    const reloaded = setup(storage).store;
    const repeat = finish(reloaded, 8);
    expect(
      reloaded.getSnapshot().progress.awards[repeat.request.requestId]
        .newAchievements,
    ).toEqual([]);
    expect(reloaded.getSnapshot().progress.achievements).toEqual(before);
  });
  it("после перезагрузки сохраняет уровни, а заблокированные мутации игнорирует", () => {
    const { store, storage } = setup();
    for (const id of [1, 2]) finish(store, id);
    const reloaded = setup(storage).store;
    reloaded.initialize(4, 0);
    reloaded.openHint(4);
    expect(reloaded.startReplay(4)).toBe(false);
    finish(reloaded, 4);
    expect(reloaded.getSnapshot().progress.missions[4]).toBeUndefined();
    finish(reloaded, 3);
    const restored = setup(storage).store.getSnapshot().progress;
    expect(
      missions
        .filter((m) => isMissionUnlocked(m, restored, missionSummaries))
        .map((m) => m.id),
    ).toEqual([1, 2, 3, 4, 5, 6]);
    expect(restored.totalXp).toBe(300);
  });
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
  it("сохраняет уже загруженный прогресс при временном отказе чтения localStorage", () => {
    const storage = new MemoryStorage();
    let blocked = false;
    const store = createProgressStore(
      new LocalProgressRepository(() => {
        if (blocked) throw new Error("SecurityError");
        return storage;
      }),
      missionSummaries,
    );
    finish(store, 1, { hints: 1 });
    const best = store.getSnapshot().progress.missions[1].best;
    blocked = true;
    store.refresh();
    expect(store.getSnapshot().storage).toBe("unavailable");
    expect(store.getSnapshot().progress.totalXp).toBe(75);
    expect(store.getSnapshot().progress.missions[1].best).toEqual(best);
    expect(
      currentSession(store.getSnapshot().progress.missions[1]).hintsUsed,
    ).toBe(1);
    finish(store, 2);
    expect(store.getSnapshot().progress.totalXp).toBe(175);
    blocked = false;
    store.openHint(2);
    expect(setup(storage).store.getSnapshot().progress.totalXp).toBe(175);
    setup(storage).store.clear();
    store.refresh();
    expect(store.getSnapshot().progress.totalXp).toBe(0);
  });
  it("пропускает повреждённый Unicode в идентификаторе и читает следующие корректные записи", () => {
    const valid = setup();
    finish(valid.store);
    const storage = new MemoryStorage();
    const malformed = JSON.stringify({
      version: 1,
      kind: "initialize",
      id: String.fromCharCode(0xd800),
      missionId: 1,
      createdAt: new Date(0).toISOString(),
      hintsUsed: 0,
    });
    storage.setItem(EVENT_PREFIX + "bad-unicode", malformed);
    for (const [key, value] of valid.storage.data) storage.setItem(key, value);
    const restored = setup(storage).store.getSnapshot();
    expect.soft(parseProgressEvent(malformed)).toBeNull();
    expect.soft(restored.storage).toBe("recovered");
    expect.soft(restored.progress.totalXp).toBe(100);
  });
  it("после явной очистки не возвращает кеш памяти, даже если последующее чтение недоступно", () => {
    let blocked = false;
    class StorageUnavailableAfterClear extends MemoryStorage {
      override removeItem(key: string) {
        super.removeItem(key);
        blocked = true;
      }
    }
    const storage = new StorageUnavailableAfterClear();
    const store = createProgressStore(
      new LocalProgressRepository(() => {
        if (blocked) throw new Error("SecurityError");
        return storage;
      }),
      missionSummaries,
    );
    finish(store);
    expect(store.clear()).toBe(true);
    expect(store.getSnapshot().progress.totalXp).toBe(0);
    expect(store.getSnapshot().storage).toBe("unavailable");
  });
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
