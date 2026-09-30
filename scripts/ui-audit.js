#!/usr/bin/env node
/**
 * Browser audit of the built app. Serves the production build with `vite preview`,
 * opens every page and state in Chromium at a phone and a desktop width, in light and
 * dark color schemes, and measures instead of eyeballing.
 *
 * Hard checks always fail the run: console errors, page errors, failed same-origin
 * requests, horizontal scroll, and the core flows (search, suggestion, word detail,
 * pagination, empty result, add-word validation).
 *
 * Design checks are reported, and fail the run only with --strict: text contrast,
 * tap target size, box shadows, chromatic hues, third-party font requests.
 *
 * Usage: node scripts/ui-audit.js [--strict] [--no-build] [--only=<page-name>]
 * Output: .svelte-kit/ui-audit/report.json and one screenshot per page, viewport and scheme.
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, ".svelte-kit/ui-audit");
const PORT = 4179;
const ORIGIN = `http://localhost:${PORT}`;

const args = new Set(process.argv.slice(2));
const STRICT = args.has("--strict");
const BUILD = !args.has("--no-build");
const ONLY = [...args].find((a) => a.startsWith("--only="))?.slice("--only=".length);

const VIEWPORTS = [
  { name: "360", width: 360, height: 800, isMobile: true, hasTouch: true },
  { name: "1440", width: 1440, height: 900, isMobile: false, hasTouch: false },
];
const SCHEMES = ["light", "dark"];

// Design thresholds. The design spec owns these numbers; keep them in sync with it.
const DESIGN = {
  minContrast: 4.5, // WCAG AA body text
  minContrastLarge: 3, // WCAG AA large text (>= 24px, or >= 18.66px bold)
  minTapSize: 24, // WCAG 2.2 AA target size (px, both axes)
  maxAccentHues: 1, // distinct chromatic hue families on one screen
  hueBucketDegrees: 30,
  minChroma: 40, // 0-255 max-min channel spread below which a color counts as neutral
};

const words = JSON.parse(readFileSync(resolve(ROOT, "static/data.json"), "utf-8"));
const sample = words[Math.floor(words.length / 2)];

// `ready` waits for content that only the named state shows, after the search data has
// loaded. The prerendered home page already has cards, so a generic "article" wait would
// pass before the client loaded, searched or paged.

// The page shows exactly the dataset entries `start..start+12`, and the numbered page
// links (rendered only once the client has its own result) mark the current page.
const cardsAre = (start) => (page) =>
  page.waitForFunction(
    (expected) => {
      if (!document.querySelector("button[aria-current=page]")) return false;
      const shown = [...document.querySelectorAll("article h2")].map((h) => h.textContent?.trim());
      return JSON.stringify(shown) === JSON.stringify(expected);
    },
    words.slice(start, start + 12).map((w) => w.word)
  );

// The result count line renders only once `findAll(term)` resolved, and every card matches.
const searchShows = (term) => (page) =>
  page.waitForFunction((t) => {
    const count = [...document.querySelectorAll("p, div, span")].some((el) =>
      /^\d+ resultados? en /.test(el.textContent?.trim() ?? "")
    );
    const cards = [...document.querySelectorAll("article")];
    return (
      count && cards.length > 0 && cards.every((c) => c.textContent?.toLowerCase().includes(t))
    );
  }, term);

const PAGES = [
  { name: "home", path: "/", ready: cardsAre(0) },
  { name: "page-2", path: `/?after=${encodeURIComponent(words[12].id)}`, ready: cardsAre(12) },
  { name: "search", path: "/?q=carnaval", ready: searchShows("carnaval") },
  {
    name: "search-empty",
    path: "/?q=zzqxjwv",
    ready: (page) => page.getByText("No encontramos palabras para esta búsqueda.").waitFor(),
  },
  {
    name: "word",
    path: `/?word=${encodeURIComponent(sample.id)}&q=${encodeURIComponent(sample.word)}`,
    ready: async (page) => {
      await page.waitForFunction(
        (word) => {
          const cards = document.querySelectorAll("article");
          return cards.length === 1 && cards[0].querySelector("h2")?.textContent?.trim() === word;
        },
        sample.word,
        { timeout: 10_000 }
      );
    },
  },
  { name: "add", path: "/add", ready: (page) => page.locator("form #word").waitFor() },
  {
    name: "guidelines",
    path: "/guidelines",
    ready: (page) => page.getByRole("heading", { name: "Pautas de contenido" }).waitFor(),
  },
];
const PAGES_AUDITED = PAGES.filter((p) => !ONLY || p.name === ONLY);
if (PAGES_AUDITED.length === 0) {
  throw new Error(`unknown page ${ONLY}; one of ${PAGES.map((p) => p.name).join(", ")}`);
}

const failures = [];
const designIssues = [];
const report = { strict: STRICT, design: DESIGN, pages: [] };

const fail = (where, message) => failures.push(`${where}: ${message}`);

function run(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(" ")} exited ${result.status}`);
}

async function startPreview() {
  // A server already on the port would be audited instead of this build.
  const busy = await fetch(ORIGIN).then(
    () => true,
    () => false
  );
  if (busy) throw new Error(`port ${PORT} is already in use; stop that server first`);
  const child = spawn(
    resolve(ROOT, "node_modules/.bin/vite"),
    ["preview", "--port", String(PORT), "--strictPort"],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`vite preview exited:\n${output}`);
    try {
      const res = await fetch(ORIGIN);
      if (res.ok) return child;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  child.kill();
  throw new Error(`vite preview did not answer on ${ORIGIN}:\n${output}`);
}

/**
 * Wire up error capture for a page. Third-party requests are blocked so the audit
 * is offline and deterministic; a blocked request is recorded, not treated as an error.
 */
