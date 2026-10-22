import { expect, test } from "@playwright/test";

// Elements and pseudo-elements whose computed transition or animation would still move under reduced motion.
function findMotion() {
  const offenders = [];
  for (const element of document.querySelectorAll("*")) {
    for (const pseudo of [null, "::before", "::after"]) {
      const style = getComputedStyle(element, pseudo);
      const where = `${element.localName}${element.id ? `#${element.id}` : ""}${pseudo ?? ""}`;
      if (style.transitionDuration.split(", ").some((duration) => duration !== "0s")) {
        offenders.push(`${where} transition ${style.transitionProperty} ${style.transitionDuration}`);
      }
      const durations = style.animationDuration.split(", ");
      style.animationName.split(", ").forEach((name, index) => {
        const duration = durations[index % durations.length];
        if (name !== "none" && name !== "m-pulse" && duration !== "0s") {
          offenders.push(`${where} animation ${name} ${duration}`);
        }
      });
    }
  }
  return offenders;
}

function loopAnimations() {
  return {
    spinner: getComputedStyle(document.querySelector("[aria-busy='true']")!, "::before").animationName,
    progress: getComputedStyle(document.querySelector("progress:indeterminate")!).animationName,
  };
}

test("prefers-reduced-motion stops all motion except pulsing loops", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/kitchen-sink.html");
  expect(await page.evaluate(findMotion)).toEqual([]);
  expect(await page.evaluate(loopAnimations)).toEqual({ spinner: "m-pulse", progress: "m-pulse" });
});

test('data-motion="reduce" stops all motion except pulsing loops', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/kitchen-sink.html");
  await page.evaluate(() => document.documentElement.setAttribute("data-motion", "reduce"));
  expect(await page.evaluate(findMotion)).toEqual([]);
  expect(await page.evaluate(loopAnimations)).toEqual({ spinner: "m-pulse", progress: "m-pulse" });
});

test("motion runs without a reduced-motion preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/kitchen-sink.html");
  expect(await page.evaluate(loopAnimations)).toEqual({ spinner: "m-spin", progress: "m-slide" });
  expect(await page.evaluate(findMotion)).not.toEqual([]);
});
