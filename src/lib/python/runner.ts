import {
  EXECUTION_TIMEOUT_MS,
  LOAD_TIMEOUT_MS,
  MAX_CODE_LENGTH,
  MAX_INPUT_LENGTH,
  MAX_OUTPUT_BYTES,
} from "./constants";
import type {
  PythonOutcome,
  PythonRunRequest,
  PythonRunResult,
  RunnerPhase,
  WorkerCommand,
  WorkerResponse,
} from "./types";

interface RunnerOptions {
  createWorker?: () => Worker;
  executionTimeoutMs?: number;
  loadTimeoutMs?: number;
}

interface ActiveRun {
  request: PythonRunRequest;
  worker: Worker;
  resolve: (result: PythonRunResult) => void;
  timer: ReturnType<typeof setTimeout>;
  startedAt: number | null;
  stdout: string;
  stderr: string;
  outputBytes: number;
}

export function executionError(
  errorType: string,
  errorMessage: string,
): PythonOutcome {
  return { status: "error", hasReturnValue: false, errorType, errorMessage };
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 30) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value))
    return (
      value.length <= 10000 &&
      value.every((item) => isJsonValue(item, depth + 1))
    );
  if (
    typeof value !== "object" ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  return (
    Object.keys(value).length <= 10000 &&
    Object.values(value).every((item) => isJsonValue(item, depth + 1))
  );
}

export class PythonRunner {
  private active: ActiveRun | null = null;
  private readonly createWorker: () => Worker;
  private readonly executionTimeoutMs: number;
  private readonly loadTimeoutMs: number;

  constructor(options: RunnerOptions = {}) {
    this.createWorker =
      options.createWorker ??
      (() => {
        const url = new URL("/python.worker.mjs", window.location.origin);
        return new Worker(
          /* webpackIgnore: true */ /* turbopackIgnore: true */ url,
          { type: "module" },
        );
      });
    this.executionTimeoutMs =
      options.executionTimeoutMs ?? EXECUTION_TIMEOUT_MS;
    this.loadTimeoutMs = options.loadTimeoutMs ?? LOAD_TIMEOUT_MS;
  }

  run(
    request: PythonRunRequest,
    onPhase: (phase: RunnerPhase) => void = () => {},
    executionTimeoutMs: number = this.executionTimeoutMs,
  ): Promise<PythonRunResult> {
    this.cancel();
    const invalid = this.validate(request);
    if (invalid)
      return Promise.resolve({
        ...invalid,
        requestId: request.requestId,
        stdout: "",
        stderr: "",
        durationMs: 0,
      });

    return new Promise((resolve) => {
      let worker: Worker;
      try {
        worker = this.createWorker();
      } catch {
        resolve({
          ...executionError(
            "WorkerError",
            "Браузер не смог создать Worker. Обнови страницу и попробуй снова.",
          ),
          requestId: request.requestId,
          stdout: "",
          stderr: "",
          durationMs: 0,
        });
        return;
      }
      const active: ActiveRun = {
        request,
        worker,
        resolve,
        startedAt: null,
        stdout: "",
        stderr: "",
        outputBytes: 0,
        timer: setTimeout(
          () =>
            this.finish(
              active,
              executionError(
                "LoadTimeoutError",
                "Загрузка Python заняла слишком много времени. Проверь соединение и повтори запуск.",
              ),
            ),
          this.loadTimeoutMs,
        ),
      };
      this.active = active;
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        if (
          this.active !== active ||
          event.data.requestId !== request.requestId
        )
          return;
        const message = event.data;
        if (message.type === "ready") {
          if (active.startedAt !== null) return;
          clearTimeout(active.timer);
          active.startedAt = performance.now();
          active.timer = setTimeout(
            () =>
              this.finish(active, {
                status: "timeout",
                hasReturnValue: false,
                errorType: "TimeoutError",
                errorMessage:
                  "Превышен лимит выполнения Python. Проверь, завершаются ли циклы, и попробуй снова.",
              }),
            executionTimeoutMs,
          );
          onPhase("running");
          this.post(active, { type: "execute", request });
        } else if (message.type === "output") {
          const bytes = new TextEncoder().encode(message.text);
          const remaining = MAX_OUTPUT_BYTES - active.outputBytes;
          active[message.stream] += new TextDecoder().decode(
            bytes.subarray(0, remaining),
            { stream: true },
          );
          active.outputBytes += Math.min(bytes.length, remaining);
          if (bytes.length > remaining)
            this.finish(
              active,
              executionError(
                "OutputLimitError",
                "Превышен лимит вывода 16 КБ. Сократи print() и повтори запуск.",
              ),
            );
        } else {
          this.finish(active, message.outcome);
        }
      };
      worker.onerror = () =>
        this.finish(
          active,
          executionError(
            active.startedAt === null ? "LoadError" : "WorkerError",
            "Не удалось загрузить или выполнить Python. Проверь соединение и повтори запуск.",
          ),
        );
      worker.onmessageerror = () =>
        this.finish(
          active,
          executionError(
            "WorkerError",
            "Не удалось получить ответ Python. Попробуй запустить код ещё раз.",
          ),
        );
      onPhase("loading");
      this.post(active, { type: "load", requestId: request.requestId });
    });
  }

  cancel(): void {
    if (this.active)
      this.finish(
        this.active,
        executionError("CancelledError", "Запуск отменён."),
      );
  }

  dispose(): void {
    this.cancel();
  }

  private post(active: ActiveRun, command: WorkerCommand): void {
    try {
      active.worker.postMessage(command);
    } catch {
      this.finish(
        active,
        executionError(
          "WorkerError",
          "Не удалось передать данные в Python. Попробуй ещё раз.",
        ),
      );
    }
  }

  private finish(active: ActiveRun, outcome: PythonOutcome): void {
    if (this.active !== active) return;
    this.active = null;
    clearTimeout(active.timer);
    active.worker.onmessage = null;
    active.worker.onerror = null;
    active.worker.onmessageerror = null;
    active.worker.terminate();
    active.resolve({
      ...outcome,
      requestId: active.request.requestId,
      stdout: active.stdout,
      stderr: active.stderr,
      durationMs:
        active.startedAt === null
          ? 0
          : Math.round(performance.now() - active.startedAt),
    });
  }

  private validate(request: PythonRunRequest): PythonOutcome | null {
    if (!request.requestId || request.sourceCode.length > MAX_CODE_LENGTH)
      return executionError(
        "InputError",
        "Код должен содержать не более 30 000 символов, а запуск — уникальный идентификатор.",
      );
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(request.functionName))
      return executionError("InputError", "Некорректное имя функции.");
    try {
      if (!Array.isArray(request.args) || !isJsonValue(request.args))
        return executionError(
          "InputError",
          "Аргументы должны быть JSON-совместимыми значениями.",
        );
      if (JSON.stringify(request.args).length > MAX_INPUT_LENGTH)
        return executionError(
          "InputError",
          "Аргументы примера слишком велики.",
        );
    } catch {
      return executionError(
        "InputError",
        "Аргументы должны быть JSON-совместимыми.",
      );
    }
    return null;
  }
}
