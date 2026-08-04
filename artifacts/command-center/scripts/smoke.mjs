#!/usr/bin/env node
/**
 * Production build smoke check for the command center (CRM) web app.
 *
 * Runs the real production build with the app's real base path (/crm/,
 * the path the CRM is mounted at behind the proxy), then serves the built
 * output via `vite preview` and verifies the app shell HTML responds.
 *
 *   1. Build with BASE_PATH=/crm/ and NODE_ENV=production
 *   2. Serve dist via `vite preview` and check GET /crm/ returns 200 with
 *      an app shell (<div id="root">) and hashed production assets.
 *
 * Fails loudly (non-zero exit) on any build or serve error.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const artifactDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE_PATH = "/crm/";
const SERVE_TIMEOUT_MS = 30_000;

function run(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      cwd: artifactDir,
      env: { ...process.env, ...env },
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`)),
    );
    child.on("error", reject);
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

async function main() {
  console.log(`[smoke] building command-center with BASE_PATH=${BASE_PATH} ...`);
  await run("pnpm", ["run", "build"], {
    BASE_PATH,
    NODE_ENV: "production",
    PORT: process.env.PORT ?? "5000",
  });

  // Serve the built output and verify the app shell responds.
  const port = await getFreePort();
  console.log(`[smoke] serving built output on port ${port} ...`);
  const server = spawn(
    "pnpm",
    ["exec", "vite", "preview", "--config", "vite.config.ts", "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    {
      cwd: artifactDir,
      env: { ...process.env, BASE_PATH, NODE_ENV: "production", PORT: String(port) },
      stdio: ["ignore", "inherit", "inherit"],
    },
  );

  let exited = false;
  let exitInfo = null;
  server.on("exit", (code, signal) => {
    exited = true;
    exitInfo = { code, signal };
  });

  try {
    const base = `http://127.0.0.1:${port}`;
    const deadline = Date.now() + SERVE_TIMEOUT_MS;
    let res = null;
    for (;;) {
      if (exited) {
        throw new Error(
          `Preview server crashed at startup (exit code ${exitInfo?.code}, signal ${exitInfo?.signal}).`,
        );
      }
      if (Date.now() > deadline) {
        throw new Error(`Preview server did not respond within ${SERVE_TIMEOUT_MS}ms.`);
      }
      try {
        res = await fetch(`${base}${BASE_PATH}`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }

    if (res.status !== 200) {
      throw new Error(`GET ${BASE_PATH} returned status ${res.status}, expected 200.`);
    }
    const html = await res.text();
    if (!html.includes('<div id="root">')) {
      throw new Error("App shell HTML is missing <div id=\"root\"> — build output looks broken.");
    }
    const assetRe = new RegExp(`src="${BASE_PATH.replace(/\//g, "\\/")}assets\\/[^"]+\\.js"`);
    if (!assetRe.test(html)) {
      throw new Error(
        `App shell HTML does not reference built assets under ${BASE_PATH}assets/ — base path likely misconfigured.`,
      );
    }
    console.log(`[smoke] app shell OK (200 with #root and ${BASE_PATH}assets/ bundle)`);

    // --- Branding checks ---
    // 1. Ensure %CLIENT_APP_NAME% placeholder was fully replaced.
    if (html.includes("%CLIENT_APP_NAME%")) {
      throw new Error(
        "Built index.html still contains the raw %CLIENT_APP_NAME% placeholder — clientBrandingPlugin did not run.",
      );
    }
    // 2. Ensure the correct app name appears in the <title>.
    const APP_NAME = "Painless Command Center";
    if (!html.includes(`<title>${APP_NAME}</title>`)) {
      throw new Error(
        `Built index.html does not contain <title>${APP_NAME}</title> — title injection failed or appName changed.`,
      );
    }
    // 3. Ensure the --primary HSL value from client.config.ts was injected.
    const PRIMARY_HSL = "221 80% 35%";
    if (!html.includes(`--primary: ${PRIMARY_HSL}`)) {
      throw new Error(
        `Built index.html does not contain "--primary: ${PRIMARY_HSL}" — CSS variable injection failed or primaryHsl changed.`,
      );
    }
    // 4. Ensure the dark-mode --primary HSL value was also injected.
    const PRIMARY_HSL_DARK = "221 80% 60%";
    if (!html.includes(`--primary: ${PRIMARY_HSL_DARK}`)) {
      throw new Error(
        `Built index.html does not contain dark-mode "--primary: ${PRIMARY_HSL_DARK}" — CSS variable injection failed or primaryHslDark changed.`,
      );
    }
    console.log(`[smoke] branding OK (title="${APP_NAME}", --primary=${PRIMARY_HSL}, dark --primary=${PRIMARY_HSL_DARK})`);
    console.log("[smoke] PASSED: command-center builds and serves the app shell at its real base path.");
  } finally {
    if (!exited) server.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(`[smoke] FAILED: ${err.message}`);
  process.exit(1);
});
