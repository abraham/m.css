import { expect, test, type Page } from "@playwright/test";

const root = (page: Page) =>
  page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    contrast: document.documentElement.getAttribute("data-contrast"),
    dir: document.documentElement.getAttribute("dir"),
    style: document.documentElement.style.cssText,
  }));

const openSettings = (page: Page) => page.getByRole("button", { name: "Settings" }).click();

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("every page shares the same top bar, marking itself as the current page", async ({ page }) => {
  const bars = [];
  for (const path of ["/demo/", "/demo/docs.html", "/demo/article.html"]) {
    await page.goto(path);
    const bar = await page
      .locator("body > header > nav")
      .first()
      .evaluate((nav) => ({
        label: nav.getAttribute("aria-label"),
        links: [...nav.querySelectorAll("a")].map((link) => `${link.textContent} ${link.href}`),
        current: [...nav.querySelectorAll('[aria-current="page"]')].map((link) => (link as HTMLAnchorElement).href),
      }));
    expect(bar.current, path).toEqual([page.url()]);
    bars.push({ label: bar.label, links: bar.links });
  }
  for (const bar of bars.slice(1)) expect(bar).toEqual(bars[0]);
});

test("every page has a settings button that keeps the top bar one line tall", async ({ page }) => {
  for (const path of ["/demo/", "/demo/docs.html", "/demo/article.html"]) {
    await page.goto(path);
    const button = page.locator("body > header > nav").first().getByRole("button", { name: "Settings" });
    await expect(button).toBeVisible();
    const { bar, size } = await page.evaluate(() => {
      const probe = document.createElement("div");
      probe.style.blockSize = "var(--_m-bar-size)";
      document.body.append(probe);
      const size = probe.getBoundingClientRect().height;
      probe.remove();
      return { bar: document.querySelector("body > header > nav")!.getBoundingClientRect().height, size };
    });
    expect(bar, path).toBeCloseTo(size, 0);
  }
});

test("settings apply live, persist across pages, and show the matching CSS", async ({ page }) => {
  await page.goto("/demo/");
  await openSettings(page);
  await page.locator('#demo-settings select[name="theme"]').selectOption("dark");
  await page.locator('#demo-settings input[name="density"]').fill("1.25");
  await page.locator('#demo-settings input[name="contrast"]').check();

  expect(await root(page)).toEqual({ theme: "dark", contrast: "more", dir: null, style: "--m-density: 1.25;" });
  await expect(page.locator("[data-demo-snippet]")).toContainText("--m-density: 1.25;");
  await expect(page.locator("[data-demo-snippet]")).toContainText('<html data-theme="dark" data-contrast="more">');
  expect(new URL(page.url()).searchParams.get("theme")).toBe("dark");

  await page.goto("/demo/docs.html");
  expect(await root(page)).toEqual({ theme: "dark", contrast: "more", dir: null, style: "--m-density: 1.25;" });

  await openSettings(page);
  await page.locator('#demo-settings button[type="reset"]').click();
  expect(await root(page)).toEqual({ theme: null, contrast: null, dir: null, style: "" });
  await page.goto("/demo/article.html");
  expect(await root(page)).toEqual({ theme: null, contrast: null, dir: null, style: "" });
});

test("URL parameters apply, and unknown or unsafe values are dropped", async ({ page }) => {
  await page.goto("/demo/article.html?dir=rtl&density=9&primary=red;color:red&font=evil&theme=sepia");
  expect(await root(page)).toEqual({ theme: null, contrast: null, dir: "rtl", style: "--m-density: 1.5;" });
});
