#!/usr/bin/env bun
/**
 * Regenerates the README screenshots from the production build (docs/MEDIA.md).
 * Each shot has a fixed viewport, color scheme and page state, so two runs on the
 * same commit produce the same images. Needs `cwebp` on PATH.
 *
 * Usage: node scripts/capture-media.js [--no-build]
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { ORIGIN, ROOT, VITE, newContext, welcomeShows, startPreview } from "./lib/app-states.js";

const OUT_DIR = resolve(ROOT, "docs/media");
const TMP_DIR = resolve(ROOT, ".svelte-kit/media");
const MAX_BYTES = 200 * 1024;

// One shot: the home page with nothing searched, on a desktop, in the dark theme.
const SHOTS = [
  {
    file: "home-dark.webp",
    // A real desktop layout, narrow enough that the interface text stays legible at the
    // width GitHub renders the README.
    viewport: { width: 1024, height: 720, isMobile: false, hasTouch: false },
    scheme: "dark",
    path: "/",
    ready: welcomeShows,
    width: 1600,
  },
];

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${cmd} ${args.join(" ")} exited ${result.status}`);
}

async function main() {
  if (spawnSync("cwebp", ["-version"]).status !== 0) {
    throw new Error("cwebp is not installed (macOS: brew install webp)");
  }
  if (!process.argv.includes("--no-build")) run(VITE, ["build"]);
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await startPreview();
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      const context = await newContext(browser, shot.viewport, shot.scheme, {
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      await page.goto(ORIGIN + shot.path, { waitUntil: "networkidle" });
      await shot.ready(page);
      await page.evaluate(() => document.fonts.ready);
      // No caret, focus ring or hover state in the picture.
      await page.evaluate(() => document.activeElement?.blur());
      await page.mouse.move(0, 0);
      const png = resolve(TMP_DIR, shot.file.replace(".webp", ".png"));
      await page.screenshot({ path: png });
      await context.close();

      const out = resolve(OUT_DIR, shot.file);
      run("cwebp", ["-quiet", "-q", "80", "-resize", String(shot.width), "0", png, "-o", out]);
      const bytes = statSync(out).size;
      console.log(`${shot.file}: ${shot.width}px wide, ${(bytes / 1024).toFixed(0)} KB`);
      if (bytes > MAX_BYTES) throw new Error(`${shot.file} is over ${MAX_BYTES / 1024} KB`);
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
