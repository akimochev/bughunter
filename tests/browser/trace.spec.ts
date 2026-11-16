import { build } from "esbuild";
import { expect, test } from "@playwright/test";
import { missions } from "../../src/content/missions";
import type { TraceRequest, TraceResult } from "../../src/lib/trace/types";

const bundle = build({
  entryPoints: ["src/lib/trace/runner.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  target: "es2022",
}).then((result) => result.outputFiles[0].text);

type TraceHarness = {
  run(request: TraceRequest): Promise<TraceResult>;
  dispose(): void;
};

test("реальный Pyodide: присваивания, вложенный цикл, рекурсия, исключения и лимиты", async ({
  page,
  context,
}) => {
  await context.route("**/__test-trace.mjs", async (route) =>
    route.fulfill({ contentType: "text/javascript", body: await bundle }),
  );
  await page.goto("/");
  const mission = missions[0];
  const cases: TraceRequest[] = [
    {
      requestId: "mission",
      sourceCode: mission.content.starterCode,
      functionName: mission.functionName,
      args: mission.content.publicTests[0].args,
    },
    {
      requestId: "assignment",
      sourceCode: "def example():\n    x = 1\n    x = 2\n    return x",
      functionName: "example",
      args: [],
    },
    {
      requestId: "nested",
      sourceCode:
        "def example():\n    total = 0\n    for i in range(2):\n        for j in range(2):\n            total += 1\n    return total",
      functionName: "example",
      args: [],
    },
    {
      requestId: "recursion",
      sourceCode:
        "def example(n):\n    if n == 0:\n        return 1\n    return n * example(n - 1)",
      functionName: "example",
      args: [3],
    },
    {
      requestId: "exception",
      sourceCode:
        "def helper():\n    return 1 / 0\ndef example():\n    return helper()",
      functionName: "example",
      args: [],
    },
    {
      requestId: "syntax",
      sourceCode: "def example():\n    return (",
      functionName: "example",
      args: [],
    },
    {
      requestId: "loop",
      sourceCode: "def example():\n    x = 0\n    while True:\n        x += 1",
      functionName: "example",
      args: [],
    },
    {
      requestId: "timeout",
      sourceCode:
        "def example():\n    import time\n    x = 7\n    time.sleep(20)\n    return x",
      functionName: "example",
      args: [],
    },
    {
      requestId: "recovery",
      sourceCode: "def example():\n    return (True, None, '🐍')",
      functionName: "example",
      args: [],
    },
  ];
  const results: TraceResult[] = [];
  try {
    for (const request of cases) {
      const result = await test.step(
        request.requestId,
        () =>
          page.evaluate(async (encoded) => {
            const fixture = globalThis as typeof globalThis & {
              __traceHarness?: TraceHarness;
            };
            if (!fixture.__traceHarness) {
              const url = "/__test-trace.mjs";
              const { TraceRunner } = await import(url);
              fixture.__traceHarness = new TraceRunner() as TraceHarness;
            }
            return await fixture.__traceHarness.run(JSON.parse(encoded));
          }, JSON.stringify(request)),
        { timeout: 75_000 },
      );
      console.info(
        `${request.requestId}: ${result.status}, шагов ${result.steps.length}`,
      );
      const expected =
        request.requestId === "loop"
          ? "limited"
          : request.requestId === "timeout"
            ? "timeout"
            : ["exception", "syntax"].includes(request.requestId)
              ? "error"
              : "completed";
      expect(
        result.status,
        `${request.requestId}: ${JSON.stringify(result.error)}`,
      ).toBe(expected);
      results.push(result);
    }
  } finally {
    await page.evaluate(() =>
      (
        globalThis as typeof globalThis & { __traceHarness?: TraceHarness }
      ).__traceHarness?.dispose(),
    );
  }
  const byId = Object.fromEntries(
    results.map((result) => [result.requestId, result]),
  );
  expect(byId.mission.returnValue?.display).toBe("150");
  expect(
    byId.mission.steps
      .filter((s) => s.eventType === "line" && s.lineNumber === 4)
      .map((s) => [s.variables.i.display, s.variables.total.display]),
  ).toEqual([
    ["0", "0"],
    ["1", "100"],
  ]);
  expect(
    byId.assignment.steps.find(
      (s) => s.eventType === "line" && s.lineNumber === 3,
    )?.variables.x.display,
  ).toBe("1");
  expect(
    byId.nested.steps
      .filter((s) => s.eventType === "line" && s.lineNumber === 5)
      .map((s) => [s.variables.i.display, s.variables.j.display]),
  ).toEqual([
    ["0", "0"],
    ["0", "1"],
    ["1", "0"],
    ["1", "1"],
  ]);
  expect(byId.nested.returnValue?.display).toBe("4");
  expect(
    byId.recursion.steps
      .filter((s) => s.functionName === "example" && s.eventType === "call")
      .map((s) => s.stackDepth),
  ).toEqual([0, 1, 2, 3]);
  expect(byId.recursion.returnValue?.display).toBe("6");
  expect(byId.exception.status).toBe("error");
  expect(byId.exception.error).toMatchObject({
    type: "ZeroDivisionError",
    lineNumber: 2,
  });
  expect(byId.exception.steps.at(-1)?.returnValue).toBeUndefined();
  expect(byId.syntax.steps).toEqual([]);
  expect(byId.syntax.error).toMatchObject({
    type: "SyntaxError",
    lineNumber: 2,
  });
  expect(byId.loop.status).toBe("limited");
  expect(byId.loop.steps).toHaveLength(300);
  expect(byId.timeout.status).toBe("timeout");
  expect(byId.timeout.steps.at(-1)?.variables.x.display).toBe("7");
  expect(byId.timeout.durationMs).toBeGreaterThanOrEqual(4900);
  expect(byId.recovery.status).toBe("completed");
  expect(byId.recovery.returnValue?.display).toBe("(True, None, '🐍')");
});

test("панель отладки: честные снимки, навигация, подсветка и неизменный прогресс", async ({
  page,
}) => {
  await page.goto("/missions/missing-purchase");
  await expect(
    page.getByRole("button", { name: "Отладка", exact: true }),
  ).toBeEnabled();
  await page
    .locator(".editor-panel .cm-lineNumbers .cm-gutterElement")
    .filter({ hasText: /^3$/ })
    .click();
  await expect(page.locator("#suspect-line")).toHaveValue("3");
  const before = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]),
    ),
  );
  await page.getByRole("button", { name: "Отладка", exact: true }).click();
  await expect(page.getByTestId("debug-step-count")).toBeVisible();
  await expect(page.locator(".debug-code .cm-content")).not.toHaveAttribute(
    "contenteditable",
    "true",
  );
  await expect(page.getByTestId("debug-result")).toHaveCount(0);
  const next = page.getByRole("button", { name: "Следующий шаг", exact: true });
  for (
    let index = 0;
    index < 20 && !(await page.locator('[data-variable="i"]').count());
    index++
  )
    await next.click();
  await expect(page.locator('[data-variable="i"]')).toContainText("0");
  await expect(page.locator('[data-variable="total"] td').nth(1)).toHaveText(
    "0",
  );
  await expect(page.locator(".debug-code .cm-trace-line")).toContainText(
    "total += prices[i]",
  );
  await expect(page.locator(".editor-panel .cm-suspect-line")).toContainText(
    "range(len(prices) - 1)",
  );
  await next.click();
  await expect(page.locator('[data-variable="total"]')).toHaveClass(
    /debug-variable-changed/,
  );
  await expect(page.locator('[data-variable="total"] td').nth(1)).toHaveText(
    "100",
  );
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await expect(page.locator('[data-variable="total"] td').nth(1)).toHaveText(
    "0",
  );
  while (await next.isEnabled()) await next.click();
  await expect(page.getByTestId("debug-result")).toHaveText("150");
  await expect(
    page.getByRole("heading", { name: "Выполнение завершено", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#suspect-line")).toHaveValue("3");
  const after = await page.evaluate(() =>
    Object.fromEntries(
      Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]),
    ),
  );
  expect(after).toEqual(before);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("heading", { name: "Пошаговая отладка", exact: true })
      .click();
    await page
      .locator(".debug-panel")
      .screenshot({ path: `test-results/debug-${width}.png` });
  }
  await page.getByRole("button", { name: "Сначала", exact: true }).click();
  await expect(page.getByTestId("debug-step-count")).toHaveText(/Шаг 1 из/);
});

