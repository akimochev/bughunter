import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { TRACE_SOURCE } from "@/lib/trace/trace-source";
import { MAX_TRACE_BYTES, MAX_TRACE_STEPS } from "@/lib/trace/constants";
import { missions } from "@/content/missions";
import { variableChanges } from "@/lib/trace/playback";
import { isTraceValue } from "@/lib/trace/runner";
import type { PythonOutcome } from "@/lib/python/types";
import type { TraceStep, TraceValue } from "@/lib/trace/types";
import type { JsonValue } from "@/types/mission";

// Runs repository-owned fixtures only, never learner input on a server.
const harness = `
import contextlib, io, json, sys
payload = json.load(sys.stdin)
steps = []
def emit(encoded):
    steps.append(json.loads(encoded))
namespace = {"_bughunter_payload_json": json.dumps(payload["request"]), "_bughunter_trace_emit": emit}
with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
    exec(payload["driver"], namespace)
json.dump({"steps": steps, "outcome": json.loads(namespace["_bughunter_trace_result_json"]), "tracingDisabled": sys.gettrace() is None}, sys.stdout)
`;
function run(code: string, args: JsonValue[] = [], functionName = "example") {
  const child = spawnSync(
    process.env.BUGHUNTER_PYTHON ?? "python",
    ["-I", "-X", "utf8", "-c", harness],
    {
      input: JSON.stringify({
        driver: TRACE_SOURCE,
        request: { sourceCode: code, functionName, args },
      }),
      encoding: "utf8",
      timeout: 8000,
      maxBuffer: 1_000_000,
      windowsHide: true,
    },
  );
  expect(child.error).toBeUndefined();
  expect(child.status, child.stderr).toBe(0);
  const result: {
    steps: TraceStep[];
    outcome: PythonOutcome;
    tracingDisabled: boolean;
  } = JSON.parse(child.stdout);
  expect(result.tracingDisabled).toBe(true);
  return result;
}
function value(step: TraceStep, name: string) {
  return step.variables[name]?.display;
}
function returned(outcome: PythonOutcome): TraceValue {
  expect(outcome.status).toBe("success");
  return outcome.returnValue as TraceValue;
}

