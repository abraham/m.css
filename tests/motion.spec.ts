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
      // Scroll-driven animations track scrolling 1:1, so they aren't motion.
      const timelines = (style.animationTimeline ?? "auto").split(", ");
      style.animationName.split(", ").forEach((name, index) => {
        const duration = durations[index % durations.length];
        const timeline = timelines[index % timelines.length];
        if (name !== "none" && name !== "m-pulse" && duration !== "0s" && timeline === "auto") {
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

test("a details element slides open without opting the page into keyword size transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/kitchen-sink.html");
  test.skip(!(await page.evaluate(() => CSS.supports("interpolate-size: allow-keywords"))), "No interpolate-size");
  const result = await page.locator("#details details:not([open])").evaluate(async (element) => {
    const details = element as HTMLDetailsElement;
    const height = () => details.getBoundingClientRect().height;
    const slide = (duration: string) => document.documentElement.style.setProperty("--_m-in-duration-slow", duration);
    slide("0s");
    details.open = true;
    const open = height();
    details.open = false;
    const closed = height();
    // A long slide keeps the early sample near the start whatever the timing jitter.
    slide("10s");
    details.open = true;
    await new Promise((resolve) => setTimeout(resolve, 100));
    const root = getComputedStyle(document.documentElement).getPropertyValue("interpolate-size");
    return { root, closed, early: height(), open };
  });
  expect(result.root).toBe("numeric-only");
  expect(result.early - result.closed).toBeLessThan((result.open - result.closed) / 2);
});
