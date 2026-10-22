import { expect, test, type Page } from "@playwright/test";

const switchState = (page: Page, name: string) =>
  page.locator(`input[name="${name}"]`).evaluate((input) => {
    const thumb = getComputedStyle(input, "::before");
    const track = input.getBoundingClientRect();
    return {
      track: getComputedStyle(input).backgroundColor,
      thumb: thumb.backgroundColor,
      // The thumb sits at the start of the track; a checked thumb is translated toward the end.
      offset: thumb.translate === "none" ? 0 : parseFloat(thumb.translate),
      travel: track.width - 2 - parseFloat(getComputedStyle(input).paddingInlineStart) * 2 - parseFloat(thumb.width),
    };
  });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/demo/");
});

test("a switch moves its thumb to the end of the track when checked", async ({ page }) => {
  const on = await switchState(page, "digest");
  const off = await switchState(page, "beta");
  expect(off.offset).toBe(0);
  expect(on.offset).toBeCloseTo(on.travel, 0);
  expect(on.track).not.toBe(off.track);
});

test("a switch stays visible in forced-colors mode", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  for (const name of ["digest", "beta"]) {
    const state = await switchState(page, name);
    expect(state.thumb, `${name} thumb vs track`).not.toBe(state.track);
  }
});

test("aria-invalid colors the field border and its helper text", async ({ page }) => {
  const read = (name: string) =>
    page.locator(`input[name="${name}"]`).evaluate((input) => ({
      border: getComputedStyle(input).borderTopColor,
      helper: getComputedStyle(input.nextElementSibling!).color,
    }));
  const [plain, invalid, valid] = await Promise.all([read("name"), read("username"), read("handle")]);
  expect(invalid.border).toBe(invalid.helper);
  expect(valid.border).toBe(valid.helper);
  expect(new Set([plain.border, invalid.border, valid.border]).size).toBe(3);
  expect(plain.helper).not.toBe(invalid.helper);
});

test.describe("validation icons", () => {
  // Reads the icon slot at the field's inline end from a screenshot: inked pixels and whether red or green dominates.
  const icon = async (page: Page, name: string) => {
    const field = page.locator(`input[name="${name}"]`);
    const png = (await field.screenshot()).toString("base64");
    return field.evaluate(async (input, data) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const context = new OffscreenCanvas(image.width, image.height).getContext("2d")!;
      context.drawImage(image, 0, 0);
      const style = getComputedStyle(input);
      const scale = image.width / input.getBoundingClientRect().width;
      const size = parseFloat(style.fontSize) * scale;
      const inset = (parseFloat(style.borderInlineEndWidth) + 12) * scale;
      const rtl = style.direction === "rtl";
      const x = rtl ? inset : image.width - inset - size;
      const pixel = (px: number, py: number) => context.getImageData(px, py, 1, 1).data;
      const background = pixel(rtl ? image.width - 4 * scale : 4 * scale, image.height / 2);
      let [count, red, green] = [0, 0, 0];
      for (let px = Math.floor(x); px < x + size; px++) {
        for (let py = Math.floor((image.height - size) / 2); py < (image.height + size) / 2; py++) {
          const [r, g, b] = pixel(px, py);
          if (Math.max(Math.abs(r - background[0]), Math.abs(g - background[1]), Math.abs(b - background[2])) > 64) {
            count++;
            red += r > g ? 1 : 0;
            green += g > r ? 1 : 0;
          }
        }
      }
      return { count, hue: count === 0 ? "none" : red > green ? "red" : "green" };
    }, png);
  };

  test("invalid and valid fields show an icon at the inline end; plain fields don't", async ({ page }) => {
    expect((await icon(page, "username")).hue).toBe("red");
    expect((await icon(page, "handle")).hue).toBe("green");
    expect((await icon(page, "name")).count).toBe(0);
  });

  test("the icon moves to the left in right-to-left text", async ({ page }) => {
    await page.locator('input[name="username"]').evaluate((input) => input.setAttribute("dir", "rtl"));
    expect((await icon(page, "username")).hue).toBe("red");
  });

  test("the icons stay in forced-colors mode, where both borders look the same", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    expect((await icon(page, "username")).hue).toBe("red");
    expect((await icon(page, "handle")).hue).toBe("green");
  });

  test("selects and date fields skip the icon", async ({ page }) => {
    const images = await page.evaluate(() => {
      const field = (html: string) => {
        document.body.insertAdjacentHTML("beforeend", html);
        return getComputedStyle(document.body.lastElementChild!).backgroundImage;
      };
      return [
        field('<input type="date" aria-invalid="true" />'),
        field('<select aria-invalid="true"><option>x</option></select>'),
      ];
    });
    for (const image of images) expect(image).not.toContain("de3c37");
  });
});