describe("реальная запись sys.settrace", () => {
  it("снимок line отражает состояние до выполнения присваивания", () => {
    const { steps, outcome } = run(
      "def example():\n    x = 1\n    x = 2\n    return x",
    );
    const beforeFirst = steps.find(
      (s) => s.eventType === "line" && s.lineNumber === 2,
    )!;
    const beforeSecond = steps.find(
      (s) => s.eventType === "line" && s.lineNumber === 3,
    )!;
    const beforeReturn = steps.find(
      (s) => s.eventType === "line" && s.lineNumber === 4,
    )!;
    expect(beforeFirst.variables).toEqual({});
    expect(value(beforeSecond, "x")).toBe("1");
    expect(value(beforeReturn, "x")).toBe("2");
    expect(
      steps.find(
        (s) => s.functionName === "example" && s.eventType === "return",
      )?.returnValue?.display,
    ).toBe("2");
    expect(returned(outcome).display).toBe("2");
  });
  it("в первой миссии показывает i и total без забегания вперёд", () => {
    const mission = missions[0];
    const { steps, outcome } = run(
      mission.content.starterCode,
      mission.content.publicTests[0].args,
      mission.functionName,
    );
    const bodies = steps.filter(
      (s) => s.eventType === "line" && s.lineNumber === 4,
    );
    expect(bodies.map((s) => [value(s, "i"), value(s, "total")])).toEqual([
      ["0", "0"],
      ["1", "100"],
    ]);
    expect(returned(outcome).display).toBe("150");
    const lastLoop = steps.findIndex(
      (s) =>
        s.eventType === "line" &&
        s.lineNumber === 3 &&
        value(s, "total") === "150",
    );
    expect(variableChanges(steps, lastLoop).total).toBe("changed");
  });
  it("сохраняет независимые снимки изменяемых коллекций и вложенного цикла", () => {
    const { steps, outcome } = run(
      "def example():\n    items = []\n    for i in range(2):\n        for j in range(2):\n            items.append((i, j))\n    return items",
    );
    const entries = steps.filter(
      (s) => s.lineNumber === 5 && s.eventType === "line",
    );
    expect(entries.map((s) => [value(s, "i"), value(s, "j")])).toEqual([
      ["0", "0"],
      ["0", "1"],
      ["1", "0"],
      ["1", "1"],
    ]);
    expect(value(entries[0], "items")).toBe("[]");
    expect(value(entries[1], "items")).toBe("[(0, 0)]");
    expect(returned(outcome).display).toBe("[(0, 0), (0, 1), (1, 0), (1, 1)]");
  });
  it("трассирует вызовы и рекурсию с разными кадрами и глубиной", () => {
    const { steps, outcome } = run(
      "def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\ndef example():\n    return factorial(3)",
    );
    const calls = steps.filter(
      (s) => s.functionName === "factorial" && s.eventType === "call",
    );
    expect(calls.map((s) => s.stackDepth)).toEqual([1, 2, 3]);
    expect(new Set(calls.map((s) => s.frameId)).size).toBe(3);
    expect(
      steps
        .filter(
          (s) => s.functionName === "factorial" && s.eventType === "return",
        )
        .map((s) => s.returnValue?.display),
    ).toEqual(["1", "2", "6"]);
    expect(returned(outcome).display).toBe("6");
  });
  it("разные вызовы одной функции не сравниваются друг с другом", () => {
    const { steps } = run(
      "def helper(n):\n    return n + 1\ndef example():\n    a = helper(1)\n    return helper(10)",
    );
    const calls = steps
      .map((s, index) => ({ s, index }))
      .filter(({ s }) => s.functionName === "helper" && s.eventType === "call");
    expect(variableChanges(steps, calls[1].index).n).toBe("new");
    expect(calls[0].s.frameId).not.toBe(calls[1].s.frameId);
  });
  it("фиксирует исключение и не выдаёт return при раскрутке стека за возврат None", () => {
    const { steps, outcome } = run(
      "def helper():\n    return 1 / 0\ndef example():\n    return helper()",
    );
    expect(outcome).toMatchObject({
      status: "error",
      errorType: "ZeroDivisionError",
      errorLine: 2,
    });
    expect(
      steps
        .filter((s) => s.eventType === "exception")
        .map((s) => s.functionName),
    ).toEqual(["helper", "example"]);
    expect(
      steps
        .filter(
          (s) => s.eventType === "return" && s.functionName !== "<module>",
        )
        .every(
          (s) =>
            s.returnValue === undefined &&
            s.error?.type === "ZeroDivisionError",
        ),
    ).toBe(true);
  });
  it("отличает обработанное исключение и настоящий return None", () => {
    const { steps, outcome } = run(
      "def example():\n    try:\n        x = 1 / 0\n    except ZeroDivisionError:\n        return None",
    );
    expect(steps.some((s) => s.eventType === "exception")).toBe(true);
    const last = steps.at(-1)!;
    expect(last.returnValue?.display).toBe("None");
    expect(last.error).toBeUndefined();
    expect(returned(outcome).type).toBe("NoneType");
  });
  it("возвращает номер синтаксической ошибки без выдуманных шагов", () => {
    const { steps, outcome } = run("def example():\n    return (");
    expect(steps).toEqual([]);
    expect(outcome).toMatchObject({
      status: "error",
      errorType: "SyntaxError",
      errorLine: 2,
    });
  });
  it("сериализует Python-типы, большие числа, циклы и неизвестные объекты без __repr__", () => {
    const { steps, outcome } = run(
      "class Unknown:\n    def __repr__(self):\n        raise RuntimeError('repr must never run')\ndef example():\n    i, f, b, s, n = 2, 1.5, True, 'привет', None\n    seq, pair, mapping = [1, False], (2,), {3: 'x'}\n    huge = 10 ** 10000\n    cycle = []\n    cycle.append(cycle)\n    obj = Unknown()\n    deep = [[[[[1]]]]]\n    return (seq, pair, mapping)",
    );
    const last = steps.at(-1)!;
    expect(last.variables.i.type).toBe("int");
    expect(last.variables.f.type).toBe("float");
    expect(last.variables.b).toMatchObject({ type: "bool", display: "True" });
    expect(last.variables.s.type).toBe("str");
    expect(last.variables.n.display).toBe("None");
    expect(last.variables.seq.display).toBe("[1, False]");
    expect(last.variables.pair.display).toBe("(2,)");
    expect(last.variables.mapping.display).toBe("{3: 'x'}");
    expect(last.variables.huge.truncated).toBe(true);
    expect(last.variables.cycle.display).toContain("циклическая ссылка");
    expect(last.variables.deep.display).toContain("ограничение глубины");
    expect(last.variables.obj).toMatchObject({
      type: "Unknown",
      display: "<Unknown>",
    });
    expect(returned(outcome).type).toBe("tuple");
  });
  it("не вызывает пользовательские __repr__ и __str__ исключения", () => {
    const { outcome } = run(
      "class Problem(Exception):\n    def __str__(self):\n        raise RuntimeError('unsafe str')\ndef example():\n    raise Problem('исходная ошибка')",
    );
    expect(outcome).toMatchObject({
      status: "error",
      errorType: "Problem",
      errorMessage: "исходная ошибка",
    });
  });
  it("получает имя типа без вызова свойства пользовательского метакласса", () => {
    const { outcome } = run(
      "class Meta(type):\n    @property\n    def __name__(cls):\n        raise RuntimeError('unsafe type name')\nclass Unknown(metaclass=Meta):\n    pass\ndef example():\n    obj = Unknown()\n    return obj",
    );
    expect(returned(outcome)).toMatchObject({
      type: "Unknown",
      display: "<Unknown>",
    });
  });
  it("обрезает строки и большие коллекции, не трассирует стандартную библиотеку", () => {
    const { steps } = run(
      "import json\ndef example():\n    s = 'x' * 5000\n    items = list(range(1000))\n    encoded = json.dumps([1, 2])\n    return items",
    );
    expect(
      steps.every((s) => ["<module>", "example"].includes(s.functionName)),
    ).toBe(true);
    const vars = steps.at(-1)!.variables;
    expect(vars.s.display.length).toBeLessThanOrEqual(256);
    expect(vars.s.truncated && vars.items.truncated).toBe(true);
  });
  it("не отвергает ограниченные Unicode-значения из-за разных единиц длины Python и JavaScript", () => {
    const { outcome } = run("def example():\n    return '🐍' * 1000");
    const result = returned(outcome);
    expect([...result.display].length).toBeLessThanOrEqual(256);
    expect(result.truncated).toBe(true);
    expect(isTraceValue(result)).toBe(true);
  });
  it("останавливает бесконечный цикл на 300 шагах и сохраняет доступную трассу", () => {
    const { steps, outcome } = run(
      "def example():\n    total = 0\n    while True:\n        total += 1",
    );
    expect(steps).toHaveLength(MAX_TRACE_STEPS);
    expect(outcome).toMatchObject({
      status: "error",
      errorType: "TraceLimitError",
    });
    expect(value(steps.at(-1)!, "total")).toBeDefined();
  });
  it("не объявляет трассу полной, если программа перехватила служебное ограничение", () => {
    const { steps, outcome } = run(
      "def example():\n    try:\n        while True:\n            pass\n    except BaseException:\n        return 123",
    );
    expect(steps).toHaveLength(300);
    expect(outcome).toMatchObject({
      status: "error",
      errorType: "TraceLimitError",
    });
  });
  it("ограничивает общий объём трассы, даже если 300 шагов ещё нет", () => {
    const locals = Array.from(
      { length: 20 },
      (_, i) => `    value${i} = 'я' * 256`,
    ).join("\n");
    const { steps, outcome } = run(
      `def example():\n${locals}\n    while True:\n        pass`,
    );
    expect(outcome).toMatchObject({
      status: "error",
      errorType: "TraceLimitError",
    });
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThan(MAX_TRACE_STEPS);
    expect(
      steps.reduce(
        (bytes, step) => bytes + Buffer.byteLength(JSON.stringify(step)),
        0,
      ),
    ).toBeLessThanOrEqual(MAX_TRACE_BYTES);
  });
});
