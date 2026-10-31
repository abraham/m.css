import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const budget = 8.25 * 1024;
const root = resolve(import.meta.dirname, "..");
const baselineFile = join(root, ".tmp/size-baseline.json");
const usage = `Usage: node scripts/size.ts [--report [--save]]

  (no flags)  Gzip and Brotli sizes of dist/m.min.css; exits 1 if gzip is over ${budget} B.
  --report    Also bundles src/ in memory and prints what each file costs: how much the
              minified, gzip, and Brotli sizes drop without it. Compares against a saved baseline.
  --save      With --report, saves the numbers as the baseline in .tmp/ for later comparisons.`;

const { values } = (() => {
  try {
    return parseArgs({
      options: { report: { type: "boolean" }, save: { type: "boolean" }, help: { type: "boolean", short: "h" } },
    });
  } catch (error) {
    console.error(`${(error as Error).message}\n\n${usage}`);
    process.exit(1);
  }
})();
if (values.help || (values.save && !values.report)) {
  console.log(usage);
  process.exit(values.help ? 0 : 1);
}

interface Sizes {
  min: number;
  gzip: number;
  brotli: number;
}

interface Report {
  commit: string;
  total: Sizes;
  files: Record<string, Sizes>;
}

const measure = (code: Uint8Array): Sizes => ({
  min: code.length,
  gzip: gzipSync(code, { level: 9 }).length,
  brotli: brotliCompressSync(code, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
});

const check = ({ gzip, brotli }: Sizes, label: string) => {
  console.log(`${label}: ${gzip} B gzipped (budget ${budget} B), ${brotli} B Brotli`);
  if (gzip > budget) {
    console.error(`Over budget by ${gzip - budget} B.`);
    process.exitCode = 1;
  }
};

if (!values.report) {
  // The CI size job has only dist/, not node_modules, so this path must not import the bundler.
  check(measure(await readFile(join(root, "dist/m.min.css"))), "dist/m.min.css");
} else {
  const { bundleCss, entry } = await import("./css.ts");
  const total = measure(await bundleCss(true));
  const imports = [...(await readFile(entry, "utf8")).matchAll(/@import "\.\/([^"]+)"/g)].map((match) => match[1]);
  const files: Record<string, Sizes> = {};
  for (const file of imports) {
    const without = measure(await bundleCss(true, join(dirname(entry), file)));
    files[file] = {
      min: total.min - without.min,
      gzip: total.gzip - without.gzip,
      brotli: total.brotli - without.brotli,
    };
  }
  const commit = (() => {
    try {
      const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
      const dirty = execFileSync("git", ["status", "--porcelain", "--", "src"], { cwd: root, encoding: "utf8" }).trim();
      return dirty ? `${head} with uncommitted src changes` : head;
    } catch {
      return "unknown";
    }
  })();
  const report: Report = { commit, total, files };

  let baseline: Report | undefined;
  if (!values.save) {
    try {
      baseline = JSON.parse(await readFile(baselineFile, "utf8"));
    } catch {}
  }

  const cell = (value: number, before?: number) =>
    before === undefined || before === value ? `${value}` : `${value} (${value > before ? "+" : ""}${value - before})`;
  const rows = [
    ["", "minified", "gzip", "Brotli"],
    ["total", ...(["min", "gzip", "brotli"] as const).map((key) => cell(total[key], baseline?.total[key]))],
    ...Object.entries(files)
      .sort(([, a], [, b]) => b.gzip - a.gzip)
      .map(([file, sizes]) => [
        file,
        ...(["min", "gzip", "brotli"] as const).map((key) => cell(sizes[key], baseline?.files[file]?.[key])),
      ]),
  ];
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  for (const row of rows) {
    console.log(
      row.map((text, column) => (column === 0 ? text.padEnd(widths[0]) : text.padStart(widths[column]))).join("  "),
    );
  }
  console.log(
    "\nPer-file numbers are marginal: how much the bundle shrinks without that file. Gzip and Brotli share",
    "context across files, so they don't add up to the total, and can shift by a few bytes on unrelated changes.",
  );

  if (values.save) {
    await mkdir(dirname(baselineFile), { recursive: true });
    await writeFile(baselineFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Saved as the baseline (${commit}). Later --report runs compare against it.`);
  } else if (baseline) {
    console.log(`Changes in parentheses are against the baseline saved at ${baseline.commit}.`);
  } else {
    console.log("No baseline saved yet; add --save to save one.");
  }

  check(total, "src bundle");
}
