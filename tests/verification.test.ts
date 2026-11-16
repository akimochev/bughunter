import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compareJson,
  gradeTest,
  assessSubmission,
} from "@/lib/verification/grading";
import { SolutionVerifier } from "@/lib/verification/verifier";
import type { VerificationResult } from "@/lib/verification/types";
import type {
  PythonRunRequest,
  PythonRunResult,
  RunnerPhase,
} from "@/lib/python/types";
import type { JsonValue, TestCase } from "@/types/mission";
import { createDraft, createDraftStore, parseDraft } from "@/lib/mission-draft";
import { PYODIDE_VERSION } from "@/lib/python/constants";
import packageJson from "../package.json";

const testCase: TestCase = {
  id: "one",
  args: [[1]],
  expected: 1,
  isPublic: true,
};
const cases = [testCase, { ...testCase, id: "two", isPublic: false }];
const request = {
  requestId: "check",
  sourceCode: "source",
  functionName: "example",
  testCases: cases,
};
const success = (returnValue: JsonValue = 1): PythonRunResult => ({
  requestId: "run",
  status: "success",
  hasReturnValue: true,
  returnValue,
  stdout: "",
  stderr: "",
  durationMs: 10,
  errorType: null,
  errorMessage: null,
});
const summary: VerificationResult = {
  requestId: "check",
  status: "passed",
  results: [],
  passed: 2,
  total: 2,
  durationMs: 0,
  errorMessage: null,
};
const cancelled: PythonRunResult = {
  requestId: "run",
  status: "error",
  hasReturnValue: false,
  errorType: "CancelledError",
  errorMessage: "cancelled",
  stdout: "",
  stderr: "",
  durationMs: 0,
};

function setup(
  run = vi.fn(
    async (
      _request: PythonRunRequest,
      phase?: (value: RunnerPhase) => void,
    ) => {
      phase?.("running");
      return success();
    },
  ),
) {
  const runner = { run, cancel: vi.fn(), dispose: vi.fn() };
  return {
    runner,
    verifier: new SolutionVerifier({ createRunner: () => runner }),
  };
}

afterEach(() => vi.useRealTimers());

describe("структурная проверка", () => {
  it("использует ту же версию runtime, что и пакет сборки", () => {
    expect(PYODIDE_VERSION).toBe(packageJson.dependencies.pyodide);
  });
  it("различает bool, числа, строки, None и порядок списков", () => {
    for (const [a, b] of [
      [false, 0],
      [true, 1],
      [
        [1, 2],
        [2, 1],
      ],
      [" a", "a"],
      [null, 0],
      [[], {}],
      [[false], [0]],
    ] as [JsonValue, JsonValue][])
      expect(compareJson(a, b)).toBe(false);
    expect(compareJson(null, null)).toBe(true);
    expect(
      compareJson({ b: [false, null], a: 1 }, { a: 1, b: [false, null] }),
    ).toBe(true);
    expect(compareJson({ a: null }, { b: null })).toBe(false);
    expect(compareJson(0, -0)).toBe(true);
    expect(gradeTest(testCase, success(true)).status).toBe("failed");
    expect(
      gradeTest({ ...testCase, expected: null }, success(null)).status,
    ).toBe("passed");
    expect(gradeTest({ ...testCase, expected: null }, cancelled).status).toBe(
      "error",
    );
  });

  it("принимает отправку только при всех тестах и правильной исходной строке", () => {
    expect(assessSubmission(3, 3, summary).accepted).toBe(true);
    expect(assessSubmission(2, 3, summary).accepted).toBe(false);
    expect(assessSubmission(null, 3, summary).accepted).toBe(false);
    for (const status of ["failed", "timeout", "cancelled", "error"] as const)
      expect(assessSubmission(3, 3, { ...summary, status }).accepted).toBe(
        false,
      );
    expect(assessSubmission(2, 3, summary).message).not.toContain("3");
  });
});

