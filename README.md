# m.css

A clean, modern classless CSS framework. Add one stylesheet to semantic HTML and get a polished page with no classes.

[Demo](https://abraham.github.io/m.css/)

- Styles plain HTML elements: typography, lists, tables, forms, buttons, `details`, `dialog`, popovers, progress, and more.
- Follows the system light/dark preference, with a manual override.
- Respects `prefers-reduced-motion`, with a manual override.
- Lays out sticky top bars, side navs, and rails from plain markup.
- Customize it with a handful of CSS custom properties.
- Everything sits in a cascade layer with zero specificity, so your own CSS always wins without `!important`.

## Install

From a CDN:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@abraham/m.css/dist/m.min.css" />
```

Or from npm, imported through a bundler that resolves package paths:

```sh
npm install @abraham/m.css
```

```css
@import "@abraham/m.css"; /* dist/m.css */
@import "@abraham/m.css/min"; /* dist/m.min.css */
```

m.css is meant to be the page's only stylesheet, and it owns the document layout.

## Customize

Set any of these on `:root`, or on any element to scope them to that part of the page.

| Property         | Default                                   | Purpose                                                           |
| ---------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| `--m-primary`    | `oklch(55% 0.19 40)` (orange)             | Accent for links, buttons, focus rings, checkboxes, and progress  |
| `--m-on-primary` | `contrast-color()` of the primary         | Text color on primary backgrounds; unset by default               |
| `--m-density`    | `1`                                       | Spacing multiplier, such as `0.75` for compact or `1.25` for airy |
| `--m-radius`     | `0.5rem`                                  | Corner radius for controls and cards                              |
| `--m-font-sans`  | `system-ui, sans-serif`                   | Body and UI font                                                  |
| `--m-font-mono`  | `ui-monospace, SFMono-Regular, monospace` | Code font                                                         |
| `--m-font-size`  | `1rem`                                    | Base text size; the type scale derives from it                    |
| `--m-measure`    | `100ch`                                   | Width of the content column                                       |

```css
:root {
  --m-primary: oklch(60% 0.18 150);
  --m-density: 0.875;
  --m-radius: 0.25rem;
}
```

Hover, subtle, and dark-mode variants of the primary color are derived automatically.

## Attributes

| Attribute                          | Where                 | Effect                                                   |
| ---------------------------------- | --------------------- | -------------------------------------------------------- |
| `data-theme="light"` or `"dark"`   | `html` or any element | Forces a color scheme instead of following the system    |
| `data-motion="reduce"`             | `html` or any element | Turns animations off, like `prefers-reduced-motion`      |
| `data-scroll-progress`             | `html`                | Shows a reading progress bar at the top of the window    |
| `aria-busy="true"`                 | Any element           | Shows an inline loading spinner                          |
| `aria-current="page"`              | A link in a `nav`     | Marks the current page                                   |
| `role="switch"`                    | A checkbox            | Renders it as a toggle switch                            |
| `role="button"`                    | A link                | Styles it as a button; `aria-disabled="true"` dims it    |
| `role="group"`                     | A wrapper             | Joins buttons, or a field and a button, into one control |
| `aria-invalid="true"` or `"false"` | A form field          | Red (invalid) or green (valid) border and helper text    |

A `small` right after a form field is styled as helper text. Connect it with `aria-describedby` so screen readers announce it:

```html
<label>
  Username
  <input name="username" aria-invalid="true" aria-describedby="username-help" />
  <small id="username-help">That username is already taken.</small>
</label>
```

## Layout

The markup picks the layout:

```html
<body>
  <header>
    <nav><!-- Sticky top bar --></nav>
    <h1>Title</h1>
  </header>
  <nav><!-- Side nav --></nav>
  <main>…</main>
  <aside><!-- Rail, such as "On this page" --></aside>
  <footer>…</footer>
</body>
```

- A `nav` directly inside `body > header` becomes a full-width bar that sticks for the whole page, while the rest of the header scrolls away. To keep a header nav from sticking, nest it one level deeper.
- A `nav` or `aside` directly inside `body` becomes a column beside `main` on wide screens. Both stick below the top bar, and a side nav taller than the window scrolls on its own. On narrow screens everything stacks, and navs become rows that scroll sideways.
- Anchor links, focused elements, and sticky table headers stop below the top bar.

## Browser support

The two most recent major versions of Chrome, Edge, Firefox, and Safari (desktop and iOS). A few enhancements only run where supported, and other browsers get the static version:

- Smooth `details` expand and collapse (`interpolate-size`)
- Cross-fades between pages (`@view-transition`)
- A styled `select` picker (`appearance: base-select`)
- The scroll progress bar (`animation-timeline: scroll()`)
- Hiding the top bar while scrolling down (`scroll-state()` container queries)

## Accessibility

Colors meet WCAG AA in both schemes, focus rings are always visible, and forced-colors mode redraws custom controls in system colors. A few things are up to your markup:

- Give a horizontally scrolling `pre` a `tabindex="0"` so keyboard users can scroll it.
- Label navigation landmarks, for example `<nav aria-label="Docs">`, when a page has more than one.

## Development

Requires Node 26, which runs the TypeScript tooling directly.

```sh
npm install
npm start               # builds, rebuilds on change, and serves the demo at http://localhost:8080/demo/
npm run build           # writes dist/m.css and dist/m.min.css
npm run lint            # Stylelint, including the no-classes rule
npm run typecheck
npm run format          # Prettier
npm run size            # fails if dist/m.min.css is over 8 KB gzipped
npm test                # motion, layout, and accessibility tests in Chromium and WebKit
npm run test:visual     # screenshot tests in the Playwright Docker image; add -- --update-snapshots to rewrite them
```

## License

[MIT](LICENSE)