test.describe("range", () => {
  // Fill and thumb are vendor pseudo-elements that getComputedStyle can't read, so sample a screenshot's middle row.
  const samples = async (page: Page) => {
    const png = (await page.locator('input[name="volume"]').screenshot()).toString("base64");
    return page.evaluate(async (data) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const canvas = new OffscreenCanvas(image.width, image.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0);
      const input = document.querySelector<HTMLInputElement>('input[name="volume"]')!;
      const fraction = Number(input.value) / 100;
      const ltr = getComputedStyle(input).direction === "ltr";
      const thumbX = image.height / 2 + (image.width - image.height) * (ltr ? fraction : 1 - fraction);
      const at = (x: number) => context.getImageData(Math.round(x), Math.round(image.height / 2), 1, 1).data;
      const thumb = at(thumbX);
      // Largest channel difference from the thumb; engines may round the fill and thumb colors differently.
      const distance = (x: number) => Math.max(...at(x).map((channel, index) => Math.abs(channel - thumb[index])));
      return { start: distance(image.width * 0.1), end: distance(image.width * 0.95) };
    }, png);
  };

  test("the track fills from the start up to the thumb", async ({ page }) => {
    const { start, end } = await samples(page);
    expect(start).toBeLessThanOrEqual(4);
    expect(end).toBeGreaterThan(32);
  });

  test("the fill starts from the right in right-to-left text", async ({ page }) => {
    await page.locator('input[name="volume"]').evaluate((input) => input.setAttribute("dir", "rtl"));
    const { start, end } = await samples(page);
    expect(end).toBeLessThanOrEqual(4);
    expect(start).toBeGreaterThan(32);
  });

  test("the fill and track stay distinct in forced-colors mode", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    const { start, end } = await samples(page);
    expect(start).toBeLessThanOrEqual(4);
    expect(end).toBeGreaterThan(32);
  });
});

test.describe("search", () => {
  test("a search landmark joins its field and button, with or without a form", async ({ page }) => {
    await page
      .locator("#buttons search")
      .evaluate((search) =>
        search.insertAdjacentHTML(
          "afterend",
          '<search id="bare"><input type="search" aria-label="Bare" /><button>Go</button></search>',
        ),
      );
    for (const selector of ["#buttons search > form", "#bare"]) {
      const layout = await page.locator(selector).evaluate((group) => {
        const [input, button] = [...group.children].map((child) => ({
          rect: child.getBoundingClientRect(),
          start: getComputedStyle(child).borderStartStartRadius,
          end: getComputedStyle(child).borderStartEndRadius,
        }));
        return {
          gap: button.rect.left - input.rect.right,
          width: input.rect.width + button.rect.width - 1,
          group: group.getBoundingClientRect().width,
          radii: [input.start, input.end, button.start, button.end],
        };
      });
      expect(layout.gap, selector).toBeCloseTo(-1, 0);
      expect(layout.width, selector).toBeCloseTo(layout.group, 0);
      expect(layout.radii, selector).toEqual(["8px", "0px", "0px", "8px"]);
    }
  });

  test("a search field's icon sits at the inline start, in both directions", async ({ page }) => {
    const read = () =>
      page.locator('input[type="search"]').evaluate((input) => {
        const style = getComputedStyle(input);
        // The magnifier is the last background layer; the first is the validation icon slot.
        return {
          image: style.backgroundImage.split(", ").at(-1)!.startsWith('url("data:image/svg+xml'),
          x: style.backgroundPositionX.split(", ").at(-1)!,
          start: parseFloat(style.paddingInlineStart),
          end: parseFloat(style.paddingInlineEnd),
        };
      });
    const ltr = await read();
    expect(ltr.image).toBe(true);
    expect(ltr.x).not.toMatch(/right|100%/);
    expect(ltr.start).toBeGreaterThan(ltr.end);

    await page.locator("#buttons search").evaluate((search) => search.setAttribute("dir", "rtl"));
    expect((await read()).x).toMatch(/right|100%/);
  });
});