describe("набор тестов", () => {
  it("проверяет каждый результат, клонирует аргументы и освобождает Runner", async () => {
    const args = [[1]];
    const run = vi.fn(async (input: PythonRunRequest) => {
      (input.args[0] as number[]).push(99);
      return success();
    });
    const { verifier, runner } = setup(run);
    const result = await verifier.verify({
      ...request,
      testCases: cases.map((item) => ({ ...item, args })),
    });
    expect(result).toMatchObject({ status: "passed", passed: 2, total: 2 });
    expect(args).toEqual([[1]]);
    expect(runner.run.mock.calls[0][0].args).toEqual([[1, 99]]);
    expect(runner.run.mock.calls[1][0].args).toEqual([[1, 99]]);
    expect(runner.dispose).toHaveBeenCalledOnce();
  });

  it("сохраняет ошибки Python и допускает следующую проверку", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ ...cancelled, errorType: "SyntaxError" })
      .mockResolvedValueOnce(success())
      .mockResolvedValue(success());
    const { verifier } = setup(run);
    const failed = await verifier.verify(request);
    expect(failed.status).toBe("failed");
    expect(failed.results.map((row) => row.status)).toEqual([
      "error",
      "passed",
    ]);
    expect(
      (await verifier.verify({ ...request, requestId: "next" })).status,
    ).toBe("passed");
  });

  it("передаёт оставшийся общий бюджет выполнения каждому тесту", async () => {
    const run = vi.fn().mockResolvedValue(success());
    const verifier = new SolutionVerifier({
      createRunner: () => ({ run, cancel() {}, dispose() {} }),
      executionTimeoutMs: 15,
    });
    await verifier.verify(request);
    expect(run.mock.calls[0][2]).toBe(15);
    expect(run.mock.calls[1][2]).toBe(5);
  });

  it("не принимает запоздавший успешный ответ после исчерпания бюджета", async () => {
    const run = vi.fn().mockResolvedValue({ ...success(), durationMs: 5001 });
    const result = await setup(run).verifier.verify(request);
    expect(result.status).toBe("timeout");
    expect(result.results.map((row) => row.status)).toEqual([
      "timeout",
      "skipped",
    ]);
  });

  it("останавливает набор после тайм-аута и помечает оставшиеся тесты пропущенными", async () => {
    const run = vi.fn().mockResolvedValue({
      ...cancelled,
      status: "timeout",
      errorType: "TimeoutError",
      durationMs: 5000,
    });
    const { verifier } = setup(run);
    const result = await verifier.verify(request);
    expect(result.status).toBe("timeout");
    expect(result.results.map((row) => row.status)).toEqual([
      "timeout",
      "skipped",
    ]);
    expect(run).toHaveBeenCalledOnce();
  });

  it("ограничивает весь набор по времени ожидания и блокирует параллельные проверки", async () => {
    vi.useFakeTimers();
    let resolve!: (result: PythonRunResult) => void;
    const run = vi.fn(
      () =>
        new Promise<PythonRunResult>((done) => {
          resolve = done;
        }),
    );
    const runner = { run, cancel: () => resolve(cancelled), dispose: vi.fn() };
    const verifier = new SolutionVerifier({
      createRunner: () => runner,
      wallTimeoutMs: 100,
    });
    const pending = verifier.verify(request);
    expect(
      (await verifier.verify({ ...request, requestId: "overlap" })).status,
    ).toBe("error");
    vi.advanceTimersByTime(100);
    const result = await pending;
    expect(result.status).toBe("timeout");
    expect(result.results[0].execution?.errorType).toBe("TimeoutError");
    expect(result.results[0].execution).not.toHaveProperty("returnValue");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("отменяет активный тест и ограничивает общий вывод", async () => {
    let resolve!: (result: PythonRunResult) => void;
    const run = vi.fn(
      () =>
        new Promise<PythonRunResult>((done) => {
          resolve = done;
        }),
    );
    const verifier = new SolutionVerifier({
      createRunner: () => ({
        run,
        cancel: () => resolve(cancelled),
        dispose() {},
      }),
    });
    const pending = verifier.verify(request);
    verifier.cancel();
    expect((await pending).status).toBe("cancelled");
    const verbose = vi
      .fn()
      .mockResolvedValue({ ...success(), stdout: "x".repeat(10000) });
    const result = await setup(verbose).verifier.verify(request);
    expect(result.status).toBe("error");
    expect(result.results[1].execution?.errorType).toBe("OutputLimitError");
    expect(
      result.results.reduce(
        (count, row) => count + (row.execution?.stdout.length ?? 0),
        0,
      ),
    ).toBe(16384);
  });
});

describe("счётчик отправок", () => {
  const source = "def sample():\n    return 1";
  it("сохраняет старые черновики, подсказки и выбранную строку", () => {
    const legacy = {
      version: 1,
      source,
      code: "edited",
      selectedLine: 2,
      hintsUsed: 1,
    };
    expect(parseDraft(JSON.stringify(legacy), source)).toEqual({
      ...legacy,
      submitAttempts: 0,
    });
  });
  it("обычная работа не увеличивает отправки, восстановление кода сохраняет их", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const store = createDraftStore("sample", source, () => storage);
    store.getSnapshot();
    store.update({ code: "edited", selectedLine: 2, hintsUsed: 1 });
    expect(store.getSnapshot().draft.submitAttempts).toBe(0);
    store.recordSubmission();
    store.recordSubmission();
    store.update({ code: source });
    expect(store.getSnapshot().draft).toMatchObject({
      submitAttempts: 2,
      selectedLine: 2,
      hintsUsed: 1,
    });
    expect(
      createDraftStore("sample", source, () => storage).getSnapshot().draft
        .submitAttempts,
    ).toBe(2);
    expect(createDraft(source).submitAttempts).toBe(0);
  });
});
