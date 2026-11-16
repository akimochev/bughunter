import { expect, test, type Page } from "@playwright/test";
import type { ProgressEvent } from "../../src/lib/progress/types";
import {
  animationsFor,
  expectRewardEntry,
  observeRewards,
} from "./reward-observer";
import {
  EVENT_PREFIX,
  PROGRESS_KEY,
} from "../../src/lib/progress/local-repository";

function completedEvents(ids: number[]): ProgressEvent[] {
  return ids.map((id) => ({
    version: 1,
    kind: "submission",
    id: `seed-${id}`,
    missionId: id,
    sessionId: "initial",
    createdAt: new Date(1760000000000 + id).toISOString(),
    counted: true,
    hintsUsed: 0,
    outcome: "accepted",
    reward: { stars: 3, xp: 100, hintsUsed: 0, attempts: 1 },
  }));
}
async function seed(page: Page, ids: number[]) {
  await page.evaluate(
    ({ events, prefix, key }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1 }));
      for (const event of events)
        localStorage.setItem(
          prefix + encodeURIComponent(event.id),
          JSON.stringify(event),
        );
    },
    { events: completedEvents(ids), prefix: EVENT_PREFIX, key: PROGRESS_KEY },
  );
}

test("награда 50 → 100 XP, повтор, отмена, сбой загрузки и профиль", async ({
  page,
  context,
}) => {
  test.setTimeout(360_000);
  await observeRewards(page);
  await page.clock.install();
  await page.goto("/missions/missing-purchase");
  await page
    .getByRole("button", { name: "2. Исправь код", exact: true })
    .click();
  await page
    .locator('.cm-content[contenteditable="true"]')
    .fill("def sum_prices(prices):\n    return sum(prices)");
  await page.locator("#suspect-line").selectOption("3");
  await page
    .getByRole("button", { name: "Запустить код", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Запустить код", exact: true }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).totalXp,
      PROGRESS_KEY,
    ),
  ).toBe(0);
  await expect(page.locator(".mission-success")).toHaveCount(0);
  await expect(page.locator("[data-achievement-notification]")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Открыть подсказку 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Открыть подсказку 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Дело раскрыто!", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("xp-delta")).toHaveText("50 XP");
  const firstReward = await expectRewardEntry(page);
  await expect
    .poll(() => animationsFor(page, firstReward))
    .toContain("reward-particle");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".mission-success")).toHaveAttribute(
    "data-reward-animated",
    "false",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".reward-particles")).toHaveCount(0);
  await expect(
    page.locator('[data-achievement-notification="first-case"]'),
  ).toBeVisible();
  const storedAfterAward = await page.evaluate(
    (key) => localStorage.getItem(key),
    PROGRESS_KEY,
  );
  await page.clock.fastForward(10_000);
  await expect(page.locator(".reward-notifications")).toHaveCount(0);
  await expect(page.getByTestId("animated-total-xp")).toHaveText("50 XP");
  const played = await animationsFor(page, firstReward);
  await page
    .getByRole("button", { name: "1. Найди строку", exact: true })
    .click();
  await page
    .getByRole("button", { name: "2. Исправь код", exact: true })
    .click();
  expect(await animationsFor(page, firstReward)).toEqual(played);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), PROGRESS_KEY),
  ).toBe(storedAfterAward);
  await page
    .getByRole("button", { name: "Пройти заново", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Начать прохождение", exact: true })
    .click();
  await expect(page.getByTestId("reward-attempts")).toHaveText("0");
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).totalXp,
      PROGRESS_KEY,
    ),
  ).toBe(50);
  await page.reload();
  await expect(page.getByTestId("reward-attempts")).toHaveText("0");
  await expect(
    page.getByRole("heading", { name: "Подсказки 0 / 3" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Отменить запуск", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Проверка отменена", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("reward-attempts")).toHaveText("0");
  await context.route("**/pyodide/**", (route) => route.abort());
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await expect(page.locator(".execution-error strong")).toHaveText("LoadError");
  await expect(page.getByTestId("reward-attempts")).toHaveText("0");
  await context.unroute("**/pyodide/**");
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await expect(page.getByTestId("xp-delta")).toHaveText("50 XP");
  await expect(page.getByTestId("reward-attempts")).toHaveText("1");
  await expectRewardEntry(page);
  await expect(page.locator("[data-achievement-notification]")).toHaveCount(2);
  await expect(
    page.locator('[data-achievement-notification="first-case"]'),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 375, height: 900 });
  const notices = page.locator(".reward-notice");
  const top = await notices.nth(0).boundingBox();
  const bottom = await notices.nth(1).boundingBox();
  expect(top && bottom && top.y + top.height <= bottom.y).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.clock.fastForward(2_000);
  await page
    .getByRole("heading", { name: "Дело раскрыто!", exact: true })
    .click();
  await page.locator(".mission-success").screenshot({
    path: "test-results/reward-375.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await expect(page.getByTestId("xp-delta")).toHaveText("0 XP");
  await expect(page.locator(".reward-particles")).toHaveCount(0);
  await expect(page.locator("[data-achievement-notification]")).toHaveCount(0);
  await expect(page.locator(".mission-success")).toContainText(
    "Лучший результат сохранён",
  );
  await page.getByRole("link", { name: "Профиль", exact: true }).click();
  await expect(page.getByTestId("total-xp")).toHaveText("100");
  await expect(page.getByTestId("completed-count")).toHaveText("1 / 8");
  await expect(page.locator('[data-unlocked="true"]')).toHaveCount(3);
  await page.reload();
  await expect(page.getByTestId("total-xp")).toHaveText("100");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("URL закрытой миссии и синхронизация открытия уровня между вкладками", async ({
  page,
  context,
}) => {
  await page.goto("/missions/lost-record");
  await expect(
    page.getByRole("heading", { name: "Уровень пока закрыт", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cm-editor")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Отправить решение", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Уровень пока закрыт", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".cm-editor")).toHaveCount(0);
  const other = await context.newPage();
  await other.goto("/profile");
  await seed(other, [1, 2]);
  await expect(
    page.getByRole("heading", { name: "Уровень пока закрыт", exact: true }),
  ).toBeVisible();
  await seed(other, [3]);
  await expect(
    page.getByRole("button", { name: "Запустить код", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Запустить код", exact: true }),
  ).toBeEnabled();
  await page.goto("/missions/binary-glitch");
  await expect(
    page.getByRole("heading", { name: "Уровень пока закрыт", exact: true }),
  ).toBeVisible();
  await seed(other, [4, 5, 6]);
  await expect(
    page.getByRole("button", { name: "Запустить код", exact: true }),
  ).toBeEnabled();
  await other.close();
});

test("пять достижений, повреждённый кеш и очистка без удаления черновиков", async ({
  page,
}) => {
  await page.goto("/profile");
  await page.evaluate(
    ({ prefix }) => {
      localStorage.setItem(
        prefix + "bad-unicode",
        JSON.stringify({
          version: 1,
          kind: "initialize",
          id: String.fromCharCode(0xd800),
          missionId: 1,
          createdAt: new Date(0).toISOString(),
          hintsUsed: 0,
        }),
      );
    },
    { prefix: EVENT_PREFIX },
  );
  await seed(page, [1, 2, 3, 4, 5, 6, 7, 8]);
  await page.evaluate((key) => {
    localStorage.setItem(key, "broken");
    localStorage.setItem("bughunter_draft_v1:keep", "draft content");
  }, PROGRESS_KEY);
  await page.reload();
  await expect(page.getByTestId("total-xp")).toHaveText("800");
  await expect(page.locator('[data-unlocked="true"]')).toHaveCount(5);
  await expect(page.getByText(/Повреждённые записи прогресса/)).toBeVisible();
  await page
    .getByRole("button", { name: "Очистить прогресс", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Удалить прогресс", exact: true })
    .click();
  await expect(page.getByTestId("total-xp")).toHaveText("0");
  expect(
    await page.evaluate(() => localStorage.getItem("bughunter_draft_v1:keep")),
  ).toBe("draft content");
});

test("очистка прогресса в другой вкладке не блокирует открытую миссию", async ({
  page,
  context,
}) => {
  await page.goto("/missions/missing-purchase");
  await page
    .getByRole("button", { name: "Открыть подсказку 1", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Подсказки 1 / 3" }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/profile");
  await other
    .getByRole("button", { name: "Очистить прогресс", exact: true })
    .click();
  await other
    .getByRole("button", { name: "Удалить прогресс", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Подсказки 0 / 3" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Запустить код", exact: true }),
  ).toBeEnabled({ timeout: 5000 });
  await page.locator("#suspect-line").selectOption("3");
  await expect(
    page.getByRole("button", { name: "Отправить решение", exact: true }),
  ).toBeEnabled();
  await other.close();
});
