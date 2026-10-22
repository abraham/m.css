import { expect, test, type Page } from "@playwright/test";

const root = (page: Page) =>
  page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    contrast: document.documentElement.getAttribute("data-contrast"),
    dir: document.documentElement.getAttribute("dir"),
    style: document.documentElement.style.cssText,
  }));

const openSettings = (page: Page) => page.getByRole("button", { name: "Settings" }).click();

const pages = ["/demo/", "/demo/components/forms.html", "/demo/docs.html", "/demo/article.html"];

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("every page shares the same top bar, marking itself as the current page", async ({ page }) => {
  const bars = [];
  for (const path of pages) {
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
  for (const path of pages) {
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

test.describe("examples", () => {
  const snippet = (page: Page, id: string) => page.locator(`#${id} [data-example-code] code`).textContent();
  const state = (page: Page, id: string, name: string) =>
    page.locator(`#${id} [data-example-states]`).getByRole("button", { name, exact: true });

  test.beforeEach(async ({ page }) => {
    await page.goto("/demo/components/forms.html");
  });

  test("every example shows its own markup, without demo-only hooks", async ({ page }) => {
    const examples = await page.locator("figure[data-example]").evaluateAll((figures) =>
      figures.map((figure) => ({
        name: figure.getAttribute("data-example"),
        code: figure.nextElementSibling?.matches("[data-example-code]")
          ? figure.nextElementSibling.querySelector("code")!.textContent
          : null,
        first: figure.firstElementChild!.localName,
      })),
    );
    expect(examples.length).toBeGreaterThan(0);
    for (const { name, code, first } of examples) {
      expect(code, name!).toMatch(new RegExp(`^<${first}[ >]`));
      expect(code, name!).not.toContain("data-indeterminate");
    }
    expect(await snippet(page, "search")).toContain('<input type="search" name="q"');
  });

  test("state toggles change the example and its markup, and turning them off restores both", async ({ page }) => {
    const field = page.locator('#text-fields input[name="name"]');
    await state(page, "text-fields", "Disabled").click();
    await expect(field).toBeDisabled();
    expect(await snippet(page, "text-fields")).toContain('placeholder="Ada Lovelace" disabled');

    await state(page, "text-fields", "Invalid").click();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await state(page, "text-fields", "Valid").click();
    await expect(field).toHaveAttribute("aria-invalid", "false");
    await expect(state(page, "text-fields", "Invalid")).toHaveAttribute("aria-pressed", "false");

    await state(page, "text-fields", "Valid").click();
    await state(page, "text-fields", "Disabled").click();
    await expect(field).toBeEnabled();
    await expect(field).not.toHaveAttribute("aria-invalid");
    expect(await snippet(page, "text-fields")).not.toContain("disabled");

    // Restoring keeps attributes the markup already had.
    await state(page, "validation", "Right to left").click();
    await expect(page.locator("#validation figure")).toHaveAttribute("dir", "rtl");
    expect(await snippet(page, "validation")).toMatch(/^<!-- On a containing element: dir="rtl" -->/);
    await expect(page.locator('#validation input[name="username"]')).toHaveAttribute("aria-invalid", "true");
  });

  test("a support badge reports what this browser supports", async ({ page }) => {
    const supported = await page.evaluate(() => CSS.supports("(appearance: base-select)"));
    await expect(page.locator("#select [data-support]")).toHaveAttribute("data-support", supported ? "yes" : "no");
  });
});
