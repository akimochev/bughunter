import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { missions } from "@/content/missions";

// Offline authoring check for repository-owned fixtures only. Never imported by the app.
const harness = `
import copy, json, sys
payload = json.load(sys.stdin)
results = []
def equal(actual, expected):
    if type(actual) is not type(expected):
        return False
    if isinstance(actual, list):
        return len(actual) == len(expected) and all(equal(a, b) for a, b in zip(actual, expected))
    return actual == expected
for case in payload["tests"]:
    budget = [20000]
    def trace(frame, event, arg):
        if frame.f_code.co_filename == "<mission>":
            budget[0] -= 1
            if budget[0] <= 0:
                raise TimeoutError("Превышен бюджет авторской проверки")
        return trace
    args = copy.deepcopy(case["args"])
    before = copy.deepcopy(args)
    try:
        namespace = {}
        sys.settrace(trace)
        exec(compile(payload["code"], "<mission>", "exec"), namespace)
        actual = namespace[payload["functionName"]](*args)
        sys.settrace(None)
        results.append({"id": case["id"], "passed": equal(actual, case["expected"]) and args == before})
    except Exception as error:
        sys.settrace(None)
        results.append({"id": case["id"], "passed": False, "error": type(error).__name__})
json.dump(results, sys.stdout)
`;

describe("реальный Python-код авторских миссий", () => {
  for (const mission of missions) {
    for (const variant of ["referenceSolution", "starterCode"] as const) {
      it(`${mission.id}. ${mission.title} / ${variant}`, () => {
        const process = spawnSync(
          globalThis.process.env.BUGHUNTER_PYTHON ?? "python",
          ["-I", "-c", harness],
          {
            input: JSON.stringify({
              code: mission.content[variant],
              functionName: mission.functionName,
              tests: [
                ...mission.content.publicTests,
                ...mission.content.hiddenTests,
              ],
            }),
            encoding: "utf8",
            timeout: 5000,
            maxBuffer: 100_000,
            windowsHide: true,
          },
        );
        expect(
          process.error,
          "Нужен локальный Python 3 для авторских проверок",
        ).toBeUndefined();
        expect(process.status, process.stderr).toBe(0);
        const results: { id: string; passed: boolean; error?: string }[] =
          JSON.parse(process.stdout);
        expect(results).toHaveLength(
          mission.content.publicTests.length +
            mission.content.hiddenTests.length,
        );
        if (variant === "referenceSolution")
          expect(results.filter((result) => !result.passed)).toEqual([]);
        else expect(results.some((result) => !result.passed)).toBe(true);
      });
    }
  }
});
