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
