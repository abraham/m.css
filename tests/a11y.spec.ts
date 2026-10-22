import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pages } from "../scripts/demo.ts";

// The agent skill's starter page links the CDN build; serve the local build in its place.
test("the agent skill's starter page lays out its columns with no violations", async ({ page }) => {
  await page.route("https://cdn.jsdelivr.net/npm/@abraham/m.css/dist/m.min.css", (route) =>
    route.fulfill({ path: new URL("../dist/m.min.css", import.meta.url).pathname, contentType: "text/css" }),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.setContent(await readFile(new URL("../skills/m-css/assets/page.html", import.meta.url), "utf8"));
  const [side, main, rail] = await Promise.all(
    ["body > nav", "main", "body > aside"].map((selector) =>
      page.locator(selector).evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect),
    ),
  );
  expect(side.right).toBeLessThanOrEqual(main.left);
  expect(rail.left).toBeGreaterThanOrEqual(main.right);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map(({ id }) => id)).toEqual([]);
});

for (const path of pages) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`${path} has no WCAG A/AA violations in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target.join(" ")) }))).toEqual(
        [],
      );
    });

    // WCAG 1.4.6 (AAA): with more contrast requested, text reaches 7:1.
    test(`${path} text reaches 7:1 with more contrast in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, contrast: "more", reducedMotion: "reduce" });
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page }).withRules(["color-contrast-enhanced"]).analyze();
      expect(violations.flatMap(({ nodes }) => nodes.map((node) => node.target.join(" ")))).toEqual([]);
    });
  }
}

// WCAG 1.4.4: browser zoom (up to 500%) must be able to render fluid headings at least 2x their unzoomed size.
test("fluid headings reach 2x their size with browser zoom", async ({ page }) => {
  const readSizes = () =>
    page.evaluate(() =>
      ["h1", "h2", "h3"].map((tag) =>
        parseFloat(getComputedStyle(document.querySelector(`#headings ${tag}`)!).fontSize),
      ),
    );

  await page.goto("/demo/kitchen-sink.html");
  for (const width of [320, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    const unzoomed = await readSizes();
    const best = [0, 0, 0];
    // Zooming by z shrinks the CSS viewport by z and renders every CSS pixel z times larger.
    for (const zoom of [2, 3, 4, 5]) {
      await page.setViewportSize({ width: Math.round(width / zoom), height: 800 });
      (await readSizes()).forEach((size, index) => {
        best[index] = Math.max(best[index], size * zoom);
      });
    }
    best.forEach((size, index) => {
      expect(size, `h${index + 1} at ${width}px`).toBeGreaterThanOrEqual(unzoomed[index] * 2 - 0.5);
    });
  }
});

test.describe("more contrast", () => {
  // Links transition their underline color, so read settled values.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  const read = (page: Page) =>
    page.evaluate(() => {
      const link = document.querySelector("#links a")!;
      const style = (selector: string) => getComputedStyle(document.querySelector(selector)!);
      // Alpha of a computed color, whether it serializes as "... / a)" or "rgba(..., a)".
      const alpha = (color: string) =>
        parseFloat((color.match(/\/\s*([\d.]+)\s*\)$/) ?? color.match(/rgba\([^)]*,\s*([\d.]+)\)$/))?.[1] ?? "1");
      return {
        underline: alpha(getComputedStyle(link).textDecorationColor) === 1,
        border: style("fieldset").borderTopColor,
        controlBorder: style('input[name="name"]').borderTopColor,
        muted: style("#frequency-help").color,
        primary: getComputedStyle(link).color,
      };
    });

  test("solid underlines, control-strength borders, and a 3px focus ring", async ({ page }) => {
    await page.goto("/demo/kitchen-sink.html");
    const normal = await read(page);
    await page.emulateMedia({ contrast: "more", reducedMotion: "reduce" });
    const more = await read(page);

    expect(normal.underline).toBe(false);
    expect(more.underline).toBe(true);
    expect(more.border).toBe(more.controlBorder);
    expect(more.muted).not.toBe(normal.muted);
    expect(more.primary).not.toBe(normal.primary);

    await page.keyboard.press("Shift");
    await page.locator("#links a").first().focus();
    expect(
      await page
        .locator("#links a")
        .first()
        .evaluate((link) => getComputedStyle(link).outlineWidth),
    ).toBe("3px");
  });

  test('data-contrast="more" applies to its whole subtree', async ({ page }) => {
    await page.goto("/demo/kitchen-sink.html");
    const normal = await read(page);
    await page.evaluate(() => document.documentElement.setAttribute("data-contrast", "more"));
    const more = await read(page);
    expect(more.underline).toBe(true);
    expect(more.border).toBe(more.controlBorder);
    // The link is deep in the page, so this shows the per-element --_m-primary override reached it.
    expect(more.primary).not.toBe(normal.primary);
  });
});
