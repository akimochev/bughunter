import { PythonRunner, executionError } from "@/lib/python/runner";
import { EXECUTION_TIMEOUT_MS, MAX_OUTPUT_BYTES } from "@/lib/python/constants";
import type { PythonRunResult } from "@/lib/python/types";
import { gradeTest } from "./grading";
import type {
  TestResult,
  VerificationProgress,
  VerificationRequest,
  VerificationResult,
} from "./types";

interface ExecutionRunner {
  run: PythonRunner["run"];
  cancel(): void;
  dispose(): void;
}

interface VerifierOptions {
  createRunner?: () => ExecutionRunner;
  executionTimeoutMs?: number;
  wallTimeoutMs?: number;
}

interface ActiveVerification {
  runner: ExecutionRunner;
  phase: "loading" | "running";
  stopped: "cancelled" | "timeout" | null;
}

function interruptedExecution(
  execution: PythonRunResult,
  errorType: string,
  errorMessage: string,
  status: "error" | "timeout" = "error",
): PythonRunResult {
  return {
    requestId: execution.requestId,
    stdout: execution.stdout,
    stderr: execution.stderr,
    durationMs: execution.durationMs,
    status,
    hasReturnValue: false,
    errorType,
    errorMessage,
  };
}

export class SolutionVerifier {
  private active: ActiveVerification | null = null;
  constructor(private readonly options: VerifierOptions = {}) {}

  async verify(
    input: VerificationRequest,
    onProgress: (progress: VerificationProgress) => void = () => {},
  ): Promise<VerificationResult> {
    const empty: VerificationResult = {
      requestId: input.requestId,
      status: "error",
      results: [],
      passed: 0,
      total: input.testCases.length,
      durationMs: 0,
      errorMessage: null,
    };
    if (this.active)
      return { ...empty, errorMessage: "Дождись завершения текущей проверки." };
    if (input.testCases.length === 0 || input.testCases.length > 20)
      return {
        ...empty,
        errorMessage: "Проверка должна содержать от 1 до 20 тестов.",
      };
    const request = structuredClone(input);
    const active: ActiveVerification = {
      phase: "loading",
      runner: this.options.createRunner?.() ?? new PythonRunner(),
      stopped: null,
    };
    this.active = active;
    const timer = setTimeout(() => {
      active.stopped = "timeout";
      active.runner.cancel();
    }, this.options.wallTimeoutMs ?? 120_000);
    const rows: TestResult[] = [];
    let durationMs = 0;
    let outputBytes = 0;
    let infrastructureError: string | null = null;

    try {
      for (const [index, testCase] of request.testCases.entries()) {
        const remaining =
          (this.options.executionTimeoutMs ?? EXECUTION_TIMEOUT_MS) -
          durationMs;
        if (active.stopped || infrastructureError || remaining <= 0) {
          if (remaining <= 0 && !active.stopped) active.stopped = "timeout";
          rows.push({ testCase, status: "skipped", execution: null });
          continue;
        }
        let execution: PythonRunResult;
        const requestId = `${request.requestId}:${index}`;
        try {
          execution = await active.runner.run(
            {
              requestId,
              sourceCode: request.sourceCode,
              functionName: request.functionName,
              args: structuredClone(testCase.args),
            },
            (phase) => {
              active.phase = phase;
              onProgress({
                phase,
                index,
                total: request.testCases.length,
                results: [...rows],
              });
            },
            remaining,
          );
        } catch {
          execution = {
            ...executionError(
              "WorkerError",
              "Проверка была прервана. Попробуй ещё раз.",
            ),
            requestId,
            stdout: "",
            stderr: "",
            durationMs: 0,
          };
        }
        const cancelled = this.active?.stopped === "cancelled";
        durationMs += execution.durationMs;
        if (execution.status === "success" && execution.durationMs > remaining)
          active.stopped = "timeout";
        if (active.stopped === "timeout")
          execution = interruptedExecution(
            execution,
            "TimeoutError",
            "Превышено общее время проверки.",
            "timeout",
          );

        const stdout = new TextEncoder().encode(execution.stdout);
        const stderr = new TextEncoder().encode(execution.stderr);
        const available = MAX_OUTPUT_BYTES - outputBytes;
        if (stdout.length + stderr.length > available) {
          execution = {
            ...interruptedExecution(
              execution,
              "OutputLimitError",
              "Превышен общий лимит вывода проверки 16 КБ.",
            ),
            stdout: new TextDecoder().decode(stdout.subarray(0, available), {
              stream: true,
            }),
            stderr: new TextDecoder().decode(
              stderr.subarray(0, Math.max(0, available - stdout.length)),
              { stream: true },
            ),
          };
        }
        outputBytes += Math.min(stdout.length + stderr.length, available);
        rows.push(
          cancelled
            ? { testCase, status: "skipped", execution }
            : gradeTest(testCase, execution),
        );
        if (execution.status === "timeout") active.stopped = "timeout";
        if (
          [
            "LoadError",
            "LoadTimeoutError",
            "WorkerError",
            "InputError",
            "OutputLimitError",
          ].includes(execution.errorType ?? "")
        )
          infrastructureError = execution.errorMessage;
      }
    } finally {
      clearTimeout(timer);
      active.runner.dispose();
      this.active = null;
    }
    const passed = rows.filter((row) => row.status === "passed").length;
    let status: VerificationResult["status"] =
      passed === request.testCases.length ? "passed" : "failed";
    if (infrastructureError) status = "error";
    if (active.stopped) status = active.stopped;
    return {
      requestId: request.requestId,
      status,
      results: rows,
      passed,
      total: request.testCases.length,
      durationMs,
      errorMessage: infrastructureError,
      timeoutPhase: active.stopped === "timeout" ? active.phase : undefined,
    };
  }

  cancel(): void {
    if (!this.active) return;
    this.active.stopped = "cancelled";
    this.active.runner.cancel();
  }

  dispose(): void {
    this.cancel();
  }
}
