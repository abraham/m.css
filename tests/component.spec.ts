import { expect, test, type Page } from "@playwright/test";

/** A page with a custom element whose shadow root loads its own copy of m.css. */
async function open(page: Page, { pageLoadsM, html = "" }: { pageLoadsM: boolean; html?: string }) {
  const head = pageLoadsM ? '<link rel="stylesheet" href="/dist/m.css" />' : "";
  await page.route("**/component.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html ${html}><head>${head}</head><body>
        <button id="outside">Outside</button><input id="outside-input" /><p id="outside-text">Text</p>
        <m-widget></m-widget>
        <script>
          customElements.define("m-widget", class extends HTMLElement {
            connectedCallback() {
              this.attachShadow({ mode: "open" }).innerHTML =
                '<link rel="stylesheet" href="/dist/m.css" onload="this.getRootNode().host.dataset.ready = 1" /><button>Inside</button><input /><p aria-busy="true">Text</p>';
            }
          });
        </script>
      </body></html>`,
    }),
  );
  await page.goto("/component.html");
  await page.locator("m-widget[data-ready]").waitFor({ state: "attached" });
  // The shadow stylesheet loads after first paint, so controls transition from UA styles into m's.
  await page.evaluate(() => {
    const animations = [
      ...document.getAnimations(),
      ...document.querySelector("m-widget")!.shadowRoot!.getAnimations(),
    ];
    for (const animation of animations) if (animation instanceof CSSTransition) animation.finish();
  });
}

/** Computed styles of the same controls outside and inside the component. */
function read(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector("m-widget")!;
    const root = host.shadowRoot!;
    const pick = (element: Element) => {
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        color: style.color,
        padding: style.paddingBlockStart,
        radius: style.borderStartStartRadius,
        border: style.borderBlockStartColor,
        duration: style.transitionDuration,
      };
    };
    return {
      outside: pick(document.getElementById("outside")!),
      inside: pick(root.querySelector("button")!),
      outsideInput: pick(document.getElementById("outside-input")!),
      insideInput: pick(root.querySelector("input")!),
      spinner: getComputedStyle(root.querySelector("[aria-busy]")!, "::before").animationName,
      host: { background: getComputedStyle(host).backgroundColor, color: getComputedStyle(host).color },
      outsideText: getComputedStyle(document.getElementById("outside-text")!).color,
    };
  });
}

test.describe("loaded in a component's shadow root", () => {
  test("works when the page doesn't load m", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page, { pageLoadsM: false });
    const standalone = await read(page);

    await open(page, { pageLoadsM: true });
    const reference = await read(page);

    expect(standalone.inside).toEqual(reference.outside);
    expect(standalone.insideInput).toEqual(reference.outsideInput);
    expect(standalone.spinner).toBe("m-spin");
    // With no m on the page, the component paints its own surface behind its text.
    expect(standalone.host.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(standalone.host.color).toBe(reference.outsideText);
  });

  test("follows the page's settings and overrides", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page, {
      pageLoadsM: true,
      html: 'data-theme="dark" data-contrast="more" data-motion="reduce" style="--m-primary: green; --m-radius: 0"',
    });
    const { outside, inside, outsideInput, insideInput, spinner, host, outsideText } = await read(page);
    expect(inside).toEqual(outside);
    expect(insideInput).toEqual(outsideInput);
    expect(inside.radius).toBe("0px");
    expect(inside.duration).toBe("0s");
    expect(spinner).toBe("m-pulse");
    // The page paints the surface, so the component stays transparent over it.
    expect(host.background).toBe("rgba(0, 0, 0, 0)");
    expect(host.color).toBe(outsideText);
  });

  test("follows the system's reduced motion and contrast on its own", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", contrast: "more" });
    await open(page, { pageLoadsM: false });
    const standalone = await read(page);

    await open(page, { pageLoadsM: true });
    const reference = await read(page);

    expect(standalone.inside).toEqual(reference.outside);
    expect(standalone.insideInput).toEqual(reference.outsideInput);
    expect(standalone.spinner).toBe("m-pulse");
  });
});
