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
              height: element.getBoundingClientRect().height,
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
    const sizes = await page.locator('div[role="group"]').evaluate((group) => ({
      group: group.getBoundingClientRect().width,
      children: [...group.children].reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) - 1,
    }));
    expect(sizes.children).toBeCloseTo(sizes.group, 0);
  });

  test("a focused child's ring stays on top of its neighbors", async ({ page }) => {
    // WebKit doesn't Tab to buttons by default, so focus directly after a keypress to get :focus-visible.
    await page.keyboard.press("Shift");
    await page.locator('[aria-label="Text alignment"] > button').nth(1).focus();
    const stacking = await page
      .locator('[aria-label="Text alignment"] > button')
      .evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).zIndex));
    expect(stacking).toEqual(["auto", "1", "auto"]);
  });
});
