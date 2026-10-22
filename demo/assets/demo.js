// @ts-check
// Loaded as a classic script in <head>, so saved settings apply to <html> before the first paint.

const STORAGE_KEY = "m-demo-settings";
const root = document.documentElement;

/** Attribute settings: stored value → attribute value on <html>. */
const attributes = {
  theme: { name: "data-theme", values: { light: "light", dark: "dark" } },
  motion: { name: "data-motion", values: { reduce: "reduce" } },
  contrast: { name: "data-contrast", values: { more: "more" } },
  progress: { name: "data-scroll-progress", values: { on: "" } },
  dir: { name: "dir", values: { rtl: "rtl" } },
};

const fonts = {
  serif: "ui-serif, Georgia, serif",
  rounded: "ui-rounded, system-ui, sans-serif",
  mono: "ui-monospace, SFMono-Regular, monospace",
};

/** Numeric custom-property settings, clamped to their range. */
const ranges = {
  density: { name: "--m-density", label: "Density", min: 0.75, max: 1.5, step: 0.05, unit: "", initial: 1 },
  radius: { name: "--m-radius", label: "Radius", min: 0, max: 1, step: 0.125, unit: "rem", initial: 0.5 },
  fontSize: { name: "--m-font-size", label: "Font size", min: 0.875, max: 1.25, step: 0.0625, unit: "rem", initial: 1 },
  measure: { name: "--m-measure", label: "Measure", min: 60, max: 120, step: 5, unit: "ch", initial: 100 },
};

/** @typedef {Record<string, string>} State */

/**
 * Drops anything that isn't a known setting with an allowed value, so URLs and storage can't inject styles.
 * @param {Record<string, unknown>} raw
 * @returns {State}
 */
function sanitize(raw) {
  /** @type {State} */
  const state = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;
    if (key in attributes && value in attributes[/** @type {keyof typeof attributes} */ (key)].values) {
      state[key] = value;
    } else if (key in ranges) {
      const { min, max } = ranges[/** @type {keyof typeof ranges} */ (key)];
      const number = Number(value);
      if (Number.isFinite(number)) state[key] = String(Math.min(max, Math.max(min, number)));
    } else if (key === "primary" && /^#[0-9a-f]{6}$/i.test(value)) {
      state[key] = value.toLowerCase();
    } else if (key === "font" && value in fonts) {
      state[key] = value;
    }
  }
  return state;
}

/** @returns {State} URL parameters if any are present (saved, so they follow navigation), otherwise the saved settings. */
function load() {
  const params = sanitize(Object.fromEntries(new URLSearchParams(location.search)));
  try {
    if (Object.keys(params).length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
      return params;
    }
    return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"));
  } catch {
    return params;
  }
}

/** @param {State} state */
function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode, file://); the settings still apply to this page.
  }
  const url = new URL(location.href);
  url.search = new URLSearchParams(state).toString();
  history.replaceState(history.state, "", url);
}

/** @param {State} state */
function apply(state) {
  for (const [key, { name, values }] of Object.entries(attributes)) {
    const value = state[key];
    if (value === undefined) root.removeAttribute(name);
    else root.setAttribute(name, values[/** @type {keyof typeof values} */ (value)]);
  }
  for (const [key, { name, unit }] of Object.entries(ranges)) {
    if (state[key] === undefined) root.style.removeProperty(name);
    else root.style.setProperty(name, `${state[key]}${unit}`);
  }
  if (state.primary) root.style.setProperty("--m-primary", state.primary);
  else root.style.removeProperty("--m-primary");
  if (state.font) root.style.setProperty("--m-font-sans", fonts[/** @type {keyof typeof fonts} */ (state.font)]);
  else root.style.removeProperty("--m-font-sans");
  document.dispatchEvent(new CustomEvent("demo:settings"));
}

/**
 * The CSS and root attributes that reproduce the current settings.
 * @param {State} state
 */
function snippet(state) {
  const declarations = [];
  if (state.primary) declarations.push(`  --m-primary: ${state.primary};`);
  for (const [key, { name, unit }] of Object.entries(ranges)) {
    if (state[key] !== undefined) declarations.push(`  ${name}: ${state[key]}${unit};`);
  }
  if (state.font) declarations.push(`  --m-font-sans: ${fonts[/** @type {keyof typeof fonts} */ (state.font)]};`);
  const html = Object.entries(attributes)
    .filter(([key]) => state[key] !== undefined)
    .map(([key, { name, values }]) => {
      const value = values[/** @type {keyof typeof values} */ (state[key])];
      return value === "" ? name : `${name}="${value}"`;
    });
  const parts = [
    declarations.length > 0 ? `:root {\n${declarations.join("\n")}\n}` : "/* The defaults: nothing to add. */",
  ];
  if (html.length > 0) parts.push(`<html ${html.join(" ")}>`);
  return parts.join("\n\n");
}

