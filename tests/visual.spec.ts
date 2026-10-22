import { expect, test, type PageAssertionsToHaveScreenshotOptions } from "@playwright/test";
import { components } from "../scripts/demo.ts";

const screenshot: PageAssertionsToHaveScreenshotOptions = {
  fullPage: true,
  animations: "disabled",
  stylePath: new URL("visual.css", import.meta.url).pathname,
};

test.describe("visual", { tag: "@visual" }, () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`kitchen sink, ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/demo/kitchen-sink.html");
      await expect(page).toHaveScreenshot(`kitchen-sink-${colorScheme}.png`, screenshot);
    });

    test(`kitchen sink, ${colorScheme}, more contrast`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, contrast: "more", reducedMotion: "reduce" });
      await page.goto("/demo/kitchen-sink.html");
      await expect(page).toHaveScreenshot(`kitchen-sink-${colorScheme}-more-contrast.png`, screenshot);
    });

    // One screenshot per example, so a change to one component only rewrites that component's baselines.
    for (const name of components) {
      test(`${name} examples, ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(`/demo/components/${name}.html`);
        // A sticky top bar would cover the top of whichever example it scrolls to.
        await page.addStyleTag({ content: "body > header > nav { position: static !important; }" });
        for (const figure of await page.locator("figure[data-example]").all()) {
          const example = await figure.getAttribute("data-example");
          await expect.soft(figure).toHaveScreenshot(`example-${example}-${colorScheme}.png`, {
            animations: "disabled",
            stylePath: screenshot.stylePath,
          });
        }
      });
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

    test(`popover menu, ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/demo/kitchen-sink.html");
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
