import { expect, test, type Page } from "@playwright/test";
import { components as componentNames, layouts, pages, showcase } from "../scripts/demo.ts";

const root = (page: Page) =>
  page.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    contrast: document.documentElement.getAttribute("data-contrast"),
    dir: document.documentElement.getAttribute("dir"),
    style: document.documentElement.style.cssText,
  }));

const openSettings = (page: Page) => page.getByRole("button", { name: "Settings" }).click();

const components = componentNames.map((name) => `/demo/components/${name}.html`);
const themePages = showcase.map((name) => `/demo/showcase/${name}.html`);

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
  for (const path of [...components, "/demo/theming.html"]) {
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
    // Pages in a section mark the section's link "true", or "page" on the page it links to.
    const section =
      components.includes(path) || path === "/demo/kitchen-sink.html"
        ? "/demo/components/typography.html"
        : path.startsWith("/demo/layouts/")
          ? "/demo/layouts/"
          : path.startsWith("/demo/showcase/")
            ? "/demo/showcase/"
            : path;
    const link = new URL(section, page.url()).href;
    expect(bar.current, path).toEqual([`${page.url() === link ? "page" : "true"} ${link}`]);
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

test("every page has a settings button, except themed showcase pages, and the top bar stays one line tall", async ({
  page,
}) => {
  for (const path of pages) {
    await page.goto(path);
    const button = page.locator("body > header > nav").first().getByRole("button", { name: "Settings" });
    if (themePages.includes(path)) await expect(button).toHaveCount(0);
    else await expect(button).toBeVisible();
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

  await page.goto("/demo/layouts/docs.html");
  expect(await root(page)).toEqual({ theme: "dark", contrast: "more", dir: null, style: "--m-density: 1.25;" });

  await openSettings(page);
  await page.locator('#demo-settings button[type="reset"]').click();
  expect(await root(page)).toEqual({ theme: null, contrast: null, dir: null, style: "" });
  await page.goto("/demo/layouts/article.html");
  expect(await root(page)).toEqual({ theme: null, contrast: null, dir: null, style: "" });
});

test("URL parameters apply, and unknown or unsafe values are dropped", async ({ page }) => {
  await page.goto("/demo/layouts/article.html?dir=rtl&density=9&primary=red;color:red&font=evil&theme=sepia");
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

test("the home page switches m.css off and on for its example only", async ({ page }) => {
  await page.goto("/demo/?theme=dark");
  const frame = page.frameLocator("[data-before-after] iframe");
  const button = frame.getByRole("button", { name: "Sign up" });
  const styleOf = () => button.evaluate((element) => getComputedStyle(element).backgroundColor);
  await expect(frame.locator("html")).toHaveAttribute("data-theme", "dark");
  const styled = await styleOf();

  await page.getByRole("switch", { name: "Use m.css" }).uncheck();
  expect(await frame.locator("link").evaluate((link) => (link as HTMLLinkElement).disabled)).toBe(true);
  await expect.poll(styleOf).not.toBe(styled);

  // Chromium re-applies a re-enabled stylesheet asynchronously.
  await page.getByRole("switch", { name: "Use m.css" }).check();
  await expect.poll(styleOf).toBe(styled);
  expect(
    await frame.locator("html").evaluate((html) => html.scrollHeight <= html.clientHeight),
    "the frame fits its content",
  ).toBe(true);
  await expect(page.locator("pre[data-copy] + p").getByRole("button", { name: "Copy" })).toHaveCount(3);
});

test.describe("theming", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo/theming.html");
  });

  test("property controls restyle only the example and show the matching CSS", async ({ page }) => {
    const card = page.locator("#playground figure article");
    const elsewhere = page.locator("#schemes article").first();
    const css = page.locator("[data-property-css]");
    const radius = page.locator('[data-property="--m-radius"] input');
    const before = await elsewhere.evaluate((element) => getComputedStyle(element).borderTopLeftRadius);

    // Cards round at 1.5 times --m-radius.
    await radius.fill("1");
    await expect(card).toHaveCSS("border-top-left-radius", "24px");
    await expect(css).toContainText(":root {\n  --m-radius: 1rem;\n}");
    await expect(page.locator('[data-property="--m-radius"] output')).toHaveText("1rem");
    await expect(elsewhere).toHaveCSS("border-top-left-radius", before);

    await radius.fill("0.5");
    await expect(page.locator("#playground figure")).not.toHaveAttribute("style", /--m-radius/);
    await expect(css).not.toContainText("--m-radius");
  });

  test("forced schemes and preferences change their own section", async ({ page }) => {
    const [light, dark] = await page
      .locator("#schemes article")
      .evaluateAll((articles) => articles.map((article) => getComputedStyle(article).color));
    expect(light).not.toBe(dark);
    const [normal, more] = await page
      .locator("#preferences article a")
      .evaluateAll((links) => links.map((link) => getComputedStyle(link).color));
    expect(normal).not.toBe(more);
  });

  test("the token explorer renders every panel", async ({ page }) => {
    for (const panel of await page.locator("[data-token-panel]").all()) {
      await expect(panel.locator("*").first()).toBeAttached();
    }
    await expect(page.locator("[data-motion-readout]")).not.toBeEmpty();
  });
});

test.describe("layouts", () => {
  test("the gallery links every layout, and each layout links its own source", async ({ page }) => {
    await page.goto("/demo/layouts/");
    const links = await page
      .locator("main article h2 a")
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    expect(links).toEqual(layouts.map((name) => new URL(`${name}.html`, page.url()).href));

    for (const name of layouts) {
      await page.goto(`/demo/layouts/${name}.html`);
      await expect(page.getByRole("link", { name: "View source" })).toHaveAttribute(
        "href",
        `https://github.com/abraham/m.css/blob/main/demo/layouts/${name}.html`,
      );
    }
  });

  test("settings opens a confirmation dialog and moves the pressed toggle", async ({ page }) => {
    await page.goto("/demo/layouts/settings.html");
    await page.getByRole("button", { name: "Delete account", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete your account?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const week = page.getByRole("group", { name: "Week starts on" });
    await week.getByRole("button", { name: "Sunday" }).click();
    await expect(week.getByRole("button", { name: "Sunday" })).toHaveAttribute("aria-pressed", "true");
    await expect(week.getByRole("button", { name: "Monday" })).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("showcase", () => {
  /** The custom properties the page's theme block sets, with their values. */
  const themeValues = (page: Page) =>
    page.evaluate(() => {
      const { style } = (document.querySelector("style[data-theme-source]") as HTMLStyleElement).sheet!
        .cssRules[0] as CSSStyleRule;
      return Object.fromEntries(
        Array.from({ length: style.length }, (_, i) => [style[i], style.getPropertyValue(style[i]).trim()]),
      );
    });

  test("theme pages use only m.css and one block of public custom properties", async ({ page, request }) => {
    for (const path of themePages) {
      const html = await (await request.get(path)).text();
      expect(html, path).not.toMatch(/\s(class|style)=/);
      expect(html.match(/<style\b/g), path).toHaveLength(1);

      await page.goto(path);
      const theme = await page.evaluate(() => {
        const style = document.querySelector("style[data-theme-source]") as HTMLStyleElement;
        const rules = [...style.sheet!.cssRules] as CSSStyleRule[];
        return {
          sheets: [...document.styleSheets].map((sheet) => (sheet.href ? new URL(sheet.href).pathname : "inline")),
          selectors: rules.map((rule) => rule.selectorText),
          properties: Array.from({ length: rules[0].style.length }, (_, i) => rules[0].style[i]),
          root: [...document.documentElement.attributes].map((attribute) => attribute.name),
        };
      });
      expect(theme.sheets, path).toEqual(["/dist/m.css", "inline"]);
      expect(theme.selectors, path).toEqual([":root"]);
      expect(theme.properties.length, path).toBeGreaterThan(0);
      for (const name of theme.properties) expect(name, path).toMatch(/^--m-/);
      for (const name of theme.root) {
        expect(["lang", "data-theme", "data-motion", "data-contrast", "data-scroll-progress"], path).toContain(name);
      }
    }
  });

  test("theme pages ignore saved and URL settings, and leave the saved ones alone", async ({ page, request }) => {
    const saved = JSON.stringify({ theme: "dark", density: "1.5", primary: "#00ff00", progress: "on" });
    await page.goto("/demo/");
    await page.evaluate((value) => localStorage.setItem("m-demo-settings", value), saved);
    for (const path of themePages) {
      const theme = (await (await request.get(path)).text()).match(/<html[^>]*data-theme="(\w+)"/)?.[1] ?? null;
      await page.goto(`${path}?density=1.4&theme=dark`);
      await expect(page.getByRole("button", { name: "Settings" })).toHaveCount(0);
      const state = await page.evaluate(() => ({
        style: document.documentElement.getAttribute("style"),
        theme: document.documentElement.getAttribute("data-theme"),
        primary: getComputedStyle(document.documentElement).getPropertyValue("--m-primary").trim(),
        saved: localStorage.getItem("m-demo-settings"),
      }));
      expect(state.style, path).toBeNull();
      expect(state.theme, path).toBe(theme);
      expect(state.primary, path).toBe((await themeValues(page))["--m-primary"]);
      expect(state.saved, path).toBe(saved);
      expect(new URL(page.url()).search, path).toBe("?density=1.4&theme=dark");
    }
  });

  test("each theme page shows its whole theme, matching what it uses", async ({ page }) => {
    const squash = (text: string) => text.replace(/\s+/g, " ").trim();
    for (const path of themePages) {
      await page.goto(path);
      const { shown, css, html } = await page.evaluate(() => ({
        shown: document.querySelector("[data-theme-code]")!.textContent!,
        css: document.querySelector("style[data-theme-source]")!.textContent!,
        html: document.documentElement.outerHTML.match(/^<html[^>]*>/)![0].replaceAll('=""', ""),
      }));
      expect(squash(shown), path).toContain(squash(css));
      expect(shown, path).toContain(html);
    }
  });

  test("every showcase page has the same sticky subnav, marking the current page", async ({ page }) => {
    const all = ["/demo/showcase/", ...themePages];
    for (const path of all) {
      await page.goto(path);
      const nav = await page.locator('body > header > nav + nav[aria-label="Showcase"]').evaluate((nav) => ({
        position: getComputedStyle(nav).position,
        links: [...nav.querySelectorAll("a")].map((link) => (link as HTMLAnchorElement).href),
        current: [...nav.querySelectorAll('[aria-current="page"]')].map((link) => (link as HTMLAnchorElement).href),
      }));
      expect(nav.position, path).toBe("sticky");
      expect(nav.links, path).toEqual(all.map((link) => new URL(link, page.url()).href));
      expect(nav.current, path).toEqual([page.url()]);
    }
  });

  test("gallery cards preview each theme with the values its page uses", async ({ page }) => {
    for (const name of showcase) {
      await page.goto("/demo/showcase/");
      const card = await page
        .locator(`article[data-showcase="${name}"]`)
        .evaluate(({ style }) =>
          Object.fromEntries(
            Array.from({ length: style.length }, (_, i) => [style[i], style.getPropertyValue(style[i]).trim()]),
          ),
        );
      await page.goto(`/demo/showcase/${name}.html`);
      const theme = await themeValues(page);
      expect(Object.keys(card).length, name).toBeGreaterThan(0);
      for (const [property, value] of Object.entries(card)) expect(value, `${name} ${property}`).toBe(theme[property]);
    }
  });
});
