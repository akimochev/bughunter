import { PythonRunner, type RunnerOptions } from "@/lib/python/runner";
import type { RunnerPhase } from "@/lib/python/types";
import {
  MAX_TRACE_BYTES,
  MAX_TRACE_LOCALS,
  MAX_TRACE_STEPS,
  MAX_TRACE_VALUE_LENGTH,
} from "./constants";
import type {
  TraceError,
  TraceRequest,
  TraceResult,
  TraceStep,
  TraceValue,
} from "./types";

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function boundedText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= max * 2 &&
    [...value].length <= max
  );
}
export function isTraceValue(value: unknown): value is TraceValue {
  return (
    record(value) &&
    boundedText(value.type, 80) &&
    boundedText(value.display, MAX_TRACE_VALUE_LENGTH) &&
    typeof value.truncated === "boolean"
  );
}
function isError(value: unknown): value is TraceError {
  return (
    record(value) &&
    boundedText(value.type, 80) &&
    typeof value.message === "string" &&
    value.message.length <= 3000 &&
    (value.lineNumber === undefined ||
      (Number.isInteger(value.lineNumber) && Number(value.lineNumber) >= 0))
  );
}
export function isTraceStep(value: unknown): value is TraceStep {
  if (!record(value) || !record(value.variables)) return false;
  return (
    Number.isInteger(value.lineNumber) &&
    Number(value.lineNumber) >= 0 &&
    ["call", "line", "return", "exception"].includes(String(value.eventType)) &&
    boundedText(value.functionName, 80) &&
    Number.isInteger(value.stackDepth) &&
    Number(value.stackDepth) >= 0 &&
    Number(value.stackDepth) <= MAX_TRACE_STEPS &&
    Number.isInteger(value.frameId) &&
    Number(value.frameId) > 0 &&
    typeof value.variablesTruncated === "boolean" &&
    Object.keys(value.variables).length <= MAX_TRACE_LOCALS &&
    Object.values(value.variables).every(isTraceValue) &&
    (value.returnValue === undefined || isTraceValue(value.returnValue)) &&
    (value.error === undefined || isError(value.error))
  );
}

interface Recording {
  steps: TraceStep[];
  bytes: number;
  lineCount: number;
  error?: TraceError;
}

// Separate facade: reuses worker lifecycle, output limits, request IDs and timers.
// It has no access to mission drafts, progress, grading or hidden test cases.
export class TraceRunner {
  private readonly runner: PythonRunner;
  private active: Recording | null = null;
  constructor(options: Omit<RunnerOptions, "onTraceStep"> = {}) {
    this.runner = new PythonRunner({
      ...options,
      onTraceStep: (step) => this.receive(step),
    });
  }
  async run(
    request: TraceRequest,
    onPhase: (phase: RunnerPhase) => void = () => {},
  ): Promise<TraceResult> {
    this.cancel();
    const recording: Recording = {
      steps: [],
      bytes: 2,
      lineCount: request.sourceCode.split("\n").length,
    };
    this.active = recording;
    const outcome = await this.runner.run(
      { ...request, mode: "trace" },
      onPhase,
    );
    if (this.active === recording) this.active = null;
    const error =
      recording.error ??
      (outcome.status !== "success"
        ? {
            type: outcome.errorType,
            message: outcome.errorMessage,
            ...(typeof outcome.errorLine === "number"
              ? { lineNumber: outcome.errorLine }
              : {}),
          }
        : undefined);
    const returnValue =
      outcome.status === "success" && isTraceValue(outcome.returnValue)
        ? outcome.returnValue
        : undefined;
    const invalidResult =
      outcome.status === "success" && returnValue === undefined;
    return {
      requestId: request.requestId,
      steps: recording.steps,
      status: invalidResult
        ? "error"
        : error?.type === "CancelledError"
          ? "cancelled"
          : error?.type === "TraceLimitError"
            ? "limited"
            : outcome.status === "timeout" ||
                error?.type === "TraceTimeoutError"
              ? "timeout"
              : error
                ? "error"
                : "completed",
      returnValue,
      error: invalidResult
        ? {
            type: "TraceProtocolError",
            message: "Не удалось прочитать результат отладки. Повтори запуск.",
          }
        : error,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      durationMs: outcome.durationMs,
    };
  }
  cancel() {
    this.runner.cancel();
  }
  dispose() {
    this.runner.dispose();
  }
  private receive(step: unknown) {
    const active = this.active;
    if (!active || active.error) return;
    try {
      if (!isTraceStep(step) || step.lineNumber > active.lineCount)
        throw new Error("invalid step");
      const bytes =
        new TextEncoder().encode(JSON.stringify(step)).length +
        (active.steps.length ? 1 : 0);
      if (
        active.steps.length >= MAX_TRACE_STEPS ||
        active.bytes + bytes > MAX_TRACE_BYTES
      ) {
        active.error = {
          type: "TraceLimitError",
          message: "Достигнут лимит трассы. Сохранены доступные шаги.",
        };
        this.runner.cancel();
        return;
      }
      active.steps.push(step);
      active.bytes += bytes;
      if (active.steps.length === MAX_TRACE_STEPS) {
        active.error = {
          type: "TraceLimitError",
          message: "Достигнут лимит 300 шагов. Сохранены доступные шаги.",
        };
        this.runner.cancel();
      }
    } catch {
      active.error = {
        type: "TraceProtocolError",
        message: "Получена некорректная трасса. Сохранены доступные шаги.",
      };
      this.runner.cancel();
    }
  }
}