test.describe("buttons and groups", () => {
  test("a link with role=button looks like a button", async ({ page }) => {
    const [link, button] = await Promise.all(
      ['a[role="button"]', "#buttons button"].map((selector) =>
        page
          .locator(selector)
          .first()
          .evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              height: Math.round(element.getBoundingClientRect().height * 100) / 100,
              background: style.backgroundColor,
              color: style.color,
              underline: style.textDecorationLine,
            };
          }),
      ),
    );
    expect(link).toEqual({ ...button, underline: "none" });
    const disabled = await page
      .locator('a[role="button"][aria-disabled="true"]')
      .evaluate((link) => getComputedStyle(link).opacity);
    expect(disabled).toBe("0.5");
  });

  test("a group joins its children edge to edge with rounded outer corners only", async ({ page }) => {
    const buttons = await page.locator('[aria-label="Text alignment"] > button').evaluateAll((buttons) =>
      buttons.map((button) => ({
        left: button.getBoundingClientRect().left,
        right: button.getBoundingClientRect().right,
        startRadius: getComputedStyle(button).borderStartStartRadius,
        endRadius: getComputedStyle(button).borderStartEndRadius,
      })),
    );
    for (let index = 1; index < buttons.length; index++) {
      expect(buttons[index].left).toBeCloseTo(buttons[index - 1].right - 1, 0);
    }
    expect(buttons.map(({ startRadius, endRadius }) => [startRadius, endRadius])).toEqual([
      ["8px", "0px"],
      ["0px", "0px"],
      ["0px", "8px"],
    ]);
  });

  test("an input and button group stretches to fill its container", async ({ page }) => {
    const sizes = await page.locator("#buttons search > form").evaluate((group) => ({
      group: group.getBoundingClientRect().width,
      children: [...group.children].reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) - 1,
    }));
    expect(sizes.children).toBeCloseTo(sizes.group, 0);
  });

  test("a focused child's ring stays on top of its neighbors, including a pressed one", async ({ page }) => {
    // WebKit doesn't Tab to buttons by default, so focus directly after a keypress to get :focus-visible.
    await page.keyboard.press("Shift");
    await page.locator('[aria-label="Text alignment"] > button').nth(1).focus();
    const stacking = await page
      .locator('[aria-label="Text alignment"] > button')
      .evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).zIndex));
    expect(stacking).toEqual(["1", "2", "auto"]);
  });
});

test.describe("toggle buttons", () => {
  const looks = (page: Page) =>
    page.locator('[aria-label="Text alignment"] > button').evaluateAll((buttons) =>
      buttons.map((button) => {
        const style = getComputedStyle(button);
        return `${style.backgroundColor} ${style.borderTopColor} ${style.color}`;
      }),
    );

  test("a pressed toggle stands out from unpressed ones, which match the secondary button", async ({ page }) => {
    const [pressed, unpressed, other] = await looks(page);
    expect(unpressed).toBe(other);
    expect(pressed).not.toBe(unpressed);
    const secondary = await page.locator('button[type="reset"]').evaluate((button) => {
      const style = getComputedStyle(button);
      return `${style.backgroundColor} ${style.borderTopColor} ${style.color}`;
    });
    expect(unpressed).toBe(secondary);
  });

  test("pressing another toggle in the demo group moves the pressed look", async ({ page }) => {
    const before = await looks(page);
    await page.locator('[aria-label="Text alignment"] > button').nth(2).click();
    await page.mouse.move(0, 0);
    expect(await looks(page)).toEqual([before[1], before[1], before[0]]);
  });

  test("a pressed toggle stays distinct in forced-colors mode", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    const [pressed, unpressed] = await looks(page);
    expect(pressed).not.toBe(unpressed);
  });
});