let state = load();
apply(state);

const settingsMarkup = `
  <h2 id="demo-settings-title">Demo settings</h2>
  <form>
    <label>
      Theme
      <select name="theme">
        <option value="">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
    <label>
      Primary
      <input name="primary" type="color" value="#c2410c" list="demo-primaries" />
    </label>
    <datalist id="demo-primaries">
      <option value="#c2410c"></option>
      <option value="#2563eb"></option>
      <option value="#15803d"></option>
      <option value="#7c3aed"></option>
      <option value="#db2777"></option>
    </datalist>
    ${Object.entries(ranges)
      .map(
        ([key, { label, min, max, step, initial }]) => `
    <label>
      ${label}
      <output name="${key}-value"></output>
      <input name="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${initial}" />
    </label>`,
      )
      .join("")}
    <label>
      Font
      <select name="font">
        <option value="">System sans</option>
        <option value="serif">Serif</option>
        <option value="rounded">Rounded</option>
        <option value="mono">Monospace</option>
      </select>
    </label>
    <fieldset>
      <legend>Preferences</legend>
      <label><input name="motion" type="checkbox" role="switch" value="reduce" /> Reduce motion</label>
      <label><input name="contrast" type="checkbox" role="switch" value="more" /> More contrast</label>
      <label><input name="progress" type="checkbox" role="switch" value="on" /> Scroll progress</label>
      <label><input name="dir" type="checkbox" role="switch" value="rtl" /> Right to left</label>
    </fieldset>
    <h3>Your setup</h3>
    <pre tabindex="0"><code data-demo-snippet></code></pre>
    <p>
      <button type="button" data-demo-copy>Copy</button>
      <button type="reset">Reset</button>
    </p>
  </form>
`;

/** Builds the settings popover and its top-bar button, and keeps both in sync with the state. */
function setUpSettings() {
  const list = document.querySelector("body > header > nav:first-of-type > :is(ul, ol, menu):last-of-type");
  if (!list) return;

  const popover = document.createElement("div");
  popover.id = "demo-settings";
  popover.popover = "auto";
  popover.dataset.demoSettings = "";
  popover.setAttribute("aria-labelledby", "demo-settings-title");
  popover.innerHTML = settingsMarkup;
  document.body.append(popover);

  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.demoSettingsButton = "";
  button.setAttribute("popovertarget", popover.id);
  button.textContent = "Settings";
  item.append(button);
  list.append(item);

  const form = /** @type {HTMLFormElement} */ (popover.querySelector("form"));
  const code = /** @type {HTMLElement} */ (popover.querySelector("[data-demo-snippet]"));

  const fill = () => {
    for (const element of form.elements) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement)) continue;
      const value = state[element.name];
      if (element instanceof HTMLInputElement && element.type === "checkbox") element.checked = value !== undefined;
      else if (value !== undefined) element.value = value;
      else if (element instanceof HTMLInputElement && element.name in ranges) {
        element.value = String(ranges[/** @type {keyof typeof ranges} */ (element.name)].initial);
      } else if (element instanceof HTMLInputElement && element.type === "color") element.value = "#c2410c";
      else element.value = "";
    }
    for (const [key, { unit }] of Object.entries(ranges)) {
      const output = /** @type {HTMLOutputElement} */ (form.elements.namedItem(`${key}-value`));
      const input = /** @type {HTMLInputElement} */ (form.elements.namedItem(key));
      output.value = `${input.value}${unit}`;
    }
    code.textContent = snippet(state);
  };

  form.addEventListener("input", ({ target }) => {
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const next = { ...state };
    const empty =
      target instanceof HTMLInputElement && target.type === "checkbox" ? !target.checked : target.value === "";
    if (empty) delete next[target.name];
    else next[target.name] = target.value;
    state = sanitize(next);
    apply(state);
    save(state);
    fill();
  });

  form.addEventListener("reset", (event) => {
    event.preventDefault();
    state = {};
    apply(state);
    save(state);
    fill();
  });

  popover.querySelector("[data-demo-copy]")?.addEventListener("click", () => {
    navigator.clipboard?.writeText(snippet(state));
  });

  fill();
}

