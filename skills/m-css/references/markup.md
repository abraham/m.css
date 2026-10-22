# m.css markup reference

What m.css styles, and the markup that produces each pattern. Everything here works without classes. Live versions of every pattern: https://abraham.github.io/m.css/demo/components/typography.html

## Converting class-based markup

| Class-based pattern                        | m.css markup                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `.container`, `.wrapper`                   | Nothing. `body` is already a centered column; set `--m-measure` to change its width.   |
| `.navbar` with brand and links             | `body > header > nav` with two `ul`s: brand first, links second                        |
| `.sidebar`, `.toc`                         | `body > nav` (side nav) or `body > aside` (rail), next to `main`                       |
| `.btn`, `.btn-primary`                     | `button`, or `a role="button"` for a link                                              |
| `.btn-secondary` on Cancel or Reset        | `button type="reset"`, or a button with `formnovalidate`                               |
| `.btn-group`, `.input-group`               | `<span role="group" aria-label="…">` around the buttons or the field and its button    |
| `.active` in a nav or menu                 | `aria-current="page"` on the link                                                      |
| Toggle or segmented control                | `button aria-pressed="true"` or `"false"`, in a `role="group"` for a segmented control |
| `.card` with `.card-header`/`.card-footer` | `article` with `header` and `footer` children                                          |
| `.row` of cards, `.grid`                   | A `div` that contains only `article`s                                                  |
| `.form-group`, `.form-control`             | `label` wrapping the text and the field                                                |
| `.form-text`, `.help-block`                | `small` right after the field, linked with `aria-describedby`                          |
| `.is-invalid`, `.is-valid`                 | `aria-invalid="true"` or `"false"`                                                     |
| `.form-switch`, `.toggle`                  | `input type="checkbox" role="switch"`                                                  |
| `.alert`, `.callout`, `.note`              | `aside` inside `main`                                                                  |
| `.breadcrumb`                              | `nav aria-label="Breadcrumb"` containing an `ol`                                       |
| `.modal`                                   | `dialog`, opened with `showModal()`                                                    |
| `.dropdown-menu`                           | `menu popover` toggled by a `popovertarget` button                                     |
| `.spinner`, `.loading`                     | `aria-busy="true"` on the element that's loading                                       |
| `.lead`, `.subtitle`, `.eyebrow`           | `p` after or before the heading, inside `hgroup`                                       |
| `.table-responsive`                        | Wrap the `table` in a `figure`                                                         |
| `.sr-only` labels                          | `aria-label` on the control, or a visible `label`                                      |

There's no utility layer: no spacing, color, or flex classes. Spacing comes from the elements themselves, so drop wrapper `div`s that only existed to add spacing.

## Page shell

```html
<body>
  <header>
    <nav aria-label="Site">
      <ul>
        <li><strong>Brand</strong></li>
      </ul>
      <ul>
        <li><a href="/" aria-current="page">Home</a></li>
        <li><a href="/docs/">Docs</a></li>
      </ul>
    </nav>
    <nav aria-label="Docs sections"><!-- Optional subnav, sticks below the top bar --></nav>
    <h1>Page title</h1>
    <p>Optional intro.</p>
  </header>
  <nav aria-label="Docs"><!-- Optional side nav --></nav>
  <main>…</main>
  <aside aria-label="On this page"><!-- Optional rail --></aside>
  <footer><p>…</p></footer>
</body>
```

- The first `nav` in `body > header` is a full-width sticky top bar that stays one line tall. Its lists scroll sideways rather than wrap, so keep the links short.
- A second `nav` right after it is a sticky subnav.
- `body > nav` and `body > aside` become columns beside `main` from 64rem up, and stick below the bars. Below that, everything stacks.
- In a side nav, an `li` can hold a group label as text and a nested `ul`.
- A `nav` with two lists outside the header splits them to either end too, for an account bar inside the page.
- A `nav` whose list is an `ol` is a breadcrumb trail. Mark the last link `aria-current="page"`.
- `aria-current="page"` marks the current page. `aria-current="true"` marks the current section, such as a parent link.
- Anchor targets, focused elements, and sticky table headers clear the sticky bars automatically.

## Text

- `h1` to `h6`. The top three levels scale with the window. A link inside a heading keeps the heading's color.
- `hgroup`: a `p` before the heading is an eyebrow, and a `p` after it is a muted subtitle.

  ```html
  <hgroup>
    <p>Pricing</p>
    <h1>Plans that grow with your team</h1>
    <p>Start free and upgrade when you need more.</p>
  </hgroup>
  ```

- Text-level elements: `strong`, `em`, `small`, `mark`, `abbr title`, `sub`, `sup`, `del`, `ins`, `q`, `cite`, `kbd`, `samp`, `var`, `code`, `time`, `data`. Numbers in `time` and `data` line up.
- `ul`, `ol`, and `dl` lists nest. `menu` outside a popover is a row of commands.
- Quotes: a `blockquote` gets an accent border. A `footer` inside it is an attribution with an em dash. A `figure` with a `blockquote` and a `figcaption` also works.
- Code: `<pre tabindex="0"><code>…</code></pre>` scrolls sideways. The `tabindex` lets keyboard users scroll it.

