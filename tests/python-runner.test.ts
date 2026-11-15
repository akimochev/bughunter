import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PythonRunner } from "@/lib/python/runner";
import { MAX_CODE_LENGTH, MAX_OUTPUT_BYTES } from "@/lib/python/constants";
import type { PythonRunRequest, WorkerResponse } from "@/lib/python/types";

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

const request: PythonRunRequest = {
  requestId: "first",
  sourceCode: "def example():\n    return None",
  functionName: "example",
  args: [],
};
const success = {
  status: "success",
  hasReturnValue: true,
  returnValue: null,
  errorType: null,
  errorMessage: null,
} as const;

function setup() {
  const workers: TestWorker[] = [];
  const runner = new PythonRunner({
    createWorker: () => {
      const worker = new TestWorker();
      workers.push(worker);
      return worker as unknown as Worker;
    },
  });
  return { runner, workers };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("жизненный цикл Python Runner", () => {
  it("лениво создаёт Worker, отделяет время загрузки и завершает зависший запуск", async () => {
    const { runner, workers } = setup();
    expect(workers).toHaveLength(0);
    const phases: string[] = [];
    const result = runner.run(request, (phase) => phases.push(phase));
    vi.advanceTimersByTime(59000);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    workers[0].emit({ type: "ready", requestId: "first" });
    expect(workers[0].postMessage).toHaveBeenLastCalledWith({
      type: "execute",
      request,
    });
    vi.advanceTimersByTime(4999);
    expect(workers[0].terminate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(await result).toMatchObject({
      status: "timeout",
      hasReturnValue: false,
      errorType: "TimeoutError",
      durationMs: 5000,
    });
    expect(phases).toEqual(["loading", "running"]);
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    const next = runner.run({ ...request, requestId: "second" });
    workers[1].emit({ type: "ready", requestId: "second" });
    workers[1].emit({ type: "result", requestId: "second", outcome: success });
    expect(await next).toMatchObject({ status: "success", returnValue: null });
  });

  it("обрабатывает долгую загрузку и сетевую ошибку", async () => {
    const { runner, workers } = setup();
    const slow = runner.run(request);
    vi.advanceTimersByTime(60000);
    expect(await slow).toMatchObject({
      status: "error",
      errorType: "LoadTimeoutError",
      durationMs: 0,
    });
    const failed = runner.run({ ...request, requestId: "second" });
    workers[1].onerror?.();
    expect(await failed).toMatchObject({
      status: "error",
      errorType: "LoadError",
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("отменяет загрузку, выполнение и освобождает ресурсы при dispose", async () => {
    const { runner, workers } = setup();
    const loading = runner.run(request);
    runner.cancel();
    expect(await loading).toMatchObject({
      status: "error",
      errorType: "CancelledError",
    });
    const executing = runner.run({ ...request, requestId: "second" });
    workers[1].emit({ type: "ready", requestId: "second" });
    runner.dispose();
    expect(await executing).toMatchObject({
      status: "error",
      errorType: "CancelledError",
    });
    expect(
      workers.every((worker) => worker.terminate.mock.calls.length === 1),
    ).toBe(true);
    expect(workers[1].onmessage).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("игнорирует устаревший Worker и ответ с чужим requestId", async () => {
    const { runner, workers } = setup();
    const first = runner.run(request);
    const queuedHandler = workers[0].onmessage!;
    const second = runner.run({ ...request, requestId: "second" });
    expect(await first).toMatchObject({ errorType: "CancelledError" });
    queuedHandler({
      data: { type: "result", requestId: "first", outcome: success },
    } as MessageEvent<WorkerResponse>);
    workers[1].emit({ type: "result", requestId: "first", outcome: success });
    expect(workers[1].terminate).not.toHaveBeenCalled();
    workers[1].emit({ type: "ready", requestId: "second" });
    workers[1].emit({
      type: "result",
      requestId: "second",
      outcome: { ...success, returnValue: false },
    });
    expect(await second).toMatchObject({
      status: "success",
      requestId: "second",
      returnValue: false,
      hasReturnValue: true,
    });
  });

  it("сохраняет stdout и stderr и ограничивает их общий объём", async () => {
    const { runner, workers } = setup();
    const result = runner.run(request);
    workers[0].emit({ type: "ready", requestId: "first" });
    workers[0].emit({
      type: "output",
      requestId: "first",
      stream: "stderr",
      text: "warning",
    });
    workers[0].emit({
      type: "output",
      requestId: "first",
      stream: "stdout",
      text: "x".repeat(MAX_OUTPUT_BYTES),
    });
    const outcome = await result;
    expect(outcome).toMatchObject({
      status: "error",
      hasReturnValue: false,
      errorType: "OutputLimitError",
      stderr: "warning",
    });
    expect(
      new TextEncoder().encode(outcome.stdout + outcome.stderr),
    ).toHaveLength(MAX_OUTPUT_BYTES);
  });

  it("сохраняет Python-ошибку и различает отсутствие результата и None", async () => {
    const { runner, workers } = setup();
    const result = runner.run(request);
    workers[0].emit({ type: "ready", requestId: "first" });
    workers[0].emit({
      type: "result",
      requestId: "first",
      outcome: {
        status: "error",
        hasReturnValue: false,
        errorType: "SyntaxError",
        errorMessage: "invalid syntax",
      },
    });
    const error = await result;
    expect(error).toMatchObject({
      errorType: "SyntaxError",
      hasReturnValue: false,
    });
    expect(error).not.toHaveProperty("returnValue");
  });

  it("перехватывает ошибки создания, передачи и декодирования сообщений", async () => {
    const broken = new PythonRunner({
      createWorker: () => {
        throw new Error("blocked");
      },
    });
    expect(await broken.run(request)).toMatchObject({
      errorType: "WorkerError",
    });
    const { runner, workers } = setup();
    const undecodable = runner.run(request);
    workers[0].onmessageerror?.();
    expect(await undecodable).toMatchObject({ errorType: "WorkerError" });
    const port = new TestWorker();
    port.postMessage.mockImplementation(() => {
      throw new Error("clone");
    });
    const failing = new PythonRunner({
      createWorker: () => port as unknown as Worker,
    });
    expect(await failing.run(request)).toMatchObject({
      errorType: "WorkerError",
    });
    expect(port.terminate).toHaveBeenCalledOnce();
  });

  it("отклоняет большой код и несовместимые аргументы до создания Worker", async () => {
    const { runner, workers } = setup();
    expect(
      await runner.run({
        ...request,
        sourceCode: "x".repeat(MAX_CODE_LENGTH + 1),
      }),
    ).toMatchObject({ errorType: "InputError" });
    expect(
      await runner.run({ ...request, functionName: "x(); evil()" }),
    ).toMatchObject({ errorType: "InputError" });
    expect(await runner.run({ ...request, args: [Number.NaN] })).toMatchObject({
      errorType: "InputError",
    });
    expect(workers).toHaveLength(0);
  });
});