test("отладка независима от Run/Submit, помечает старый код и очищается при смене миссии", async ({
  page,
}) => {
  await page.goto("/missions/missing-purchase");
  await page
    .getByRole("button", { name: "2. Исправь код", exact: true })
    .click();
  const editor = page.getByRole("textbox", {
    name: "Редактор исправления Python",
    exact: true,
  });
  const code =
    "def sum_prices(prices):\n    import time\n    total = 7\n    time.sleep(20)\n    return total";
  await editor.fill(code);
  await page.locator("#suspect-line").selectOption("3");
  const progress = await page.evaluate(() =>
    localStorage.getItem("bughunter_progress_v1"),
  );
  await page.getByRole("button", { name: "Отладка", exact: true }).click();
  await expect(
    page.getByText("Записываем трассу выполнения…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отправить решение", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Запустить код", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Отменить запуск", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Остановить отладку", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Отладка остановлена", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Отменить запуск", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Проверка отменена", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("submit-attempts")).toHaveText("0");
  await editor.fill("def sum_prices(prices):\n    return 42");
  await expect(page.getByText(/Трасса устарела/)).toBeVisible();
  await expect(page.locator(".debug-code")).toContainText("time.sleep(20)");
  expect(
    await page.evaluate(() => localStorage.getItem("bughunter_progress_v1")),
  ).toBe(progress);
  await page.getByRole("button", { name: "Отладка", exact: true }).click();
  await expect(page.getByText(/Трасса устарела/)).toHaveCount(0);
  await expect(page.getByTestId("debug-step-count")).toBeVisible();
  const next = page.getByRole("button", { name: "Следующий шаг", exact: true });
  while (await next.isEnabled()) await next.click();
  await expect(page.getByTestId("debug-result")).toHaveText("42");
  await editor.fill(code);
  await page.getByRole("button", { name: "Отладка", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Остановить отладку", exact: true }),
  ).toBeVisible();
  await page.goto("/missions/parity-password");
  await expect(
    page.getByRole("heading", { name: "Пароль чётности", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("debug-step-count")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Отладка", exact: true }),
  ).toBeEnabled();
});
