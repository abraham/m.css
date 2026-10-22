import { expect, test, type Page } from "@playwright/test";
import { components as componentNames, pages } from "../scripts/demo.ts";

const root = (page: Page) =>
  page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    contrast: document.documentElement.getAttribute("data-contrast"),
    dir: document.documentElement.getAttribute("dir"),
    style: document.documentElement.style.cssText,
  }));

const openSettings = (page: Page) => page.getByRole("button", { name: "Settings" }).click();

const components = componentNames.map((name) => `/demo/components/${name}.html`);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("every internal link resolves, including its fragment", async ({ page, request }) => {
  const checked = new Map<string, string>();
  for (const path of pages) {
    await page.goto(path);
    const links = await page
      .locator("a[href]")
      .evaluateAll((links) =>
        links.map((link) => (link as HTMLAnchorElement).href).filter((href) => href.startsWith(location.origin)),
      );
    for (const link of links) {
      const url = new URL(link);
      const target = url.origin + url.pathname;
      if (!checked.has(target)) {
        const response = await request.get(target);
        expect(response.status(), `${link} from ${path}`).toBe(200);
        checked.set(target, await response.text());
      }
      if (url.hash) {
        const id = decodeURIComponent(url.hash.slice(1));
        expect(checked.get(target), `${link} from ${path}`).toContain(`id="${id}"`);
      }
    }
  }
});

test("every example gets its markup, and state toggles when it declares states", async ({ page }) => {
  for (const path of components) {
    await page.goto(path);
    const examples = await page.locator("figure[data-example]").evaluateAll((figures) =>
      figures.map((figure) => ({
        name: figure.getAttribute("data-example"),
        states: (figure.getAttribute("data-states") ?? "").split(/\s+/).filter(Boolean).length,
        toggles: figure.previousElementSibling?.querySelectorAll("[data-example-states] button").length ?? 0,
        code: figure.nextElementSibling?.matches("[data-example-code]")
          ? (figure.nextElementSibling.querySelector("code")?.textContent ?? "")
          : "",
      })),
    );
    expect(examples.length, path).toBeGreaterThan(0);
    for (const { name, states, toggles, code } of examples) {
      expect(toggles, `${path} ${name}`).toBe(states);
      expect(code.trim(), `${path} ${name}`).not.toBe("");
    }
  }
});

test("every page shares the same top bar, marking the current page or its section", async ({ page }) => {
  const bars = [];
  for (const path of pages) {
    await page.goto(path);
    const bar = await page
      .locator("body > header > nav")
      .first()
      .evaluate((nav) => ({
        label: nav.getAttribute("aria-label"),
        links: [...nav.querySelectorAll("a")].map((link) => `${link.textContent} ${link.href}`),
        current: [...nav.querySelectorAll("[aria-current]")].map(
          (link) => `${link.getAttribute("aria-current")} ${(link as HTMLAnchorElement).href}`,
        ),
      }));
    // A component page marks Components as its section, or as the page itself on the first component page.
    const typography = new URL("/demo/components/typography.html", page.url()).href;
    const expected = !components.includes(path)
      ? [`page ${page.url()}`]
      : [`${page.url() === typography ? "page" : "true"} ${typography}`];
    expect(bar.current, path).toEqual(expected);
    bars.push({ label: bar.label, links: bar.links });
  }
  for (const bar of bars.slice(1)) expect(bar).toEqual(bars[0]);
});

test("component pages share a side nav and an On this page rail that link within the page", async ({ page }) => {
  const navs = [];
  for (const path of components) {
    await page.goto(path);
    const nav = await page.locator('body > nav[aria-label="Components"]').evaluate((nav) => ({
      links: [...nav.querySelectorAll("a")].map((link) => link.href),
      current: [...nav.querySelectorAll('[aria-current="page"]')].map((link) => (link as HTMLAnchorElement).href),
    }));
    expect(nav.current, path).toEqual([page.url()]);
    navs.push(nav.links);
    expect(nav.links).toEqual(components.map((component) => new URL(component, page.url()).href));

    const rail = await page
      .locator('body > aside[aria-label="On this page"] a')
      .evaluateAll((links) =>
        links.map((link) => Boolean(document.getElementById((link as HTMLAnchorElement).hash.slice(1)))),
      );
    expect(rail.length, path).toBeGreaterThan(0);
    expect(rail.every(Boolean), path).toBe(true);
  }
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
    expect(await snippet(page, "text-fields")).toMatch(/<input name="name"[^>]* disabled[ >]/);

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

  test("a snippet keeps the whitespace inside a pre and drops demo-only hooks", async ({ page }) => {
    await page.goto("/demo/components/typography.html");
    expect(await snippet(page, "code")).toContain("<code>:root {\n  --m-primary:");
    await page.goto("/demo/components/overlays.html");
    expect(await snippet(page, "dialog")).not.toContain("data-show-modal");
  });

  test("a support badge reports what this browser supports", async ({ page }) => {
    const supported = await page.evaluate(() => CSS.supports("(appearance: base-select)"));
    await expect(page.locator("#select [data-support]")).toHaveAttribute("data-support", supported ? "yes" : "no");
  });
});
