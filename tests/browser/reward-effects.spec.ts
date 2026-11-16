import { expect, test, type Page } from "@playwright/test";
import { missions } from "../../src/content/missions";
import {
  EVENT_PREFIX,
  PROGRESS_KEY,
} from "../../src/lib/progress/local-repository";
import type { ProgressEvent } from "../../src/lib/progress/types";
import { observeRewards } from "./reward-observer";

async function solve(page: Page, id: number) {
  const mission = missions.find((mission) => mission.id === id)!;
  await page.goto(`/missions/${mission.slug}`);
  await page
    .getByRole("button", { name: "2. Исправь код", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Редактор исправления Python", exact: true })
    .fill(mission.content.referenceSolution);
  await page
    .locator("#suspect-line")
    .selectOption(String(mission.content.buggyLine));
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Дело раскрыто!", exact: true }),
  ).toBeVisible();
}

test("Reduce Motion: награды видны, эффекты выключены, клавиатура и перезагрузка", async ({
  page,
}) => {
  await observeRewards(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await solve(page, 1);
  await expect(page.locator(".mission-success")).toHaveAttribute(
    "data-reward-animated",
    "false",
  );
  await expect(page.getByTestId("xp-delta")).toHaveText("100 XP");
  const submitBox = await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .boundingBox();
  const rewardBox = await page.locator(".mission-success").boundingBox();
  expect(
    submitBox &&
      rewardBox &&
      rewardBox.y > submitBox.y &&
      rewardBox.y - submitBox.y - submitBox.height < 350,
  ).toBe(true);
  await expect(page.getByTestId("animated-total-xp")).toHaveText("100 XP");
  expect(await page.locator(".xp-reward").ariaSnapshot()).toContain(
    "Общий опыт — 100 XP.",
  );
  await expect(page.locator(".reward-particles")).toHaveCount(0);
  await expect(page.locator("[data-achievement-notification]")).toHaveCount(3);
  const animations = await page
    .locator(".mission-success")
    .evaluate(
      (element) =>
        element
          .getAnimations({ subtree: true })
          .filter((animation) => animation.playState === "running").length,
    );
  expect(animations).toBe(0);
  const close = page.getByRole("button", {
    name: "Закрыть уведомления",
    exact: true,
  });
  await close.focus();
  await expect(close).toBeFocused();
  await page.clock.fastForward(10_000);
  await expect(page.locator("[data-achievement-notification]")).toHaveCount(3);
  await close.press("Enter");
  await expect(page.locator(".reward-notifications")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Следующая миссия", exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator(".mission-success")).toHaveAttribute(
    "data-reward-animated",
    "false",
  );
  await expect(page.locator(".reward-particles")).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Отправить решение", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".mission-success")).toHaveCount(0);
  await expect(page.locator("[data-achievement-notification]")).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).totalXp,
      PROGRESS_KEY,
    ),
  ).toBe(100);
});

test("новый уровень: уведомление, ссылка на категорию, карточки и очистка при переходе", async ({
  page,
}) => {
  await page.goto("/missions");
  const events: ProgressEvent[] = [1, 2].map((id) => ({
    version: 1,
    kind: "submission",
    id: `fixture-${id}`,
    missionId: id,
    sessionId: "initial",
    createdAt: new Date(id).toISOString(),
    counted: true,
    hintsUsed: 0,
    outcome: "accepted",
    reward: { stars: 3, xp: 100, hintsUsed: 0, attempts: 1 },
  }));
  await page.evaluate(
    ({ events, prefix, key }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1 }));
      for (const event of events)
        localStorage.setItem(
          prefix + encodeURIComponent(event.id),
          JSON.stringify(event),
        );
    },
    { events, prefix: EVENT_PREFIX, key: PROGRESS_KEY },
  );
  await solve(page, 3);
  await expect(
    page.locator('[data-level-notification="intermediate"]'),
  ).toBeVisible();
  await expect(
    page.locator('[data-achievement-notification="experienced"]'),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Перейти к уровню «Практик»", exact: true })
    .click();
  await expect(page).toHaveURL(/\/missions#level-intermediate$/);
  await expect(page.locator(".mission-card-newly-unlocked")).toHaveCount(3);
  await expect(page.locator(".reward-notifications")).toHaveCount(0);
  await page.locator('.mission-card[href="/missions/lost-record"]').click();
  await expect(
    page.getByRole("heading", { name: "Потерянный рекорд", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".reward-notifications")).toHaveCount(0);
  await page.reload();
  await page.getByRole("link", { name: "К карте дел", exact: true }).click();
  await expect(page.locator(".mission-card-newly-unlocked")).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).totalXp,
      PROGRESS_KEY,
    ),
  ).toBe(300);
});

test("ошибочное решение и устаревшая успешная отправка не запускают награды", async ({
  page,
}) => {
  await observeRewards(page);
  await page.goto("/missions/missing-purchase");
  await page.locator("#suspect-line").selectOption("3");
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Отправить решение", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".mission-success")).toHaveCount(0);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).totalXp,
      PROGRESS_KEY,
    ),
  ).toBe(0);
  const editor = page.getByRole("textbox", {
    name: "Редактор исправления Python",
    exact: true,
  });
  const code =
    "def sum_prices(prices):\n    import time\n    time.sleep(0.05)\n    return sum(prices)";
  await editor.fill(code);
  await page
    .getByRole("button", { name: "Отправить решение", exact: true })
    .click();
  await editor.fill("def sum_prices(prices):\n    return 0");
  await expect(
    page.getByRole("button", { name: "Отправить решение", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", {
      name: "Результат предыдущей отправки",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".mission-success")).toHaveCount(0);
  await expect(page.locator(".reward-notifications")).toHaveCount(0);
  await editor.fill(code);
  await expect(page.locator(".mission-success")).toHaveCount(0);
  // The grading result for the original valid code is retained; effects did not
  // change business rules or run a second award after restoring the same source.
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).totalXp,
      PROGRESS_KEY,
    ),
  ).toBe(100);
});
