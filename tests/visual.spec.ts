import { expect, test, type PageAssertionsToHaveScreenshotOptions } from "@playwright/test";

const primaries = { blue: null, green: "oklch(60% 0.18 150)" };
const screenshot: PageAssertionsToHaveScreenshotOptions = {
  fullPage: true,
  animations: "disabled",
  stylePath: new URL("visual.css", import.meta.url).pathname,
};

test.describe("visual", { tag: "@visual" }, () => {
  for (const colorScheme of ["light", "dark"] as const) {
    for (const density of ["0.75", "1", "1.25"]) {
      for (const [name, primary] of Object.entries(primaries)) {
        test(`kitchen sink, ${colorScheme}, density ${density}, ${name}`, async ({ page }) => {
          await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
          await page.goto("/demo/");
          await page.evaluate(
            ([density, primary]) => {
              const { style } = document.documentElement;
              style.setProperty("--m-density", density);
              if (primary) style.setProperty("--m-primary", primary);
            },
            [density, primary],
          );
          await expect(page).toHaveScreenshot(`kitchen-sink-${colorScheme}-${density}-${name}.png`, screenshot);
        });
      }
    }

    test(`article page, ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/demo/article.html");
      await expect(page).toHaveScreenshot(`article-${colorScheme}.png`, screenshot);
    });

    for (const width of [1280, 600]) {
      test(`docs layout, ${colorScheme}, ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto("/demo/docs.html");
        await expect(page).toHaveScreenshot(`docs-${colorScheme}-${width}.png`, screenshot);
      });
    }
  }
});