/** Page behaviors the kitchen sink used to inline: they only act on elements that opt in. */
function setUpExamples() {
  for (const checkbox of document.querySelectorAll("input[data-indeterminate]")) {
    /** @type {HTMLInputElement} */ (checkbox).indeterminate = true;
  }

  for (const group of document.querySelectorAll('[role="group"]:not([data-example-states]):has(> [aria-pressed])')) {
    group.addEventListener("click", ({ target }) => {
      const pressed = target instanceof Element ? target.closest("[aria-pressed]") : null;
      if (!pressed) return;
      for (const button of group.querySelectorAll("[aria-pressed]")) {
        button.setAttribute("aria-pressed", String(button === pressed));
      }
    });
  }

  for (const button of document.querySelectorAll("[data-show-modal]")) {
    const dialog = document.getElementById(button.getAttribute("data-show-modal") ?? "");
    if (dialog instanceof HTMLDialogElement) button.addEventListener("click", () => dialog.showModal());
  }

  const readout = document.querySelector("output[data-motion-readout]");
  if (readout instanceof HTMLOutputElement) {
    const show = () => {
      const style = getComputedStyle(root);
      readout.value = ["--_m-duration", "--_m-duration-slow", "--_m-scroll-behavior"]
        .map((name) => `${name}: ${style.getPropertyValue(name)}`)
        .join(", ");
    };
    document.addEventListener("demo:settings", show);
    matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", show);
    show();
  }

  for (const panel of document.querySelectorAll("[data-token-panel]")) renderTokens(panel);
}

const tokenGroups = {
  Colors: [
    "surface",
    "surface-raised",
    "surface-overlay",
    "border",
    "control-border",
    "text",
    "text-muted",
    "tint",
    "danger",
    "primary",
    "primary-hover",
    "primary-subtle",
    "on-primary",
  ],
  Spacing: ["space-1", "space-2", "space-3", "space-4", "space-6", "space-8", "space-12"],
  Type: [
    "text-sm",
    "text-base",
    "text-lg",
    "text-xl",
    "text-2xl",
    "text-3xl",
    "text-4xl",
    "text-h1",
    "text-h2",
    "text-h3",
  ],
};

/**
 * @param {string} group
 * @param {string} token
 */
function sample(group, token) {
  const element = document.createElement("span");
  if (group === "Colors") {
    element.dataset.swatch = "";
    element.style.setProperty("--swatch", `var(--_m-${token})`);
    if (token === "on-primary") {
      element.style.setProperty("--swatch", "var(--_m-primary)");
      element.style.color = "var(--_m-on-primary)";
      element.textContent = "Aa";
    }
  } else if (group === "Spacing") {
    element.dataset.bar = "";
    element.style.setProperty("--bar", `var(--_m-${token})`);
  } else {
    element.style.fontSize = `var(--_m-${token})`;
    element.style.lineHeight = "var(--_m-leading-tight)";
    element.textContent = "Aa";
  }
  return element;
}

/** @param {Element} panel */
function renderTokens(panel) {
  for (const [group, tokens] of Object.entries(tokenGroups)) {
    const block = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = group;
    const list = document.createElement("dl");
    for (const token of tokens) {
      const term = document.createElement("dt");
      const code = document.createElement("code");
      code.textContent = `--_m-${token}`;
      term.append(code);
      const detail = document.createElement("dd");
      detail.append(sample(group, token));
      list.append(term, detail);
    }
    block.append(title, list);
    panel.append(block);
  }
}

/** Demo hooks that aren't part of the markup a user would copy. */
const demoAttributes = ["data-indeterminate"];

/**
 * States an example can toggle. `self` states go on the figure; the rest on its matching controls.
 * @type {Record<string, { label: string, attribute: string, value: string, targets?: string, excludes?: string }>}
 */
const exampleStates = {
  disabled: {
    label: "Disabled",
    attribute: "disabled",
    value: "",
    targets: "input, select, textarea, button, fieldset",
  },
  readonly: {
    label: "Read-only",
    attribute: "readonly",
    value: "",
    targets: 'textarea, input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"])',
  },
  invalid: {
    label: "Invalid",
    attribute: "aria-invalid",
    value: "true",
    targets: "input, select, textarea",
    excludes: "valid",
  },
  valid: {
    label: "Valid",
    attribute: "aria-invalid",
    value: "false",
    targets: "input, select, textarea",
    excludes: "invalid",
  },
  busy: { label: "Busy", attribute: "aria-busy", value: "true", targets: "button" },
  rtl: { label: "Right to left", attribute: "dir", value: "rtl" },
  dark: { label: "Dark", attribute: "data-theme", value: "dark" },
  contrast: { label: "More contrast", attribute: "data-contrast", value: "more" },
};

