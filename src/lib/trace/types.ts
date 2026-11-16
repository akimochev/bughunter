import type { PythonRunRequest } from "@/lib/python/types";

// Display data only: no PyProxy, arbitrary objects or unbounded recursive values.
export type TraceValue = { type: string; display: string; truncated: boolean };
export interface TraceError {
  type: string;
  message: string;
  lineNumber?: number;
}
export interface TraceStep {
  lineNumber: number;
  eventType: "call" | "line" | "return" | "exception";
  functionName: string;
  variables: Record<string, TraceValue>;
  variablesTruncated: boolean;
  stackDepth: number;
  frameId: number;
  returnValue?: TraceValue;
  error?: TraceError;
}
export type TraceRequest = Omit<PythonRunRequest, "mode">;
export interface TraceResult {
  requestId: string;
  status: "completed" | "error" | "limited" | "timeout" | "cancelled";
  steps: TraceStep[];
  returnValue?: TraceValue;
  error?: TraceError;
  stdout: string;
  stderr: string;
  durationMs: number;
}
