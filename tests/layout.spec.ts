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

const lastBar = "body > header > nav:last-of-type";

const barsHeight = (page: Page) =>
  page
    .locator("body > header > nav")
    .evaluateAll((navs) => navs.reduce((sum, nav) => sum + nav.getBoundingClientRect().height, 0));

test.describe("cards", () => {
  test("a container of only articles lays out equal-height cards with footers at the bottom", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/kitchen-sink.html");
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
    await page.goto("/kitchen-sink.html");
    expect(await page.locator("#cards").evaluate((section) => getComputedStyle(section).display)).toBe("block");
    expect(await page.locator("#cards > article").evaluate((card) => getComputedStyle(card).borderTopWidth)).toBe(
      "1px",
    );
  });

  test("a page's lone article is plain text, not a card", async ({ page }) => {
    await page.goto("/layouts/article.html");
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
    await page.setViewportSize({ width: 1440, height: 320 });
    await page.goto("/layouts/article.html");
    expect(await page.locator("body > header > nav").count()).toBe(1);
    expect(await stickyOffset(page)).toBeCloseTo((await rect(page, "body > header > nav")).height, 0);

    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    expect((await rect(page, "body > header > nav")).top).toBeCloseTo(0, 0);
  });

  test("a subnav sticks below the top bar and the sticky offset covers both", async ({ page }) => {
    await page.goto("/layouts/docs.html");
    const top = await rect(page, "body > header > nav");
    const sub = await rect(page, lastBar);
    expect(sub.height).toBeCloseTo(top.height, 0);
    expect(await stickyOffset(page)).toBeCloseTo(await barsHeight(page), 0);

    await page.evaluate(() => scrollTo({ top: 1200, behavior: "instant" }));
    expect((await rect(page, "body > header > nav")).top).toBeCloseTo(0, 0);
    expect((await rect(page, lastBar)).top).toBeCloseTo(top.height, 0);
  });

  test("the side nav and rail sit beside main and stick below the top bar", async ({ page }) => {
    await page.goto("/layouts/docs.html");
    const [side, main, aside] = await Promise.all([
      rect(page, "body > nav"),
      rect(page, "main"),
      rect(page, "body > aside"),
    ]);
    expect(side.right).toBeLessThanOrEqual(main.left);
    expect(aside.left).toBeGreaterThanOrEqual(main.right);

    await page.evaluate(() => scrollTo({ top: 1200, behavior: "instant" }));
    const bar = await rect(page, lastBar);
    expect((await rect(page, "body > nav")).top).toBeGreaterThan(bar.bottom);
    expect((await rect(page, "body > aside")).top).toBeGreaterThan(bar.bottom);
  });

  test("a side nav taller than the window scrolls on its own", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 320 });
    await page.goto("/layouts/docs.html");
    await page.evaluate(() => scrollTo({ top: 1200, behavior: "instant" }));
    const sizes = await page.locator("body > nav").evaluate((nav) => ({
      scroll: nav.scrollHeight,
      client: nav.clientHeight,
      bottom: nav.getBoundingClientRect().bottom,
    }));
    expect(sizes.scroll).toBeGreaterThan(sizes.client);
    expect(sizes.bottom).toBeLessThanOrEqual(320);
  });

  test("a long top bar doesn't widen the empty rail column or squeeze main", async ({ page }) => {
    await page.goto("/kitchen-sink.html");
    const columns = () =>
      page.evaluate(() =>
        getComputedStyle(document.body)
          .gridTemplateColumns.replace(/\[[^\]]*\]\s*/g, "")
          .trim(),
      );
    const before = await columns();
    await page
      .locator("body > header > nav ul")
      .last()
      .evaluate((list) =>
        list.insertAdjacentHTML("beforeend", '<li><a href="#top">A much longer extra link</a></li>'.repeat(6)),
      );
    const after = await columns();
    expect(after).toBe(before);
    expect(after.split(" ").at(-1)).toBe("0px");
  });

  test("narrow screens stack into one column with sideways-scrolling nav rows", async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto("/layouts/docs.html");
    expect(await page.evaluate(() => getComputedStyle(document.body).display)).toBe("block");
    const list = await page
      .locator("body > nav > ul")
      .evaluate((ul) => ({ overflow: getComputedStyle(ul).overflowX, wrap: getComputedStyle(ul).flexWrap }));
    expect(list).toEqual({ overflow: "auto", wrap: "nowrap" });
    expect((await rect(page, "main")).top).toBeGreaterThan((await rect(page, "body > nav")).bottom);
  });

  test("anchor targets and sticky table headers clear the top bar", async ({ page }) => {
    await page.goto("/layouts/docs.html#density");
    const bar = await rect(page, lastBar);
    expect((await rect(page, "#density h2")).top).toBeGreaterThanOrEqual(bar.bottom);

    const table = await rect(page, "#density table");
    await page.evaluate((top) => scrollBy({ top: top - 20, behavior: "instant" }), table.top + 40);
    expect((await rect(page, "#density thead th")).top).toBeCloseTo(bar.bottom, 0);
  });

  // WCAG 2.4.11 Focus Not Obscured.
  test("focused content is not hidden behind the top bar", async ({ page }) => {
    await page.goto("/layouts/docs.html");
    await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
    await page.locator("#install pre").focus();
    const bar = await rect(page, lastBar);
    expect((await rect(page, "#install pre")).top).toBeGreaterThanOrEqual(bar.bottom);
  });
});