/**
 * The example's markup as a user would write it: demo hooks removed, `=""` dropped, and the shared indent trimmed.
 * @param {Element} figure
 */
function exampleMarkup(figure) {
  const clone = /** @type {Element} */ (figure.cloneNode(true));
  for (const name of demoAttributes) {
    for (const element of clone.querySelectorAll(`[${name}]`)) element.removeAttribute(name);
  }
  const lines = clone.innerHTML.replace(/(\s[\w:-]+)=""/g, "$1").split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines.at(-1)?.trim() === "") lines.pop();
  const indent = Math.min(...lines.filter((line) => line.trim()).map((line) => line.search(/\S/)));
  const ancestor = ["dir", "data-theme", "data-contrast"]
    .filter((name) => figure.hasAttribute(name))
    .map((name) => `${name}="${figure.getAttribute(name)}"`);
  const body = lines.map((line) => line.slice(indent)).join("\n");
  return ancestor.length > 0 ? `<!-- On a containing element: ${ancestor.join(" ")} -->\n${body}` : body;
}

/**
 * Adds state toggles and a support badge before an example, and its markup after it.
 * @param {Element} figure
 */
function setUpExampleFigure(figure) {
  const names = (figure.getAttribute("data-states") ?? "").split(/\s+/).filter((name) => name in exampleStates);
  const code = document.createElement("code");

  /** Original values of every attribute a toggle can change, so turning a state off restores the markup. */
  const originals = new Map();
  /** @param {string} name */
  const targetsOf = (name) => {
    const { targets } = exampleStates[name];
    return targets ? [...figure.querySelectorAll(targets)] : [figure];
  };
  for (const name of names) {
    for (const element of targetsOf(name)) {
      const key = exampleStates[name].attribute;
      const saved = originals.get(element) ?? {};
      if (!(key in saved)) saved[key] = element.getAttribute(key);
      originals.set(element, saved);
    }
  }

  /** @type {Set<string>} */
  const pressed = new Set();
  const render = () => {
    for (const [element, attributes] of originals) {
      for (const [key, value] of Object.entries(attributes)) {
        if (value === null) element.removeAttribute(key);
        else element.setAttribute(key, value);
      }
    }
    for (const name of names) {
      if (!pressed.has(name)) continue;
      const { attribute, value } = exampleStates[name];
      for (const element of targetsOf(name)) element.setAttribute(attribute, value);
    }
    code.textContent = exampleMarkup(figure);
  };

  const toolbar = document.createElement("p");
  if (names.length > 0) {
    const group = document.createElement("span");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", "Example states");
    group.dataset.exampleStates = "";
    for (const name of names) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = exampleStates[name].label;
      button.setAttribute("aria-pressed", "false");
      button.dataset.state = name;
      button.addEventListener("click", () => {
        if (pressed.has(name)) pressed.delete(name);
        else {
          pressed.add(name);
          const { excludes } = exampleStates[name];
          if (excludes) pressed.delete(excludes);
        }
        for (const other of group.querySelectorAll("button")) {
          other.setAttribute(
            "aria-pressed",
            String(pressed.has(/** @type {HTMLElement} */ (other).dataset.state ?? "")),
          );
        }
        render();
      });
      group.append(button);
    }
    toolbar.append(group);
  }

  const requires = figure.getAttribute("data-requires");
  if (requires) {
    const badge = document.createElement("small");
    badge.dataset.support = CSS.supports(`(${requires})`) ? "yes" : "no";
    badge.textContent = CSS.supports(`(${requires})`)
      ? `Uses ${requires}, which this browser supports.`
      : `Uses ${requires}, which this browser doesn't support yet, so it falls back.`;
    toolbar.append(" ", badge);
  }
  if (toolbar.childNodes.length > 0) figure.before(toolbar);

  const details = document.createElement("details");
  details.dataset.exampleCode = "";
  const summary = document.createElement("summary");
  summary.textContent = "HTML";
  const pre = document.createElement("pre");
  pre.tabIndex = 0;
  pre.append(code);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => navigator.clipboard?.writeText(code.textContent ?? ""));
  const actions = document.createElement("p");
  actions.append(copy);
  details.append(summary, pre, actions);
  figure.after(details);

  render();
}

document.addEventListener("DOMContentLoaded", () => {
  setUpSettings();
  setUpExamples();
  for (const figure of document.querySelectorAll("figure[data-example]")) setUpExampleFigure(figure);
});
