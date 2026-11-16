import { expect, test } from "@playwright/test";
import { missions } from "../../src/content/missions";
import { prepareVerifier, verifyInBrowser } from "./verifier-fixture";

for (const mission of missions) {
  test(`${mission.id}. ${mission.title} — эталон и исходник в настоящем Pyodide`, async ({
    page,
    context,
  }) => {
    test.setTimeout(300_000);
    await prepareVerifier(context, page);
    const testCases = [
      ...mission.content.publicTests,
      ...mission.content.hiddenTests,
    ];
    for (const variant of ["referenceSolution", "starterCode"] as const) {
      const result = await verifyInBrowser(page, {
        requestId: `${mission.slug}-${variant}`,
        functionName: mission.functionName,
        sourceCode: mission.content[variant],
        testCases,
      });
      console.log(
        `PYODIDE ${mission.id} ${variant}: ${result.passed}/${result.total}; skipped=${result.results.filter((row) => row.status === "skipped").length}; status=${result.status}`,
      );
      if (variant === "referenceSolution")
        expect(result.status, JSON.stringify(result)).toBe("passed");
      else {
        expect(["failed", "timeout"]).toContain(result.status);
        expect(result.passed).toBeLessThan(result.total);
      }
      await expect.poll(() => page.workers().length).toBe(0);
    }
  });
}

test("типы, None, ошибки и изоляция аргументов в настоящем Runner", async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);
  await prepareVerifier(context, page);
  for (const [code, expected, status] of [
    ["return False", 0, "failed"],
    ["return True", 1, "failed"],
    ["return [2, 1]", [1, 2], "failed"],
    ["return None", null, "passed"],
    ["return 1 / 0", null, "failed"],
    ["return missing", null, "failed"],
    ["return values[99]", null, "failed"],
    ["return 1 + 'x'", null, "failed"],
    ["return (", null, "failed"],
  ] as const) {
    const result = await verifyInBrowser(page, {
      requestId: crypto.randomUUID(),
      functionName: "example",
      sourceCode: `def example(values):\n    ${code}`,
      testCases: [
        {
          id: "type",
          args: [[1]],
          expected: expected as null | number | number[],
          isPublic: true,
        },
      ],
    });
    expect(result.status).toBe(status);
  }
  const result = await verifyInBrowser(page, {
    requestId: "isolation",
    functionName: "example",
    sourceCode:
      "import builtins\nbuiltins.bughunter_count = getattr(builtins, 'bughunter_count', 0) + 1\ndef example(values):\n    print('hello', end='')\n    import sys\n    print('note', file=sys.stderr)\n    before = len(values)\n    values.append(99)\n    return [before, builtins.bughunter_count]",
    testCases: [1, 2].map((id) => ({
      id: String(id),
      args: [[1]],
      expected: [1, 1],
      isPublic: true,
    })),
  });
  expect(result.status).toBe("passed");
  for (const row of result.results) {
    expect(row.execution?.stdout).toBe("hello");
    expect(row.execution?.stderr).toContain("note");
  }
});