function instrument(page, where) {
  const external = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(ORIGIN) && !url.startsWith("data:")) external.push(url);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Third-party requests are aborted on purpose; the browser logs each one.
    if (text.includes("ERR_BLOCKED_BY_CLIENT")) return;
    fail(where, `console error: ${text}`);
  });
  page.on("pageerror", (err) => fail(where, `page error: ${err.message}`));
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(ORIGIN)) {
      fail(where, `request failed: ${req.url()} ${req.failure()?.errorText}`);
    }
  });
  page.on("response", (res) => {
    if (res.url().startsWith(ORIGIN) && res.status() >= 400) {
      fail(where, `HTTP ${res.status()} for ${res.url()}`);
    }
  });
  return external;
}

/** Runs in the page. Returns layout and design measurements. */
function measure(design) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Resolve any CSS color (oklch, color-mix, named) to sRGB through the canvas.
  const toRgba = (css) => {
    if (!css || css === "transparent") return [0, 0, 0, 0];
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    if (a === 0) return [0, 0, 0, 0];
    // getImageData returns premultiplied-then-unpremultiplied values; alpha is 0-255.
    return [r, g, b, a / 255];
  };
  const over = (top, bottom) => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    const mix = (i) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a;
    return [mix(0), mix(1), mix(2), a];
  };
  const luminance = ([r, g, b]) => {
    const lin = (c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const contrast = (a, b) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const hue = ([r, g, b]) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < design.minChroma) return null;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const visible = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0;
  };
  const describe = (el) => {
    const text = (el.innerText || el.getAttribute("aria-label") || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
    const cls =
      typeof el.className === "string"
        ? el.className.trim().split(/\s+/).slice(0, 4).join(".")
        : "";
    return `<${el.tagName.toLowerCase()}${cls ? "." + cls : ""}> "${text}"`;
  };

  // Background behind an element: composite every ancestor's background from the root.
  // The canvas behind a transparent root is white in light and dark gray in dark schemes.
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const rootBg = dark ? [18, 18, 18, 1] : [255, 255, 255, 1];
  const backgroundOf = (el) => {
    const chain = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) chain.push(node);
    let bg = rootBg;
    let unknown = false;
    for (const node of chain.reverse()) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none") unknown = true;
      bg = over(toRgba(style.backgroundColor), bg);
    }
    return { bg, unknown };
  };

  const doc = document.documentElement;
  const result = {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    lowContrast: [],
    smallTargets: [],
    shadows: [],
    hues: {},
    radii: {},
    fontSizes: {},
    // Report only, for the design pass: counts of each value in use.
    fontFamilies: {},
  };

  const all = [...document.body.querySelectorAll("*")].filter(visible);
  const bucket = (h) => (Math.round(h / design.hueBucketDegrees) * design.hueBucketDegrees) % 360;
  const addHue = (el, css, prop) => {
    const rgba = toRgba(css);
    if (rgba[3] < 0.1) return;
    const h = hue(rgba);
    if (h === null) return;
    const key = String(bucket(h));
    result.hues[key] ??= { count: 0, examples: [] };
    result.hues[key].count++;
    if (result.hues[key].examples.length < 3)
      result.hues[key].examples.push(`${prop} ${css} ${describe(el)}`);
  };

  for (const el of all) {
    const style = getComputedStyle(el);
    if (el.tagName === "svg" || el.closest("svg")) continue;

    // Ignore shadow layers whose color is fully transparent (utility-class placeholders).
    const shadowLayers = style.boxShadow === "none" ? [] : style.boxShadow.split(/,(?![^(]*\))/);
    const visibleShadow = shadowLayers.filter((layer) => {
      const color =
        layer.match(/(?:rgba?|oklch|oklab|lab|lch|hsla?|color)\([^)]*\)|#[0-9a-f]{3,8}/i)?.[0] ??
        "black";
      return toRgba(color)[3] > 0 && !/^\s*(\S+\s+)?0px 0px 0px 0px/.test(layer.replace(color, ""));
    });
    if (visibleShadow.length > 0)
      result.shadows.push(`${describe(el)} ${visibleShadow.map((l) => l.trim()).join(", ")}`);
    if (style.borderRadius && style.borderRadius !== "0px")
      result.radii[style.borderRadius] = (result.radii[style.borderRadius] ?? 0) + 1;

    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText) {
      result.fontSizes[style.fontSize] = (result.fontSizes[style.fontSize] ?? 0) + 1;
      const family = style.fontFamily.split(",")[0].trim();
      result.fontFamilies[family] = (result.fontFamilies[family] ?? 0) + 1;
      addHue(el, style.color, "color");

      const { bg, unknown } = backgroundOf(el);
      if (!unknown && !el.closest("[disabled], [aria-disabled=true]") && !el.matches(":disabled")) {
        const fg = over(toRgba(style.color), bg);
        const ratio = contrast(fg, bg);
        const size = parseFloat(style.fontSize);
        const bold = Number(style.fontWeight) >= 700;
        const large = size >= 24 || (bold && size >= 18.66);
        const floor = large ? design.minContrastLarge : design.minContrast;
        if (ratio < floor)
          result.lowContrast.push(`${ratio.toFixed(2)} < ${floor} ${describe(el)}`);
      }
    }
    addHue(el, style.backgroundColor, "background");
    if (style.borderStyle !== "none" && parseFloat(style.borderWidth) > 0)
      addHue(el, style.borderColor, "border");

    const interactive = el.matches(
      "a[href], button, input:not([type=hidden]), select, textarea, label[for], [role=button], [role=option], summary"
    );
    if (interactive) {
      const rect = el.getBoundingClientRect();
      // Inline links inside running text are exempt from target size (WCAG 2.5.8).
      const inline =
        el.tagName === "A" &&
        style.display === "inline" &&
        el.parentElement?.closest("p, li, .prose");
      if (!inline && (rect.width < design.minTapSize || rect.height < design.minTapSize)) {
        result.smallTargets.push(
          `${Math.round(rect.width)}x${Math.round(rect.height)} ${describe(el)}`
        );
      }
    }
  }
  return result;
}

