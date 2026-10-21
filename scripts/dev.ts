import { spawnSync } from "node:child_process";
import { createReadStream, watch } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const servable = [join(root, "demo"), join(root, "dist")];
const port = Number(process.env.PORT ?? 8080);
const types: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

function build() {
  spawnSync(process.execPath, [join(root, "scripts/build.ts")], { stdio: "inherit" });
}

build();

let pending: NodeJS.Timeout | undefined;
watch(join(root, "src"), { recursive: true }, () => {
  clearTimeout(pending);
  pending = setTimeout(build, 50);
});

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    if (pathname === "/") {
      res.writeHead(302, { location: "/demo/" }).end();
      return;
    }
    let file = resolve(root, `.${decodeURIComponent(pathname)}`);
    if (!servable.some((dir) => file === dir || file.startsWith(dir + sep))) {
      res.writeHead(404).end();
      return;
    }
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    await stat(file);
    res.writeHead(200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end();
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Demo: http://localhost:${port}/demo/`);
});
