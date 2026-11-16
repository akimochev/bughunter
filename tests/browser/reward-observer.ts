import { expect, type Page } from "@playwright/test";

interface RewardAnimation {
  id: string;
  name: string;
}
type ObservedWindow = Window & { __rewardAnimations: RewardAnimation[] };
export async function observeRewards(page: Page) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const observed = window as unknown as ObservedWindow;
    observed.__rewardAnimations = [];
    document.addEventListener("animationstart", (event) => {
      const panel = (event.target as Element).closest("[data-reward-request]");
      const id = panel?.getAttribute("data-reward-request");
      if (id)
        observed.__rewardAnimations.push({ id, name: event.animationName });
    });
  });
}
export async function animationsFor(page: Page, id: string) {
  return page.evaluate(
    (id) =>
      (window as unknown as ObservedWindow).__rewardAnimations
        .filter((event) => event.id === id)
        .map((event) => event.name),
    id,
  );
}
export async function expectRewardEntry(page: Page) {
  const id = await page
    .locator(".mission-success")
    .getAttribute("data-reward-request");
  expect(id).toBeTruthy();
  await expect
    .poll(() => animationsFor(page, id!))
    .toContain("reward-panel-in");
  return id!;
}
