import type { JsonValue, TestCase } from "@/types/mission";
import type { PythonRunResult } from "@/lib/python/types";
import { isBuggyLine } from "@/lib/line-selection";
import type { TestResult, VerificationResult } from "./types";

export function compareJson(actual: JsonValue, expected: JsonValue): boolean {
  if (actual === expected) return true;
  if (
    actual === null ||
    expected === null ||
    typeof actual !== "object" ||
    typeof expected !== "object"
  )
    return false;
  if (Array.isArray(actual) || Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((item, index) => compareJson(item, expected[index]))
    );
  const keys = Object.keys(actual);
  return (
    keys.length === Object.keys(expected).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(expected, key) &&
        compareJson(actual[key], expected[key]),
    )
  );
}

export function gradeTest(
  testCase: TestCase,
  execution: PythonRunResult,
): TestResult {
  if (execution.status !== "success")
    return {
      testCase,
      execution,
      status: execution.status === "timeout" ? "timeout" : "error",
    };
  return {
    testCase,
    execution,
    status: compareJson(execution.returnValue, testCase.expected)
      ? "passed"
      : "failed",
  };
}

export function assessSubmission(
  selectedLine: number | null,
  buggyLine: number,
  result: VerificationResult,
): { accepted: boolean; message: string } {
  if (result.status !== "passed")
    return {
      accepted: false,
      message:
        "Исправление ещё не прошло все тесты. Изучи результаты и попробуй снова.",
    };
  if (!isBuggyLine(selectedLine, buggyLine))
    return {
      accepted: false,
      message:
        "Код проходит все тесты. Пересмотри выбор ошибочной строки исходной программы и отправь решение снова.",
    };
  return { accepted: true, message: "Решение принято" };
}