test.describe("navigation extras", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  for (const width of [1440, 360]) {
    test(`a top bar with two lists splits to either end and keeps one line at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/layouts/docs.html");
      const [nav, brand, links] = await Promise.all([
        rect(page, "body > header > nav"),
        rect(page, "body > header > nav > ul:first-child"),
        rect(page, "body > header > nav > ul:last-child"),
      ]);
      expect(brand.left).toBeLessThanOrEqual(nav.left);
      expect(links.right).toBeGreaterThanOrEqual(nav.right);
      expect(brand.top).toBeCloseTo(links.top, 0);
      expect(await stickyOffset(page)).toBeCloseTo(await barsHeight(page), 0);
      expect(await stickyOffset(page)).toBeCloseTo(2 * nav.height, 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    });
  }

  test("a nav with two lists outside the top bar splits to either end", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/kitchen-sink.html");
    const selector = '#split-bar nav[aria-label="Account"]';
    const [nav, brand, links] = await Promise.all([
      rect(page, selector),
      rect(page, `${selector} > ul:first-child`),
      rect(page, `${selector} > ul:last-child`),
    ]);
    expect(brand.left).toBeCloseTo(nav.left, 0);
    expect(links.right).toBeCloseTo(nav.right, 0);
    expect(brand.top).toBeCloseTo(links.top, 0);
  });

  test("breadcrumb separators are drawn but not announced, and the last item is muted", async ({ page }) => {
    await page.goto("/layouts/docs.html");
    const crumbs = page.locator('main nav[aria-label="Breadcrumb"]');
    const separators = await crumbs
      .locator("li")
      .evaluateAll((items) => items.map((item) => getComputedStyle(item, "::before").content));
    expect(separators[0]).toBe("none");
    expect(separators.slice(1).every((content) => content.startsWith('"/"'))).toBe(true);
    const snapshot = await crumbs.ariaSnapshot();
    expect(snapshot).toContain('link "Docs"');
    expect(snapshot.split("\n").filter((line) => line.includes("/") && !line.includes("/url:"))).toEqual([]);

    const colors = await crumbs.evaluate((nav) => ({
      first: getComputedStyle(nav.querySelector("li:first-child a")!).color,
      last: getComputedStyle(nav.querySelector("li:last-child a")!).color,
      muted: getComputedStyle(nav.querySelector("li:last-child")!, "::before").color,
    }));
    expect(colors.last).toBe(colors.muted);
    expect(colors.last).not.toBe(colors.first);
  });
});

test.describe("layout pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("pricing puts its plans in one row of equal cards under a split subnav", async ({ page }) => {
    await page.goto("/layouts/pricing.html");
    const cards = await page
      .locator("#plans article")
      .evaluateAll((articles) => articles.map((article) => article.getBoundingClientRect().toJSON() as DOMRect));
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.top).toBeCloseTo(cards[0].top, 0);
      expect(card.height).toBeCloseTo(cards[0].height, 0);
    }

    const [nav, sections, account] = await Promise.all([
      rect(page, lastBar),
      rect(page, `${lastBar} > ul:first-child`),
      rect(page, `${lastBar} > ul:last-child`),
    ]);
    expect(sections.left).toBeLessThanOrEqual(nav.left);
    expect(account.right).toBeGreaterThanOrEqual(nav.right);
    expect(await stickyOffset(page)).toBeCloseTo(await barsHeight(page), 0);
  });

  test("the sign-in card is narrow and centered", async ({ page }) => {
    await page.goto("/layouts/login.html");
    const main = await rect(page, "main");
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    expect(main.width).toBeLessThanOrEqual(24 * 16);
    expect(main.left).toBeCloseTo(width - main.right, 0);
    expect(await page.locator("main > article").evaluate((card) => getComputedStyle(card).borderTopWidth)).toBe("1px");
  });

  test("settings puts its side nav beside the form groups", async ({ page }) => {
    await page.goto("/layouts/settings.html");
    expect((await rect(page, "body > nav")).right).toBeLessThanOrEqual((await rect(page, "main")).left);
  });
});

test.describe("typography", () => {
  test("a quote footer gets an em dash that isn't announced", async ({ page }) => {
    await page.goto("/kitchen-sink.html");
    const footer = page.locator("#quotes blockquote > footer");
    expect(await footer.evaluate((element) => getComputedStyle(element, "::before").content)).toMatch(/^"— "/);
    expect(await page.locator("#quotes > blockquote").ariaSnapshot()).toContain("- text: A footer inside the quote");
  });

  test("heading links keep the heading color, and ins and del use the status colors", async ({ page }) => {
    await page.goto("/kitchen-sink.html");
    const colors = await page.evaluate(() => {
      const color = (selector: string) => getComputedStyle(document.querySelector(selector)!).color;
      return {
        heading: color("#headings h3:has(a)"),
        headingLink: color("#headings h3 a"),
        link: color("#links a"),
        ins: color("#typography ins"),
        del: color("#typography del"),
        text: color("#typography p"),
      };
    });
    expect(colors.headingLink).toBe(colors.heading);
    expect(colors.headingLink).not.toBe(colors.link);
    expect(new Set([colors.ins, colors.del, colors.text]).size).toBe(3);
  });
});

test("the top bar hides while scrolling down and returns while scrolling up", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "scroll-state(scrolled) queries are Chromium-only");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/layouts/docs.html");
  await page.mouse.move(700, 400);

  await page.mouse.wheel(0, 600);
  await expect.poll(async () => (await rect(page, "body > header > nav")).bottom).toBeLessThanOrEqual(0);
  await expect.poll(async () => (await rect(page, lastBar)).top).toBeCloseTo(0, 0);
  await expect
    .poll(async () => (await rect(page, "body > nav")).top)
    .toBeGreaterThan((await rect(page, lastBar)).bottom);

  await page.mouse.wheel(0, -200);
  await expect.poll(async () => (await rect(page, "body > header > nav")).top).toBeCloseTo(0, 0);
  await expect
    .poll(async () => (await rect(page, lastBar)).top)
    .toBeCloseTo((await rect(page, "body > header > nav")).bottom, 0);
});

test.describe("popover menus", () => {
  const anchored = (page: Page) => page.evaluate(() => CSS.supports("position-area: block-end"));

  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/kitchen-sink.html#dialog");
  });

  test("a menu opens below its button, aligned to its start", async ({ page }) => {
    test.skip(!(await anchored(page)), "needs CSS anchor positioning");
    await page.locator('[popovertarget="demo-menu"]').click();
    const [button, menu] = await Promise.all([rect(page, '[popovertarget="demo-menu"]'), rect(page, "#demo-menu")]);
    expect(menu.top).toBeGreaterThanOrEqual(button.bottom);
    expect(menu.top - button.bottom).toBeLessThan(16);
    expect(menu.left).toBeCloseTo(button.left, 0);
  });

  test("a menu flips above its button when there's no room below", async ({ page }) => {
    test.skip(!(await anchored(page)), "needs CSS anchor positioning");
    await page.locator('[popovertarget="demo-menu"]').evaluate((button) => {
      const { bottom } = button.getBoundingClientRect();
      scrollBy({ top: bottom - innerHeight + 8, behavior: "instant" });
    });
    await page.locator('[popovertarget="demo-menu"]').click();
    const [button, menu] = await Promise.all([rect(page, '[popovertarget="demo-menu"]'), rect(page, "#demo-menu")]);
    expect(menu.bottom).toBeLessThanOrEqual(button.top);
  });

  test("Escape and a click outside close the menu", async ({ page }) => {
    const menu = page.locator("#demo-menu");
    await page.locator('[popovertarget="demo-menu"]').click();
    await expect(menu).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();

    await page.locator('[popovertarget="demo-menu"]').click();
    await expect(menu).toBeVisible();
    await page.mouse.click(4, 4);
    await expect(menu).toBeHidden();
  });

  test("menu items fill the menu, even in a nav, while a popover without a list stays centered", async ({ page }) => {
    await page.locator("#dialog").evaluate((section) =>
      section.insertAdjacentHTML(
        "beforeend",
        `<nav aria-label="Test"><ul><li><button type="button" popovertarget="nav-menu">More</button>
          <ul id="nav-menu" popover><li><a href="#dialog">One</a></li><li><a href="#dialog">Two</a></li></ul>
        </li></ul></nav>`,
      ),
    );
    await page.locator('[popovertarget="nav-menu"]').click();
    const layout = await page.locator("#nav-menu").evaluate((menu) => ({
      direction: getComputedStyle(menu).flexDirection,
      menu: menu.clientWidth - parseFloat(getComputedStyle(menu).paddingInlineStart) * 2,
      items: [...menu.querySelectorAll("a")].map((link) => link.getBoundingClientRect().width),
    }));
    expect(layout.direction).toBe("column");
    for (const width of layout.items) expect(width).toBeCloseTo(layout.menu, 0);

    await page.keyboard.press("Escape");
    await page.locator('[popovertarget="demo-popover"]').click();
    const popover = await rect(page, "#demo-popover");
    const viewport = page.viewportSize()!;
    expect(popover.left + popover.width / 2).toBeCloseTo(viewport.width / 2, 0);
  });
});
