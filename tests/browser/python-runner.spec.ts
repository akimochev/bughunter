import { expect, test, type Page } from "@playwright/test";

async function openEditor(page: Page) {
  await page.goto("/missions/missing-purchase");
  await page
    .getByRole("button", { name: "2. Исправь код", exact: true })
    .click();
  await expect(
    page.locator('.cm-content[contenteditable="true"]'),
  ).toBeVisible();
}

async function runCode(page: Page, code: string) {
  const editor = page.locator('.cm-content[contenteditable="true"]');
  await editor.fill(code);
  await page
    .getByRole("button", { name: "Запустить код", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Запустить код", exact: true }),
  ).toBeEnabled();
}

test("настоящий Pyodide возвращает JSON-значения, вывод и ошибки через интерфейс", async ({
  page,
}) => {
  await page.goto("/missions/missing-purchase");
  await page
    .getByRole("button", { name: "Запустить код", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Запустить код", exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId("return-value")).toHaveText("150");
  await expect(
    page.getByRole("button", { name: "2. Исправь код", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const cases = [
    { body: "return 42", expected: "42" },
    { body: "return [1, 2, 3]", expected: "[1,2,3]" },
    { body: "return False", expected: "false" },
    { body: "return None", expected: "None (null)" },
    {
      body: "return {'ok': False, 'empty': None}",
      expected: '{"ok":false,"empty":null}',
    },
  ];
  for (const example of cases) {
    await runCode(page, `def sum_prices(prices):\n    ${example.body}`);
    await expect(
      page.getByRole("heading", { name: "Успешное выполнение", exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("return-value")).toHaveText(example.expected);
    await expect.poll(() => page.workers().length).toBe(0);
  }
  await runCode(
    page,
    "def sum_prices(prices):\n    print('Привет', end='')\n    import sys\n    print('stderr text', file=sys.stderr)\n    return sum(prices)",
  );
  await expect(page.getByTestId("stdout")).toHaveText("Привет");
  await expect(page.getByTestId("stderr")).toContainText("stderr text");
  await expect(page.getByTestId("return-value")).toHaveText("175");

  const errors = [
    { source: "def sum_prices(prices)\n    return 1", type: "SyntaxError" },
    { source: "def other(prices):\n    return 1", type: "NameError" },
    {
      source: "def sum_prices(prices):\n    return missing",
      type: "NameError",
    },
    { source: "def sum_prices():\n    return 1", type: "TypeError" },
    {
      source: "def sum_prices(prices):\n    return 1 / 0",
      type: "ZeroDivisionError",
    },
    {
      source: "def sum_prices(prices):\n    return prices[99]",
      type: "IndexError",
    },
    {
      source: "def sum_prices(prices):\n    return {1, 2}",
      type: "UnsupportedReturnType",
    },
    {
      source: "def sum_prices(prices):\n    print('x' * 20000)\n    return 1",
      type: "OutputLimitError",
    },
  ];
  for (const example of errors) {
    await runCode(page, example.source);
    await expect(page.locator(".execution-error strong")).toHaveText(
      example.type,
    );
    await expect(page.getByTestId("return-value")).toHaveCount(0);
  }
  const isolated =
    "import builtins\nbuiltins.bughunter_counter = getattr(builtins, 'bughunter_counter', 0) + 1\ndef sum_prices(prices):\n    return builtins.bughunter_counter";
  for (let count = 0; count < 2; count++) {
    await runCode(page, isolated);
    await expect(page.getByTestId("return-value")).toHaveText("1");
  }
  await expect(
    page.getByRole("button", { name: "Отправить решение", exact: true }),
  ).toBeDisabled();
});

test("тайм-аут, отзывчивость, отмена, восстановление и уход со страницы", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openEditor(page);
  await page
    .locator('.cm-content[contenteditable="true"]')
    .fill("def sum_prices(prices):\n    while True:\n        pass");
  await page
    .getByRole("button", { name: "Запустить код", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Выполнение", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Открыть подсказку 1", exact: true })
    .click();
  await expect(page.getByText("Подсказка 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Превышено время выполнения",
      exact: true,
    }),
  ).toBeVisible();
  await expect.poll(() => page.workers().length).toBe(0);
  await runCode(page, "def sum_prices(prices):\n    return 7");
  await expect(page.getByTestId("return-value")).toHaveText("7");

  await page
    .locator('.cm-content[contenteditable="true"]')
    .fill("def sum_prices(prices):\n    while True:\n        pass");
  await page
    .getByRole("button", { name: "Запустить код", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Выполнение", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Отменить запуск", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Запуск отменён", exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.workers().length).toBe(0);

  await page
    .getByRole("button", { name: "Запустить код", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Выполнение", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Миссии", exact: true }).click();
  await expect(page).toHaveURL("/missions");
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});

test("сетевая ошибка загрузки и мобильная ширина", async ({
  page,
  context,
}) => {
  await context.route("https://cdn.jsdelivr.net/pyodide/**", (route) =>
    route.abort(),
  );
  await openEditor(page);
  await runCode(page, "def sum_prices(prices):\n    return 1");
  await expect(page.locator(".execution-error strong")).toHaveText("LoadError");
  await expect.poll(() => page.workers().length).toBe(0);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
