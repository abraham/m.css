import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import browserslist from "browserslist";
import { browserslistToTargets, bundle } from "lightningcss";
import { generate } from "./demo.ts";

const root = resolve(import.meta.dirname, "..");
// The Rust browserslist bundled with Lightning CSS misresolves Safari queries, so resolve them in JS.
const targets = browserslistToTargets(browserslist(undefined, { path: root }));

await mkdir(join(root, "dist"), { recursive: true });

for (const [file, minify] of [
  ["m.css", false],
  ["m.min.css", true],
] as const) {
  const { code } = bundle({ filename: join(root, "src/index.css"), minify, targets });
  await writeFile(join(root, "dist", file), code);
}

await generate();
