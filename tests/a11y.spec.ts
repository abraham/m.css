import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const pages = ["/demo/", "/demo/article.html", "/demo/docs.html"];

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
  }
}

// WCAG 1.4.4: browser zoom (up to 500%) must be able to render fluid headings at least 2x their unzoomed size.
test("fluid headings reach 2x their size with browser zoom", async ({ page }) => {
  const readSizes = () =>
    page.evaluate(() =>
      ["h1", "h2", "h3"].map((tag) =>
        parseFloat(getComputedStyle(document.querySelector(`#typography ${tag}`)!).fontSize),
      ),
    );

  await page.goto("/demo/");
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
