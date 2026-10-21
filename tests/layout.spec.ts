import { expect, test, type Page } from "@playwright/test";

const rect = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => element.getBoundingClientRect().toJSON() as DOMRect);

const stickyOffset = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.blockSize = "var(--_m-sticky-offset)";
    document.body.append(probe);
    const height = probe.getBoundingClientRect().height;
    probe.remove();
    return height;
  });

test.describe("cards", () => {
  test("a container of only articles lays out equal-height cards with footers at the bottom", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/demo/");
    const cards = await page.locator("#cards > div > article").evaluateAll((articles) =>
      articles.map((article) => ({
        top: article.getBoundingClientRect().top,
        bottom: article.getBoundingClientRect().bottom,
        footerBottom: article.querySelector("footer")!.getBoundingClientRect().bottom,
      })),
    );
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.top).toBeCloseTo(cards[0].top, 0);
      expect(card.bottom).toBeCloseTo(cards[0].bottom, 0);
      expect(card.footerBottom).toBeCloseTo(card.bottom - 1, 0);
    }
  });

  test("a container with other content keeps articles in normal flow", async ({ page }) => {
    await page.goto("/demo/");
    expect(await page.locator("#cards").evaluate((section) => getComputedStyle(section).display)).toBe("block");
    expect(await page.locator("#cards > article").evaluate((card) => getComputedStyle(card).borderTopWidth)).toBe(
      "1px",
    );
  });

  test("a page's lone article is plain text, not a card", async ({ page }) => {
    await page.goto("/demo/article.html");
    const style = await page.locator("main > article").evaluate((article) => ({
      border: getComputedStyle(article).borderTopWidth,
      padding: getComputedStyle(article).paddingTop,
    }));
    expect(style).toEqual({ border: "0px", padding: "0px" });
  });
});

test.describe("docs layout", () => {
  test.beforeEach(async ({ page }) => {
    // Reduced motion keeps the Chromium-only hide-on-scroll from moving the bar.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 800 });
  });

  test("the top nav sticks and the sticky offset matches its height", async ({ page }) => {
    await page.goto("/demo/docs.html");
    const nav = await rect(page, "body > header > nav");
    expect(await stickyOffset(page)).toBeCloseTo(nav.height, 0);

    await page.evaluate(() => scrollTo({ top: 1200, behavior: "instant" }));
    expect((await rect(page, "body > header > nav")).top).toBeCloseTo(0, 0);
  });

  test("the side nav and rail sit beside main and stick below the top bar", async ({ page }) => {
    await page.goto("/demo/docs.html");
    const [side, main, aside] = await Promise.all([
      rect(page, "body > nav"),
      rect(page, "main"),
      rect(page, "body > aside"),
    ]);
    expect(side.right).toBeLessThanOrEqual(main.left);
    expect(aside.left).toBeGreaterThanOrEqual(main.right);

    await page.evaluate(() => scrollTo({ top: 1200, behavior: "instant" }));
    const bar = await rect(page, "body > header > nav");
    expect((await rect(page, "body > nav")).top).toBeGreaterThan(bar.bottom);
    expect((await rect(page, "body > aside")).top).toBeGreaterThan(bar.bottom);
  });

  test("a side nav taller than the window scrolls on its own", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 320 });
    await page.goto("/demo/docs.html");
    await page.evaluate(() => scrollTo({ top: 1200, behavior: "instant" }));
    const sizes = await page.locator("body > nav").evaluate((nav) => ({
      scroll: nav.scrollHeight,
      client: nav.clientHeight,
      bottom: nav.getBoundingClientRect().bottom,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    expect(sizes.bottom).toBeLessThanOrEqual(320);
  });

  test("narrow screens stack into one column with sideways-scrolling nav rows", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/demo/docs.html");
    expect(await page.evaluate(() => getComputedStyle(document.body).display)).toBe("block");
    const list = await page
      .locator("body > nav > ul")
      .evaluate((ul) => ({ overflow: getComputedStyle(ul).overflowX, wrap: getComputedStyle(ul).flexWrap }));
    expect(list).toEqual({ overflow: "auto", wrap: "nowrap" });
    expect((await rect(page, "main")).top).toBeGreaterThan((await rect(page, "body > nav")).bottom);
  });

  test("anchor targets and sticky table headers clear the top bar", async ({ page }) => {
    await page.goto("/demo/docs.html#density");
    const bar = await rect(page, "body > header > nav");
    expect((await rect(page, "#density h2")).top).toBeGreaterThanOrEqual(bar.bottom);

    const table = await rect(page, "#density table");
    await page.evaluate((top) => scrollBy({ top: top - 20, behavior: "instant" }), table.top + 40);
    expect((await rect(page, "#density thead th")).top).toBeCloseTo(bar.bottom, 0);
  });

  // WCAG 2.4.11 Focus Not Obscured.
  test("focused content is not hidden behind the top bar", async ({ page }) => {
    await page.goto("/demo/docs.html");
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.locator("#install pre").focus();
    const bar = await rect(page, "body > header > nav");
    expect((await rect(page, "#install pre")).top).toBeGreaterThanOrEqual(bar.bottom);
  });
});

test("the top bar hides while scrolling down and returns while scrolling up", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "scroll-state(scrolled) queries are Chromium-only");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/demo/docs.html");
  await page.mouse.move(700, 400);

  await page.mouse.wheel(0, 600);
  await expect.poll(async () => (await rect(page, "body > header > nav")).bottom).toBeLessThanOrEqual(0);

  await page.mouse.wheel(0, -200);
  await expect.poll(async () => (await rect(page, "body > header > nav")).top).toBeCloseTo(0, 0);
});
