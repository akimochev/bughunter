import type { TestCase } from "@/types/mission";
import type { PythonRunResult, RunnerPhase } from "@/lib/python/types";

export interface VerificationRequest {
  requestId: string;
  sourceCode: string;
  functionName: string;
  testCases: TestCase[];
}

export interface TestResult {
  testCase: TestCase;
  status: "passed" | "failed" | "error" | "timeout" | "skipped";
  execution: PythonRunResult | null;
}

export interface VerificationResult {
  requestId: string;
  status: "passed" | "failed" | "error" | "timeout" | "cancelled";
  results: TestResult[];
  passed: number;
  total: number;
  durationMs: number;
  errorMessage: string | null;
  timeoutPhase?: RunnerPhase;
}

export interface VerificationProgress {
  phase: RunnerPhase;
  index: number;
  total: number;
  results: TestResult[];
}

export type CheckKind = "run" | "submit";
