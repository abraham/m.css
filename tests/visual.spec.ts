import { expect, test, type PageAssertionsToHaveScreenshotOptions } from "@playwright/test";

const primaries = { orange: null, green: "oklch(60% 0.18 150)" };
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
          // WebKit shows today's date in an empty date field, which would change the baseline daily.
          await page.locator('input[type="date"]').evaluate((input: HTMLInputElement) => (input.value = "2026-01-15"));
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

    test(`kitchen sink, ${colorScheme}, more contrast`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, contrast: "more", reducedMotion: "reduce" });
      await page.goto("/demo/");
      await page.locator('input[type="date"]').evaluate((input: HTMLInputElement) => (input.value = "2026-01-15"));
      await expect(page).toHaveScreenshot(`kitchen-sink-${colorScheme}-more-contrast.png`, screenshot);
    });

    test(`article page, ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/demo/article.html");
      await expect(page).toHaveScreenshot(`article-${colorScheme}.png`, screenshot);
    });

    for (const name of ["typography", "links-buttons", "forms", "content", "navigation", "overlays", "feedback"]) {
      test(`${name} page, ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(`/demo/components/${name}.html`);
        await expect(page).toHaveScreenshot(`${name}-${colorScheme}.png`, screenshot);
      });
    }

    for (const width of [1280, 600]) {
      test(`docs layout, ${colorScheme}, ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto("/demo/docs.html");
        await expect(page).toHaveScreenshot(`docs-${colorScheme}-${width}.png`, screenshot);
      });
    }

    test(`popover menu, ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/demo/");
      // A whole-pixel scroll keeps the anchored menu off fractional offsets, which WebKit renders inconsistently.
      await page
        .locator('[popovertarget="demo-menu"]')
        .evaluate((button) =>
          scrollTo({ top: Math.round(button.getBoundingClientRect().top + scrollY - 100), behavior: "instant" }),
        );
      await page.locator('[popovertarget="demo-menu"]').click();
      await page.mouse.move(0, 0);
      await expect(page.locator("#demo-menu")).toHaveScreenshot(`menu-${colorScheme}.png`, {
        animations: "disabled",
        stylePath: screenshot.stylePath,
      });
    });
  }
});
