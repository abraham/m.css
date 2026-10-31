import { expect, test } from "@playwright/test";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { pages } from "../scripts/demo.ts";

const root = new URL("..", import.meta.url).pathname;

/** Runs scripts/legacy-check.mjs in an old Playwright image, whose bundled engines lack newer CSS features. */
async function legacy(version: string, env: Record<string, string> = {}) {
  const minor = Number(version.split(".")[1]);
  const distro = minor < 33 ? "focal" : minor < 46 ? "jammy" : "noble";
  const environment = {
    PLAYWRIGHT_CORE: "/tmp/pw/node_modules/playwright-core/index.js",
    LEGACY_PAGES: JSON.stringify(pages),
    LEGACY_LABEL: version,
    ...env,
  };
  // A crashing old browser would otherwise leave a core dump in the mounted repo.
  const command = `ulimit -c 0 && npm install --silent --no-save --no-audit --no-fund --prefix /tmp/pw playwright-core@${version} && node scripts/legacy-check.mjs`;
  try {
    const { stdout } = await promisify(execFile)(
      "docker",
      [
        ...["run", "--rm", "--ipc=host", "-v", `${root}:/work`, "-w", "/work"],
        ...Object.entries(environment).flatMap(([name, value]) => ["-e", `${name}=${value}`]),
        `mcr.microsoft.com/playwright:v${version}-${distro}`,
        ...["sh", "-c", command],
      ],
      { maxBuffer: 1e8 },
    );
    return { ok: true, output: stdout };
  } catch (error) {
    const { stdout = "", stderr = "" } = error as { stdout?: string; stderr?: string };
    return { ok: false, output: stdout + stderr };
  }
}

test.describe("legacy", { tag: "@legacy" }, () => {
  // Each test pulls and runs a Docker image.
  test.describe.configure({ timeout: 15 * 60_000 });

  // These step through the CSS features older browsers lack; screenshots land in test-results/legacy/<version>/.
  for (const version of ["1.20.0", "1.32.0", "1.40.0", "1.45.0", "1.52.0"]) {
    test(`text stays readable in Playwright ${version}'s engines`, async () => {
      const { ok, output } = await legacy(version);
      expect(ok, output).toBe(true);
    });
  }

  // Chromium 127 has light-dark() but not contrast-color(), so it renders the fallbacks in tokens/color.css.
  test("kitchen sink in Chromium 127", async () => {
    const path = "test-results/legacy/kitchen-sink-chromium-127.png";
    const { ok, output } = await legacy("1.45.0", {
      LEGACY_SNAPSHOT: `/work/${path}`,
      LEGACY_PAGES: JSON.stringify(["/kitchen-sink.html"]),
    });
    expect(ok, output).toBe(true);
    expect(await readFile(new URL(`../${path}`, import.meta.url))).toMatchSnapshot(
      "legacy-kitchen-sink-chromium-127.png",
    );
  });
});
