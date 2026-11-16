import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTraceStep, TraceRunner } from "@/lib/trace/runner";
import { MAX_TRACE_BYTES, MAX_TRACE_STEPS } from "@/lib/trace/constants";
import type { TraceRequest, TraceStep, TraceValue } from "@/lib/trace/types";
import type { WorkerResponse } from "@/lib/python/types";

class TestWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  emit(data: WorkerResponse) {
    this.onmessage?.({ data } as MessageEvent<WorkerResponse>);
  }
}
const request: TraceRequest = {
  requestId: "first",
  sourceCode: "def example():\n    return 1",
  functionName: "example",
  args: [],
};
const value: TraceValue = { type: "int", display: "1", truncated: false };
const step: TraceStep = {
  lineNumber: 2,
  functionName: "example",
  eventType: "line",
  frameId: 1,
  stackDepth: 0,
  variables: { x: value },
  variablesTruncated: false,
};
const success = {
  status: "success",
  hasReturnValue: true,
  returnValue: value,
  errorType: null,
  errorMessage: null,
} as const;
function setup() {
  const workers: TestWorker[] = [];
  const runner = new TraceRunner({
    createWorker: () => {
      const worker = new TestWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
  });
  return { runner, workers };
}
function emitStep(
  worker: TestWorker,
  data: unknown = step,
  requestId = "first",
) {
  worker.emit({ type: "trace-step", requestId, step: data });
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("TraceRunner и жизненный цикл Worker", () => {
  it("принимает ограниченные Unicode-имена типов исключений", () => {
    expect(
      isTraceStep({
        ...step,
        eventType: "exception",
        error: { type: "𐐀".repeat(80), message: "ошибка" },
      }),
    ).toBe(true);
  });
  it("разделяет загрузку и исполнение, сохраняет шаги после timeout и снова работает", async () => {
    const { runner, workers } = setup();
    const phases: string[] = [];
    const pending = runner.run(request, (phase) => phases.push(phase));
    vi.advanceTimersByTime(59_000);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    workers[0].emit({ type: "ready", requestId: "first" });
    expect(workers[0].postMessage).toHaveBeenLastCalledWith({
      type: "execute",
      request: { ...request, mode: "trace" },
    });
    emitStep(workers[0]);
    vi.advanceTimersByTime(5000);
    expect(await pending).toMatchObject({
      status: "timeout",
      steps: [step],
      durationMs: 5000,
    });
    expect(phases).toEqual(["loading", "running"]);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(workers[0].onmessage).toBeNull();
    expect(workers[0].onerror).toBeNull();
    expect(workers[0].onmessageerror).toBeNull();
    const next = runner.run({ ...request, requestId: "second" });
    workers[1].emit({ type: "ready", requestId: "second" });
    emitStep(workers[1], step, "second");
    workers[1].emit({ type: "result", requestId: "second", outcome: success });
    expect(await next).toMatchObject({
      status: "completed",
      steps: [step],
      returnValue: value,
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("отдельно обрабатывает timeout загрузки и сетевой сбой", async () => {
    const { runner, workers } = setup();
    const pending = runner.run(request);
    vi.advanceTimersByTime(60_000);
    expect(await pending).toMatchObject({
      status: "error",
      error: { type: "LoadTimeoutError" },
      steps: [],
      durationMs: 0,
    });
    const next = runner.run(request);
    workers[1].onerror?.();
    expect(await next).toMatchObject({
      status: "error",
      error: { type: "LoadError" },
    });
  });
  it.each([false, true])(
    "dispose отменяет загрузку/исполнение (готовность %s) и сохраняет частичную трассу",
    async (ready) => {
      const { runner, workers } = setup();
      const pending = runner.run(request);
      if (ready) {
        workers[0].emit({ type: "ready", requestId: "first" });
        emitStep(workers[0]);
      }
      runner.dispose();
      expect(await pending).toMatchObject({
        status: "cancelled",
        steps: ready ? [step] : [],
      });
      expect(workers[0].terminate).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("игнорирует устаревшие ответы, старый обработчик и результат предыдущего запуска", async () => {
    const { runner, workers } = setup();
    const first = runner.run(request);
    const stale = workers[0].onmessage!;
    const second = runner.run({ ...request, requestId: "second" });
    expect(await first).toMatchObject({ status: "cancelled" });
    stale({
      data: { type: "trace-step", requestId: "first", step },
    } as MessageEvent<WorkerResponse>);
    emitStep(workers[1]);
    workers[1].emit({ type: "ready", requestId: "second" });
    workers[1].emit({ type: "result", requestId: "second", outcome: success });
    expect(await second).toMatchObject({ status: "completed", steps: [] });
  });
  it("не принимает больше 300 шагов даже от некорректного Worker", async () => {
    const { runner, workers } = setup();
    const pending = runner.run(request);
    workers[0].emit({ type: "ready", requestId: "first" });
    for (let index = 0; index < MAX_TRACE_STEPS; index++) emitStep(workers[0]);
    const result = await pending;
    expect(result.status).toBe("limited");
    expect(result.steps).toHaveLength(300);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
  });
  it("ограничивает размер трассы на стороне клиента", async () => {
    const { runner, workers } = setup();
    const pending = runner.run(request);
    workers[0].emit({ type: "ready", requestId: "first" });
    const largeStep = {
      ...step,
      variables: Object.fromEntries(
        Array.from({ length: 20 }, (_, i) => [
          `v${i}`,
          { ...value, display: "x".repeat(256) },
        ]),
      ),
    };
    for (let index = 0; index < 300; index++) emitStep(workers[0], largeStep);
    const result = await pending;
    expect(result.status).toBe("limited");
    expect(result.steps.length).toBeLessThan(300);
    expect(
      result.steps.reduce(
        (bytes, row) => bytes + Buffer.byteLength(JSON.stringify(row)),
        0,
      ),
    ).toBeLessThanOrEqual(MAX_TRACE_BYTES);
  });
  it.each([
    { ...step, lineNumber: 999 },
    { ...step, variables: { x: { display: {}, type: "proxy" } } },
  ])("отвергает некорректные данные шага", async (invalid) => {
    const { runner, workers } = setup();
    const pending = runner.run(request);
    workers[0].emit({ type: "ready", requestId: "first" });
    emitStep(workers[0]);
    emitStep(workers[0], invalid);
    expect(await pending).toMatchObject({
      status: "error",
      error: { type: "TraceProtocolError" },
      steps: [step],
    });
  });
  it("останавливает избыточный stdout без потери записанных шагов", async () => {
    const { runner, workers } = setup();
    const pending = runner.run(request);
    workers[0].emit({ type: "ready", requestId: "first" });
    emitStep(workers[0]);
    workers[0].emit({
      type: "output",
      requestId: "first",
      stream: "stdout",
      text: "x".repeat(20_000),
    });
    expect(await pending).toMatchObject({
      status: "error",
      error: { type: "OutputLimitError" },
      steps: [step],
      stdout: "x".repeat(16_384),
    });
  });
});
