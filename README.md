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

## Use with an AI agent

The [`m-css` agent skill](skills/m-css/SKILL.md) teaches coding agents such as GitHub Copilot, Claude Code, and Codex how to add m.css to a site. It covers converting class-based markup to semantic HTML, theming, and checking the result. Install it with the [GitHub CLI](https://cli.github.com/), which asks which agent to set it up for:

```sh
gh skills add abraham/m.css m-css
```

If you installed the package from npm, it's also in `node_modules/@abraham/m.css/skills/m-css` to copy into your agent's skills folder. Then ask your agent something like "Restyle this site with m.css."

## Customize

Set any of these on `:root`. The color, spacing, corner, and code-font properties also work on any element, to scope them to that part of the page. `--m-font-sans`, `--m-font-size`, and `--m-measure` set the page's font, text size, and column width, so set them on `:root`. Try them live on the [Theming page](https://abraham.github.io/m.css/theming.html), and see whole pages themed with nothing else in the [showcase](https://abraham.github.io/m.css/showcase/).

| Property         | Default                                   | Purpose                                                                   |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `--m-primary`    | `oklch(55% 0.19 40)` (orange)             | Accent for links, buttons, focus rings, checkboxes, sliders, and progress |
| `--m-on-primary` | `contrast-color()` of the primary         | Text color on primary backgrounds; unset by default                       |
| `--m-density`    | `1`                                       | Spacing multiplier, such as `0.75` for compact or `1.25` for airy         |
| `--m-radius`     | `0.5rem`                                  | Corner radius for controls and cards                                      |
| `--m-font-sans`  | `system-ui, sans-serif`                   | Body and UI font                                                          |
| `--m-font-mono`  | `ui-monospace, SFMono-Regular, monospace` | Code font                                                                 |
| `--m-font-size`  | `1rem`                                    | Base text size; the type scale derives from it                            |
| `--m-measure`    | `100ch`                                   | Width of the content column                                               |

```css
:root {
  --m-primary: oklch(60% 0.18 150);
  --m-density: 0.875;
  --m-radius: 0.25rem;
}
```

Hover, subtle, and dark-mode variants of the primary color are derived automatically.

## Attributes

| Attribute                          | Where                 | Effect                                                                   |
| ---------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| `data-theme="light"` or `"dark"`   | `html` or any element | Forces a color scheme instead of following the system                    |
| `data-motion="reduce"`             | `html` or any element | Turns animations off, like `prefers-reduced-motion`                      |
| `data-contrast="more"`             | `html` or any element | Raises contrast, like `prefers-contrast: more`                           |
| `data-scroll-progress`             | `html`                | Shows a reading progress bar at the top of the window                    |
| `aria-busy="true"`                 | Any element           | Shows an inline loading spinner; on a container, dims it under one       |
| `aria-current="page"`              | A link in a `nav`     | Marks the current page                                                   |
| `role="switch"`                    | A checkbox            | Renders it as a toggle switch                                            |
| `role="button"`                    | A link                | Styles it as a button; `aria-disabled="true"` dims it                    |
| `role="group"`                     | A wrapper             | Joins buttons, or a field with buttons and `span` text, into one control |
| `aria-pressed="true"` or `"false"` | A button              | A toggle: outlined when off, tinted with a thick primary border when on  |
| `aria-invalid="true"` or `"false"` | A form field          | Red border and warning icon, or green border and check, plus helper text |

A `search` element joins its field and button like `role="group"`, whether they sit in a `form` or directly inside it, and `input type="search"` gets a magnifier icon:

```html
<search>
  <form action="/search">
    <input type="search" name="q" aria-label="Search" />
    <button>Search</button>
  </form>
</search>
```

In a `role="group"` with a field, a `span` is a text box for a prefix or unit. Point the field at it with `aria-describedby`:

```html
<label for="site">Website</label>
<span role="group">
  <span id="site-prefix">https://</span>
  <input id="site" name="site" aria-describedby="site-prefix" />
</span>
```

A popover that is a list, or holds one, is a menu. It opens below the button that toggles it, flips when there isn't room, and closes on Escape or a click outside:

```html
<button popovertarget="actions">Actions</button>
<menu id="actions" popover>
  <li><a href="/edit">Edit</a></li>
  <li><button>Duplicate</button></li>
</menu>
```

A `small` right after a form field is styled as helper text. Connect it with `aria-describedby` so screen readers announce it:

```html
<label>
  Username
  <input name="username" aria-invalid="true" aria-describedby="username-help" />
  <small id="username-help">That username is already taken.</small>
</label>
```

A `small` right after a `fieldset` is helper text for the whole group, and turns red when a control in the group is invalid. `readonly` fields look fixed, labels of disabled controls are muted, and the page behind a modal `dialog` doesn't scroll. Add `closedby="any"` to a `dialog` to close it on a click outside, where supported.

A `meter` fills green in its `optimum` range, amber when suboptimal, and red when even less good. `aria-busy="true"` on a container, such as a `section`, `article`, `form`, list, or `div`, dims its content under a centered spinner; also add `inert` so its controls can't be clicked or tabbed to while it loads.

## Layout

The markup picks the layout, as the pages in the [layouts gallery](https://abraham.github.io/m.css/layouts/) show:

```html
<body>
  <header>
    <nav><!-- Sticky top bar --></nav>
    <nav><!-- Optional sticky subnav --></nav>
    <h1>Title</h1>
  </header>
  <nav><!-- Side nav --></nav>
  <main>…</main>
  <aside><!-- Rail, such as "On this page" --></aside>
  <footer>…</footer>
</body>
```

- A `nav` directly inside `body > header` becomes a full-width bar that sticks for the whole page, while the rest of the header scrolls away. Its content spans the widest layout on every page, so its links stay put whether or not a page has side columns. To keep a header nav from sticking, nest it one level deeper.
- A second `nav` right after the top bar becomes a subnav that sticks below it. When the top bar slides away in Chromium, the subnav moves up into its place.
- A `nav` or `aside` directly inside `body` becomes a column beside `main` on wide screens. Both stick below the top bar, and a side nav taller than the window scrolls on its own. On narrow screens everything stacks, and navs become rows that scroll sideways.
- A `nav` with two lists puts them at opposite ends, such as a brand and links. In the top bar it stays one line.
- A `nav` whose list is an `ol` is a breadcrumb trail. Separators are drawn between items but not read aloud, and the last item is muted.

```html
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/docs/">Docs</a></li>
    <li><a href="/docs/layout/" aria-current="page">Layout</a></li>
  </ol>
</nav>
```

- Anchor links, focused elements, and sticky table headers stop below the top bar.

## Browser support

The two most recent major versions of Chrome, Edge, Firefox, and Safari (desktop and iOS). A few enhancements only run where supported, and other browsers get the static version:

- Smooth `details` expand and collapse (`interpolate-size`)
- Cross-fades between pages (`@view-transition`)
- A styled `select` picker (`appearance: base-select`)
- The scroll progress bar (`animation-timeline: scroll()`)
- Hiding the top bar while scrolling down (`scroll-state()` container queries)

## Accessibility

Colors meet WCAG AA in both schemes, focus rings are always visible, and forced-colors mode redraws custom controls in system colors. When the system asks for more contrast (`prefers-contrast: more`), or an element has `data-contrast="more"`, text reaches WCAG AAA (7:1), borders and underlines turn solid, and focus rings grow to 3px. A few things are up to your markup:

- Give a horizontally scrolling `pre` a `tabindex="0"` so keyboard users can scroll it.
- Label navigation landmarks, for example `<nav aria-label="Docs">`, when a page has more than one.

## Development

Requires Node 26, which runs the TypeScript tooling directly.

```sh
npm install
npm start               # builds, rebuilds on change, and serves the demo at http://localhost:8080/
npm run build           # writes dist/m.css and dist/m.min.css, copies m.css into demo/dist, and generates demo/kitchen-sink.html
npm run lint            # Stylelint, including the no-classes rule
npm run typecheck
npm run format          # Prettier
npm run size            # gzip and Brotli sizes; fails if dist/m.min.css is over 8 KB gzipped
npm run size -- --report  # what each source file costs; add --save to keep a baseline to compare against
npm test                # motion, layout, and accessibility tests in Chromium and WebKit
npm run test:visual     # screenshot tests in the Playwright Docker image; add -- --update-snapshots to rewrite them
```

Demo examples live in `demo/components/*.html`, one `figure[data-example]` each. The kitchen sink is generated from them, so edit the component pages, not `demo/kitchen-sink.html`.

## License

[MIT](LICENSE)