## Links and buttons

```html
<button>Save</button>
<button type="reset">Reset</button>
<a href="/signup" role="button">Sign up</a>
<a href="/signup" role="button" aria-disabled="true">Sign up</a>
<span role="group" aria-label="View">
  <button type="button" aria-pressed="true">List</button>
  <button type="button" aria-pressed="false">Grid</button>
</span>
<button aria-busy="true">Saving</button>
```

- Buttons are solid primary. `type="reset"` and `formnovalidate` buttons are outlined secondary buttons, such as a form's Cancel. There are no other variants.
- Adjacent buttons get a gap. Buttons right after form fields get space above them.
- Toggles update `aria-pressed` from script. In a segmented control, exactly one is `"true"`.

## Forms

```html
<form>
  <label>
    Email
    <input type="email" name="email" autocomplete="email" required aria-describedby="email-help" />
    <small id="email-help">We'll never share it.</small>
  </label>
  <label>
    Plan
    <select name="plan">
      <option>Free</option>
      <option>Team</option>
    </select>
  </label>
  <fieldset>
    <legend>Notifications</legend>
    <label><input type="checkbox" name="news" role="switch" checked /> Product news</label>
    <label><input type="radio" name="frequency" value="daily" checked /> Daily</label>
    <label><input type="radio" name="frequency" value="weekly" /> Weekly</label>
  </fieldset>
  <button>Save</button>
</form>
```

- Text-like inputs, `select`, and `textarea` fill the width. Either wrap the field in its `label`, or put `label for` right before it.
- Validation: a field turns red after the user leaves it invalid (`:user-invalid`), or whenever it has `aria-invalid="true"`. `aria-invalid="false"` marks it valid in green. A `small` right after the field takes the same color.
- A `small` right after a `fieldset` is helper text for the group. Point the fieldset at it with `aria-describedby`.
- `readonly` fields look fixed. A `disabled` field or `fieldset` mutes its labels.
- Range, color, and file inputs are styled. A single `select` gets a styled picker where the browser supports it.
- Search, with or without the inner `form`:

  ```html
  <search>
    <form action="/search">
      <input type="search" name="q" aria-label="Search" />
      <button>Search</button>
    </form>
  </search>
  ```

## Content

- **Cards:** every `article` is a card, except a lone `article` that is `main`'s only child, which stays plain long-form text. A `header` or `footer` as the card's first or last child is a full-width band.
- **Card grid:** a `div` or `section` that contains only `article`s (two or more) becomes an auto-fitting grid of equal-height cards, with footers aligned at the bottom. Any other child, such as a heading, turns the grid off, so put headings outside the container.

  ```html
  <h2>Plans</h2>
  <div>
    <article>
      <header><h3>Starter</h3></header>
      <p>For personal projects.</p>
      <footer><a href="/signup" role="button">Start free</a></footer>
    </article>
    <article>…</article>
  </div>
  ```

- **Tables:** row rules, a sticky header row, and tabular numbers. Give the table a `caption` and give header cells `scope`. Wrap a wide table in a `figure` to scroll it sideways.
- **Media:** `img` and `video` scale to the column. Set `width`, `height`, and `alt`, and use `figure` with `figcaption` for captions.
- **Details:** `details` with a `summary`. It animates open where `interpolate-size` is supported.
- **Callouts:** an `aside` inside `main` (not a direct child of `body`) is a callout on a raised surface. `hr` and `address` are styled too.

## Overlays

```html
<button type="button" popovertarget="actions">Actions</button>
<menu id="actions" popover>
  <li><a href="/edit">Edit</a></li>
  <li><button type="button">Duplicate</button></li>
  <li><button type="button" disabled>Archive</button></li>
</menu>

<button type="button" popovertarget="tip">More info</button>
<div id="tip" popover><p>Popover content.</p></div>

<dialog id="confirm" aria-labelledby="confirm-title">
  <h2 id="confirm-title">Delete this project?</h2>
  <p>This can't be undone.</p>
  <form method="dialog">
    <button value="cancel" autofocus>Cancel</button>
    <button value="delete">Delete</button>
  </form>
</dialog>
```

- A popover that is a list, or holds one, is a menu. It's anchored below its button and flips when there isn't room. Popovers need no script.
- Open a `dialog` with `dialog.showModal()` from script. The page behind it doesn't scroll, and `form method="dialog"` closes it.

## Feedback

```html
<label>Upload <progress value="40" max="100">40%</progress></label>
<progress>Loading…</progress>
<meter value="0.7" low="0.5" high="0.8" optimum="0.2">70%</meter>
<p aria-busy="true">Loading results</p>
```

A `progress` without a value is indeterminate. Under reduced motion, loading animations pulse instead of sliding.
