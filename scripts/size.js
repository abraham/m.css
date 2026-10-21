import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const budget = 8 * 1024;
const file = join(resolve(import.meta.dirname, ".."), "dist/m.min.css");
const size = gzipSync(await readFile(file), { level: 9 }).length;

console.log(`dist/m.min.css: ${size} B gzipped (budget ${budget} B)`);
if (size > budget) {
  console.error(`Over budget by ${size - budget} B.`);
  process.exitCode = 1;
}
