import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { bundleCss, root } from "./css.ts";
import { generate } from "./demo.ts";

await mkdir(join(root, "dist"), { recursive: true });

for (const [file, minify] of [
  ["m.css", false],
  ["m.min.css", true],
] as const) {
  await writeFile(join(root, "dist", file), await bundleCss(minify));
}

await generate();
