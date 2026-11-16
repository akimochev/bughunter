import type { JsonValue } from "@/types/mission";

export interface PythonRunRequest {
  requestId: string;
  sourceCode: string;
  functionName: string;
  args: JsonValue[];
  mode?: "trace";
}

export type PythonOutcome =
  | {
      status: "success";
      hasReturnValue: true;
      returnValue: JsonValue;
      errorType: null;
      errorMessage: null;
    }
  | {
      status: "error" | "timeout";
      hasReturnValue: false;
      returnValue?: never;
      errorType: string;
      errorMessage: string;
      errorLine?: number;
    };

export type PythonRunResult = PythonOutcome & {
  requestId: string;
  stdout: string;
  stderr: string;
  durationMs: number;
};

export type WorkerCommand =
  | { type: "load"; requestId: string }
  | { type: "execute"; request: PythonRunRequest };

export type WorkerResponse =
  | { type: "ready"; requestId: string }
  | { type: "trace-step"; requestId: string; step: unknown }
  | {
      type: "output";
      requestId: string;
      stream: "stdout" | "stderr";
      text: string;
    }
  | { type: "result"; requestId: string; outcome: PythonOutcome };

export type RunnerPhase = "loading" | "running";
