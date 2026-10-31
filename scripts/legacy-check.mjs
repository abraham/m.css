// Runs inside an old Playwright Docker image, whose Node can't run TypeScript: plain JS only.
import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const demo = join(root, "demo");
const playwright = await import(process.env.PLAYWRIGHT_CORE ?? "playwright-core");
const lib = playwright.default ?? playwright;
const { chromium, firefox, webkit } = lib;
/** @type {string[]} */
const pages = JSON.parse(process.env.LEGACY_PAGES ?? '["/"]');
const out = join(root, "test-results/legacy", process.env.LEGACY_LABEL ?? "local");
const axe = await readFile(join(root, "node_modules/axe-core/axe.min.js"), "utf8");

/** @type {Record<string, string>} */
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };
const server = createServer(async (request, response) => {
  let path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = join(demo, path);
  try {
    if (!file.startsWith(demo)) throw new Error("outside demo/");
    const body = await readFile(file);
    response.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((done) => server.listen(0, () => done(undefined)));
const address = server.address();
const origin = `http://localhost:${typeof address === "object" && address ? address.port : 0}`;

// Snapshot mode: one stable screenshot of the first page in the first engine, for a visual baseline.
const snapshot = process.env.LEGACY_SNAPSHOT;
if (snapshot) {
  const browser = await lib[process.env.LEGACY_ENGINES ?? "chromium"].launch();
  const page = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 1280, height: 800 } });
  await page.goto(origin + pages[0]);
  await page.addStyleTag({ content: await readFile(join(root, "tests/visual.css"), "utf8") });
  await page.screenshot({ path: snapshot, fullPage: true, animations: "disabled" });
  await browser.close();
  server.close();
  process.exit(0);
}

let failures = 0;
for (const [name, type] of /** @type {const} */ ([
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
]).filter(([name]) => (process.env.LEGACY_ENGINES ?? name).split(" ").includes(name))) {
  const browser = await type.launch();
  console.log(`${name} ${browser.version()}`);
  await mkdir(join(out, name), { recursive: true });
  for (const colorScheme of ["light", "dark"]) {
    for (const path of pages) {
      // A fresh page per URL, so one crashed tab doesn't take the rest of the run with it.
      const page = await browser.newPage({ colorScheme, viewport: { width: 1280, height: 800 } });
      try {
        await page.goto(origin + path);
        const slug = path
          .replace(/\/$/, "/index")
          .replace(/^\//, "")
          .replace(/\.html$/, "")
          .replace(/\//g, "-");
        await page.screenshot({ path: join(out, name, `${slug}-${colorScheme}.png`), fullPage: true });
        await page.addScriptTag({ content: axe });
        /** @type {{ target: string, data: { fgColor?: string, bgColor?: string, contrastRatio?: number } }[]} */
        const nodes = await page.evaluate(async () => {
          // The theming page's token swatches are demo chrome, and axe misreads their inline var() colors in old WebKit.
          // @ts-expect-error axe is injected above.
          const { violations } = await window.axe.run(
            { exclude: [["[data-token-panel]"]] },
            { runOnly: ["color-contrast"] },
          );
          return violations.flatMap((/** @type {any} */ violation) =>
            violation.nodes.map((/** @type {any} */ node) => ({
              target: node.target.join(" "),
              data: node.any[0]?.data ?? {},
            })),
          );
        });
        for (const { target, data } of nodes) {
          failures++;
          console.log(
            `  ${colorScheme} ${path} ${target}: ${data.fgColor} on ${data.bgColor} = ${data.contrastRatio}:1`,
          );
        }
      } catch (error) {
        failures++;
        console.log(`  ${colorScheme} ${path} error: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
      }
      await page.close().catch(() => {});
    }
  }
  await browser.close();
}
server.close();
console.log(failures ? `${failures} contrast failures` : "No contrast failures");
process.exitCode = failures ? 1 : 0;
