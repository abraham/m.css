import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bundleCss, root } from "./css.ts";
import { generate } from "./demo.ts";

await mkdir(join(root, "dist"), { recursive: true });
// The demo links its own copy so the folder deploys as the site root on its own.
await mkdir(join(root, "demo/dist"), { recursive: true });

for (const [file, minify] of [
  ["m.css", false],
  ["m.min.css", true],
] as const) {
  await writeFile(join(root, "dist", file), await bundleCss(minify));
}
await copyFile(join(root, "dist/m.css"), join(root, "demo/dist/m.css"));

await generate();