async function openPage(context, spec, where) {
  const page = await context.newPage();
  const external = instrument(page, where);
  await page.goto(ORIGIN + spec.path, { waitUntil: "networkidle" });
  page.setDefaultTimeout(10_000);
  await spec
    .ready(page)
    .catch((err) => fail(where, `never reached its state: ${err.message.split("\n")[0]}`));
  page.setDefaultTimeout(5_000);
  return { page, external };
}

async function auditPages(browser) {
  for (const viewport of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      const context = await newContext(browser, viewport, scheme);
      for (const spec of PAGES_AUDITED) {
        const where = `${spec.name}@${viewport.name}/${scheme}`;
        const { page, external } = await openPage(context, spec, where);
        await page.screenshot({
          path: resolve(OUT_DIR, `${spec.name}-${viewport.name}-${scheme}.png`),
          fullPage: true,
        });
        const m = await page.evaluate(measure, DESIGN);

        if (m.scrollWidth > m.clientWidth)
          fail(where, `horizontal scroll: scrollWidth ${m.scrollWidth} > ${m.clientWidth}`);

        const hueCount = Object.keys(m.hues).length;
        const fonts = external.filter((u) =>
          /fonts\.(googleapis|gstatic)\.com|\.woff2?(\?|$)/.test(u)
        );
        const issues = [
          ...m.lowContrast.map((x) => `contrast ${x}`),
          ...m.smallTargets.map((x) => `tap target ${x}`),
          ...m.shadows.map((x) => `shadow ${x}`),
          ...fonts.map((x) => `third-party font ${x}`),
          ...(hueCount > DESIGN.maxAccentHues
            ? [
                `${hueCount} hue families (max ${DESIGN.maxAccentHues}): ${Object.entries(m.hues)
                  .map(([h, v]) => `${h}deg x${v.count} e.g. ${v.examples[0]}`)
                  .join(" | ")}`,
              ]
            : []),
        ];
        for (const issue of issues) designIssues.push(`${where}: ${issue}`);

        report.pages.push({ where, external, ...m });
        await page.close();
      }
      await context.close();
    }
  }
}

