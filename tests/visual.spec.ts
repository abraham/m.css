import { readFileSync } from "node:fs";
import { expect, test, type PageAssertionsToHaveScreenshotOptions } from "@playwright/test";
import { components, showcase } from "../scripts/demo.ts";

const screenshot: PageAssertionsToHaveScreenshotOptions = {
  fullPage: true,
  animations: "disabled",
  stylePath: new URL("visual.css", import.meta.url).pathname,
};

test.describe("visual", { tag: "@visual" }, () => {
  // A theme page that forces its scheme needs one screenshot; one that follows the system needs both.
  for (const name of showcase) {
    const html = readFileSync(new URL(`../demo/showcase/${name}.html`, import.meta.url), "utf8");
    const forced = /<html[^>]*\sdata-theme=/.test(html);
    for (const colorScheme of forced ? ([undefined] as const) : (["light", "dark"] as const)) {
      test(`${name} showcase page${colorScheme ? `, ${colorScheme}` : ""}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: colorScheme ?? null, reducedMotion: "reduce" });
        await page.goto(`/showcase/${name}.html`);
        await expect(page).toHaveScreenshot(`showcase-${name}${colorScheme ? `-${colorScheme}` : ""}.png`, screenshot);
      });
    }
  }

  for (const colorScheme of ["light", "dark"] as const) {
    test(`kitchen sink, ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/kitchen-sink.html");
      await expect(page).toHaveScreenshot(`kitchen-sink-${colorScheme}.png`, screenshot);
    });

    test(`kitchen sink, ${colorScheme}, more contrast`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, contrast: "more", reducedMotion: "reduce" });
      await page.goto("/kitchen-sink.html");
      await expect(page).toHaveScreenshot(`kitchen-sink-${colorScheme}-more-contrast.png`, screenshot);
    });

    // One screenshot per example, so a change to one component only rewrites that component's baselines.
    for (const name of components) {
      test(`${name} examples, ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(`/components/${name}.html`);
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
      await page.goto("/layouts/article.html");
      await expect(page).toHaveScreenshot(`article-${colorScheme}.png`, screenshot);
    });

    for (const [name, path] of [
      ["home", "/"],
      ["theming", "/theming.html"],
      ["layouts", "/layouts/"],
      ["login", "/layouts/login.html"],
      ["pricing", "/layouts/pricing.html"],
      ["settings", "/layouts/settings.html"],
      ["showcase", "/showcase/"],
    ]) {
      test(`${name} page, ${colorScheme}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto(path);
        await expect(page).toHaveScreenshot(`${name}-${colorScheme}.png`, screenshot);
      });
    }

    for (const width of [1280, 600]) {
      test(`docs layout, ${colorScheme}, ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 720 });
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto("/layouts/docs.html");
        await expect(page).toHaveScreenshot(`docs-${colorScheme}-${width}.png`, screenshot);
      });
    }

    test(`popover menu, ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/kitchen-sink.html");
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
