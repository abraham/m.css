---
name: m-css
description: "Add the m.css classless CSS framework (@abraham/m.css) to a website or web app, or restyle existing pages with it. Use when asked to install, set up, adopt, or migrate to m.css; to style plain semantic HTML without classes; to convert Bootstrap, Tailwind, Pico, or hand-written class-based markup to classless semantic HTML; to theme m.css with its --m-* custom properties, dark mode, or contrast settings; or to build docs, article, sign-in, pricing, or settings pages with m.css."
license: MIT
---

# m.css

m.css is one stylesheet that styles semantic HTML elements and ARIA states directly, with no classes. Every rule sits in `@layer m` with zero specificity, so any other CSS overrides it. It also owns the document layout: the body column, sticky top bar, side nav, and rail all come from the markup structure.

Live demo and examples: https://abraham.github.io/m.css/

## Procedure

1. **Inspect the project.**
   - How are pages produced: static HTML, server templates, a static site generator, or a client-side app that mounts into a wrapper element?
   - Where is the shared `<head>` or layout template?
   - What CSS exists: a class-based framework, a reset, component styles, inline styles?
2. **Add the stylesheet** once, in the shared `<head>`, before any other stylesheet:

   ```html
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@abraham/m.css/dist/m.min.css" />
   ```

   With a bundler, run `npm install @abraham/m.css` instead and import `@abraham/m.css` (or `@abraham/m.css/min`) from the main stylesheet or entry file.

3. **Deal with the existing CSS.**
   - Unlayered CSS always beats m.css. A class-based framework or global reset (Bootstrap, Tailwind Preflight, normalize.css) restyles every element and hides what m.css does. Plan to remove it, and confirm with the user before deleting anything they may still need.
   - Keep only small, site-specific rules. They work unlayered, or in a layer declared after `m`, such as `@layer m, site;`.
4. **Build the page shell.** Restructure each page template into the skeleton in [assets/page.html](./assets/page.html): `body > header > nav` for the top bar, optional `body > nav` and `body > aside` columns, `main`, and `footer`.
5. **Rewrite components as semantic HTML,** using [references/markup.md](./references/markup.md). Remove classes, wrapper `div`s, and icons that only existed for styling. Keep classes that scripts or tests rely on; they're harmless.
6. **Theme** with the public properties and attributes below, using the site's brand values.
7. **Verify** (see below), then report what changed and anything you couldn't express classlessly.

## Rules

- **No classes, IDs, or inline styles for styling.** Pick the element or attribute that means the thing; the reference lists what m.css styles. Only if nothing fits, add a short rule in the site's own CSS. For example, m.css has no centering rule, so a narrow sign-in card needs `main { max-inline-size: 24rem; margin-inline: auto; }`.
- **Never use `!important`.** It's never needed, because m.css has zero specificity.
- **Never set or depend on `--_m-*` tokens.** They're internal and can change between versions. Use only the `--m-*` properties.
- **Structure is the API.** The layout rules match direct children: `body > header > nav`, `body > nav`, `body > aside`, `main > article:only-child`. A wrapper between `body` and these elements turns those rules off.
  - Client-side apps often mount into `<div id="root">`, and then the sticky bar and columns don't apply, though element styles still do. Render the shell (header, navs, main, footer) in the server or static HTML when possible. Otherwise tell the user the page will flow as one column.
- **Styling states are real states.** `aria-current`, `aria-pressed`, `aria-invalid`, `aria-busy`, `aria-disabled`, and `disabled` change how things look. Set them only when they're true, and keep them in sync from script.
- **Accessibility comes with the markup:**
  - Every form control has a label.
  - Every image has `alt`.
  - Tables have a `caption` and header cells with `scope`.
  - A horizontally scrolling `pre` gets `tabindex="0"`.
  - When a page has more than one `nav` or `aside`, each gets an `aria-label`.

## Theme

Set these on `:root` for the whole site. `--m-primary`, `--m-on-primary`, `--m-density`, `--m-radius`, and `--m-font-mono` also work on any element, for one part of a page. `--m-font-sans`, `--m-font-size`, and `--m-measure` are read on `body`, so set them on `:root`; on an inner element they don't change its body text.

| Property         | Default                                   | Controls                                       |
| ---------------- | ----------------------------------------- | ---------------------------------------------- |
| `--m-primary`    | `oklch(55% 0.19 40)`                      | Links, buttons, focus rings, checked controls  |
| `--m-on-primary` | black or white, for contrast              | Text on primary backgrounds                    |
| `--m-density`    | `1`                                       | All spacing; `0.75` is compact, `1.25` is airy |
| `--m-radius`     | `0.5rem`                                  | Corner radius; cards use 1.5 times this        |
| `--m-font-sans`  | `system-ui, sans-serif`                   | Body and heading font                          |
| `--m-font-mono`  | `ui-monospace, SFMono-Regular, monospace` | Code font                                      |
| `--m-font-size`  | `1rem`                                    | Base text size; the type scale follows it      |
| `--m-measure`    | `100ch`                                   | Width of the main column                       |

```css
:root {
  --m-primary: #2563eb;
  --m-radius: 0.25rem;
}
```

Hover, subtle, and dark-mode variants of the primary color are derived from it, so set one brand color, not a palette.

These few properties go a long way. The showcase (https://abraham.github.io/m.css/demo/showcase/) has three whole pages, a magazine essay, a dark operations dashboard, and a playful landing page. Each is themed with only a `:root` block of these properties, and shows that block at the bottom of the page. Use them as starting points.

What the properties can't change: neutral surfaces and text colors, heading weight, shadows, and a separate heading font. Don't reach for `--_m-*` tokens to get them. Tell the user it's outside m.css's theming, or add a small unlayered rule of their own.

Keep contrast in mind:

- In dark mode, m.css lightens the primary. Its default `--m-on-primary` adapts, but an explicit one should too, for example `light-dark(white, oklch(20% 0.05 300deg))`.
- In dark themes, keep the primary at or below about 70% lightness. Lighter primaries can make pressed toggles fail contrast when the reader asks for more contrast.

The page follows the system's light or dark scheme, reduced motion, and contrast preferences. These attributes force them, on `<html>` or on any element:

- `data-theme="light"` or `data-theme="dark"`
- `data-motion="reduce"`
- `data-contrast="more"`

`<html data-scroll-progress>` adds a reading progress bar. Same-origin page navigations cross-fade automatically where the browser supports view transitions.

## Verify

- **Leftovers:** search the templates for `class=` and for the old framework's stylesheet or imports. Anything left should be needed by a script or test.
- **Browser checks.** Load the main pages:
  - in light and dark, using `data-theme` on `<html>` if you can't switch the system setting;
  - at about 1280px wide, where a side nav and rail become columns from 64rem up;
  - at about 375px wide, where everything stacks and navs scroll sideways without making the page scroll sideways.
- **Keyboard:** tab through a page. Focus rings must be visible, and focused elements must never sit under the sticky top bar.
- **Accessibility scan:** if the project has Playwright or another browser test runner, run an axe check (`@axe-core/playwright`) on the changed pages.