async function newContext(browser, viewport, scheme) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    colorScheme: scheme,
    reducedMotion: "reduce",
    locale: "es-CO",
  });
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (url.startsWith(ORIGIN) || url.startsWith("data:")) return route.continue();
    return route.abort("blockedbyclient");
  });
  return context;
}

/** Core flows, run once per viewport. Each step asserts the visible outcome. */
async function auditFlows(browser) {
  if (ONLY) return;
  for (const viewport of VIEWPORTS) {
    const context = await newContext(browser, viewport, "light");
    const at = (flow) => `flow:${flow}@${viewport.name}`;
    const pageNamed = (name) => PAGES.find((p) => p.name === name);
    const step = async (flow, startAt, fn) => {
      let page;
      try {
        ({ page } = await openPage(context, pageNamed(startAt), at(flow)));
        await fn(page);
      } catch (err) {
        fail(at(flow), err.message.split("\n")[0]);
      } finally {
        await page?.close();
      }
    };

    await step("search-submit", "home", async (page) => {
      const input = page.getByRole("searchbox");
      await input.fill("carnaval");
      await page.getByRole("option").first().waitFor();
      await input.press("Enter");
      await page.waitForURL(/\?q=carnaval/);
      await searchShows("carnaval")(page);
    });

    await step("suggestion-select", "home", async (page) => {
      await page.getByRole("searchbox").fill(sample.word);
      const option = page.getByRole("option").first();
      await option.waitFor();
      const chosen = (await option.locator("span").first().innerText()).trim();
      await option.click();
      await page.waitForURL(/\?word=/);
      await page.waitForFunction((word) => {
        const cards = document.querySelectorAll("article");
        return cards.length === 1 && cards[0].querySelector("h2")?.textContent?.trim() === word;
      }, chosen);
    });

    await step("pagination-next", "home", async (page) => {
      const next = page.getByRole("button", { name: "Siguiente" });
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (b) => b.textContent?.trim() === "Siguiente" && !b.disabled
        )
      );
      await next.click();
      await page.waitForURL(/after=/);
      await cardsAre(12)(page);
    });

    await step("add-validation", "add", async (page) => {
      const word = page.locator("#word");
      await word.pressSequentially("x");
      await word.press("Backspace");
      await word.blur();
      await page.getByText("La palabra es obligatoria.").waitFor();
      if (!(await page.locator("form button[type=submit]").isDisabled()))
        throw new Error("submit is enabled with an invalid form");
    });

    await context.close();
  }
}

async function main() {
  if (BUILD) run(resolve(ROOT, "node_modules/.bin/vite"), ["build"]);
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await startPreview();
  const browser = await chromium.launch();
  try {
    await auditPages(browser);
    await auditFlows(browser);
  } finally {
    await browser.close();
    server.kill();
  }

  report.failures = failures;
  report.designIssues = designIssues;
  writeFileSync(resolve(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  // Group findings that differ only by page, viewport, scheme or element text,
  // so one repeated class shows as one line with an example.
  const summarize = (title, list, { ignoreText = false } = {}) => {
    const groups = new Map();
    for (const line of list) {
      const split = line.indexOf(": ");
      const where = line.slice(0, split);
      const what = line.slice(split + 2).split("\n")[0];
      const key = ignoreText ? what.replace(/ "[^"]*"/, "") : what;
      if (!groups.has(key)) groups.set(key, { example: what, wheres: new Set(), count: 0 });
      const group = groups.get(key);
      group.wheres.add(where);
      group.count++;
    }
    console.log(`\n${title}: ${list.length} (${groups.size} distinct)`);
    const sorted = [...groups.values()].sort((a, b) => b.count - a.count);
    for (const { example, wheres, count } of sorted.slice(0, 40)) {
      const places = [...wheres];
      const shown =
        places.slice(0, 2).join(", ") + (places.length > 2 ? ` +${places.length - 2}` : "");
      console.log(`  - x${count} ${example}  [${shown}]`);
    }
    if (sorted.length > 40)
      console.log(`  ... ${sorted.length - 40} more in .svelte-kit/ui-audit/report.json`);
  };
  summarize("Hard failures", failures);
  summarize(`Design issues${STRICT ? "" : " (report only, --strict to enforce)"}`, designIssues, {
    ignoreText: true,
  });
  console.log(`\nScreenshots and report: ${OUT_DIR}`);

  if (failures.length > 0 || (STRICT && designIssues.length > 0)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
