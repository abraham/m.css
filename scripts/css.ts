import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import browserslist from "browserslist";
import { browserslistToTargets, bundleAsync } from "lightningcss";

export const root = resolve(import.meta.dirname, "..");
export const entry = join(root, "src/index.css");

// The Rust browserslist bundled with Lightning CSS misresolves Safari queries, so resolve them in JS.
const targets = browserslistToTargets(browserslist(undefined, { path: root }));

/** Bundles `src/index.css`; `omit` (an absolute path) reads one imported file as empty, to measure what it costs. */
export async function bundleCss(minify: boolean, omit?: string) {
  const { code } = await bundleAsync({
    filename: entry,
    minify,
    targets,
    // Lightning CSS passes unnormalized paths, such as src/./base/reset.css.
    resolver: { read: (file) => (resolve(file) === omit ? "" : readFile(file, "utf8")) },
  });
  return code;
}
