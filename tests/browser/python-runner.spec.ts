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
async function check(page: Page, code: string, button = "Запустить код") {
  await page.locator('.cm-content[contenteditable="true"]').fill(code);
  await page.getByRole("button", { name: button, exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Запустить код", exact: true }),
  ).toBeEnabled();
}

test("публичный запуск, отдельные отправки, выбор строки и принятое решение", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await openEditor(page);
  await expect(
    page.getByRole("button", { name: "Отправить решение", exact: true }),
  ).toBeDisabled();
  await check(page, "def sum_prices(prices):\n    return sum(prices)");
  await expect(page.getByTestId("tests-count")).toHaveText("3 / 3");
  await expect(page.getByTestId("submit-attempts")).toHaveText("0");
  await expect(page.locator('[data-public="false"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Решение принято", exact: true }),
  ).toHaveCount(0);
  await page.locator("#suspect-line").selectOption("2");
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Запустить код", exact: true }),
  ).toBeEnabled();
  await expect(page.getByTestId("tests-count")).toHaveText("6 / 6");
  await expect(page.getByTestId("submit-attempts")).toHaveText("1");
  await expect(
    page.getByText(/Пересмотри выбор ошибочной строки/),
  ).toBeVisible();
  await expect(page.locator(".accepted-explanation")).toHaveCount(0);
  await expect(page.locator('[data-public="false"]')).toHaveCount(3);
  await expect(page.locator('[data-public="false"] pre')).toHaveCount(0);
  await page.locator("#suspect-line").selectOption("3");
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Решение принято", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("submit-attempts")).toHaveText("2");
  await expect(page.locator(".accepted-explanation")).toBeVisible();
  await page
    .locator('.cm-content[contenteditable="true"]')
    .fill("def sum_prices(prices):\n    return 0");
  await expect(
    page.getByRole("heading", { name: "Решение принято", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".execution-stale")).toBeVisible();
  await check(page, "def sum_prices(prices):\n    return 0");
  await expect(page.getByTestId("tests-count")).toHaveText("1 / 3");
  await expect(page.getByTestId("submit-attempts")).toHaveText("2");
  await expect(page.locator('[data-public="false"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("submit-attempts")).toHaveText("2");
  await expect(page.locator(".accepted-explanation")).toHaveCount(0);
});

test("тайм-аут набора, восстановление, отмена и уход со страницы", async ({
  page,
}) => {
  test.setTimeout(300_000);
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
    page.getByRole("heading", { name: "Выполнение тестов", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Открыть подсказку 1", exact: true })
    .click();
  await expect(page.getByText("Подсказка 1", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Превышено время проверки",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator('.test-result[data-status="skipped"]')).toHaveCount(
    2,
  );
  await expect.poll(() => page.workers().length).toBe(0);
  await check(page, "def sum_prices(prices):\n    return sum(prices)");
  await expect(page.getByTestId("tests-count")).toHaveText("3 / 3");
  await page
    .locator('.cm-content[contenteditable="true"]')
    .fill("def sum_prices(prices):\n    while True:\n        pass");
  await page
    .getByRole("button", { name: "Запустить код", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Отменить запуск", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Проверка отменена", exact: true }),
  ).toBeVisible();
  await expect.poll(() => page.workers().length).toBe(0);
  await page
    .getByRole("button", { name: "Запустить код", exact: true })
    .click();
  await page.getByRole("link", { name: "Миссии", exact: true }).click();
  await expect(page).toHaveURL("/missions");
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});

test("сетевая ошибка загрузки и ширина результатов на телефоне", async ({
  page,
  context,
}) => {
  await context.route("**/pyodide/**", (route) =>
    route.abort(),
  );
  await openEditor(page);
  await check(page, "def sum_prices(prices):\n    return 1");
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
