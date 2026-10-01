#!/usr/bin/env bun
/**
 * Browser audit of the built app. Serves the production build with `vite preview`,
 * opens every page and state in Chromium at a phone and a desktop width, in light and
 * dark color schemes, and measures instead of eyeballing.
 *
 * Hard checks always fail the run: console errors, page errors, failed same-origin
 * requests, horizontal scroll, and the core flows (search, suggestion, word detail,
 * pagination, empty result, add-word validation).
 *
 * Design checks are reported, and fail the run only with --strict: text contrast, tap
 * target size, primary target height, box shadows, hue families outside status messages,
 * font sizes and radii outside the token scale, a single h1, a visible keyboard focus
 * ring, and third-party font requests.
 *
 * Before the browser, scripts/lib/machine-checks.ts reads what agents and crawlers get over
 * plain HTTP (raw HTML, Markdown, sitemap, robots.txt, llms.txt, OpenAPI, the API and its
 * errors); those are hard checks too.
 *
 * Usage: bun scripts/ui-audit.ts [--strict] [--no-build] [--only=<page-name>]
 * Output: .svelte-kit/ui-audit/report.json and one screenshot per page, viewport and scheme.
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";
import {
  ORIGIN,
  PAGES,
  ROOT,
  viteCommand,
  cardsAre,
  filedUnder,
  letterShows,
  welcomeShows,
  words,
  newContext,
  sample,
  type PageState,
  type Scheme,
  type Viewport,
  searchShows,
  startPreview,
  wordShows,
} from "./lib/app-states.ts";
import { auditMachineReadable } from "./lib/machine-checks.ts";

const OUT_DIR = resolve(ROOT, ".svelte-kit/ui-audit");

const args = new Set(process.argv.slice(2));
const STRICT = args.has("--strict");
const BUILD = !args.has("--no-build");
const ONLY = [...args].find((a) => a.startsWith("--only="))?.slice("--only=".length);

const VIEWPORTS: (Viewport & { name: string })[] = [
  { name: "360", width: 360, height: 800, isMobile: true, hasTouch: true },
  { name: "1440", width: 1440, height: 900, isMobile: false, hasTouch: false },
];
const SCHEMES: Scheme[] = ["light", "dark"];

// Design thresholds. The design spec owns these numbers; keep them in sync with it.
const DESIGN = {
  minContrast: 4.5, // WCAG AA body text
  minContrastLarge: 3, // WCAG AA large text (>= 24px, or >= 18.66px bold)
  minTapSize: 24, // WCAG 2.2 AA target size (px, both axes)
  maxAccentHues: 1, // distinct chromatic hue families on one screen
  hueBucketDegrees: 30,
  minChroma: 40, // 0-255 max-min channel spread below which a color counts as neutral
  allowedFontSizes: [12, 14, 16, 18, 24, 30], // px, the type scale
  allowedRadii: [6, 8], // px, field and box; anything >= pillRadius counts as a pill
  pillRadius: 9999,
  minPrimaryTarget: 40, // px height at 360 px for the targets below
  primaryTargets: [
    ["search field", "form[role=search] label"],
    ["pagination previous", "button[data-pagination=prev]"],
    ["pagination next", "button[data-pagination=next]"],
  ] as [string, string][],
  minFocusContrast: 3,
  minBrowseTarget: 32, // px, letters and page numbers
  browseTargets: 'nav[aria-label="Navegación por letras"] a, button[data-page]',
  minFieldBoundary: 3, // WCAG 1.4.11: a field's border against the surface around it
  focusPages: ["home", "search", "about"],
  focusViewports: ["1440", "360"],
  maxFocusStops: 80,
};

const PAGES_AUDITED = PAGES.filter((p) => !ONLY || p.name === ONLY);
if (PAGES_AUDITED.length === 0) {
  throw new Error(`unknown page ${ONLY}; one of ${PAGES.map((p) => p.name).join(", ")}`);
}

/** What `measure` reports about the page it runs in. */
interface Measurements {
  h1Count: number;
  seo: {
    title: string;
    descriptions: number;
    h1: string;
    lang: string;
    ogUrl: string;
    canonicals: string[];
  };
  boxedEntries: number;
  resultLine: number | null;
  offScaleFonts: string[];
  offScaleRadii: string[];
  shortPrimaryTargets: string[];
  scrollWidth: number;
  clientWidth: number;
  lowContrast: string[];
  weakFields: string[];
  smallTargets: string[];
  shadows: string[];
  hues: Record<string, { count: number; examples: string[] }>;
  radii: Record<string, number>;
  fontSizes: Record<string, number>;
  fontFamilies: Record<string, number>;
}

/** The focus ring of the focused element; `wrapped` once the tab order came back around. */
interface FocusRing {
  wrapped?: true;
  where?: string;
  ok?: boolean;
  why?: string;
}

interface Report {
  strict: boolean;
  design: typeof DESIGN;
  pages: ({ where: string; external: string[] } & Measurements)[];
  failures?: string[];
  designIssues?: string[];
}

/** Red, green, blue (0-255) and alpha (0-1). */
type Rgba = [number, number, number, number];

const failures: string[] = [];
const designIssues: string[] = [];
const report: Report = { strict: STRICT, design: DESIGN, pages: [] };

const fail = (where: string, message: string) => failures.push(`${where}: ${message}`);

// The first line of a thrown error's message, for the one-line failure report.
const firstLine = (err: unknown) =>
  (err instanceof Error ? err.message : String(err)).split("\n")[0];

function run(cmd: string, cmdArgs: string[]) {
  const result = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${cmd} ${cmdArgs.join(" ")} exited ${result.status}`);
}

/**
 * Wire up error capture for a page. Third-party requests are blocked so the audit
 * is offline and deterministic; a blocked request is recorded, not treated as an error.
 */
function instrument(
  page: Page,
  where: string,
  allowStatus: number[] = [],
  allowConsole: RegExp[] = [],
  allowRequestFailed: RegExp[] = []
): string[] {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(ORIGIN) && !url.startsWith("data:")) external.push(url);
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Third-party requests are aborted on purpose; the browser logs each one.
    if (text.includes("ERR_BLOCKED_BY_CLIENT")) return;
    // The document of an expected error page (the not-found state) logs its own status.
    if (allowStatus.some((code) => text.includes(`status of ${code}`))) return;
    if (allowConsole.some((pattern) => pattern.test(text))) return;
    // SvelteKit's client logs "Not found: <path>" when it renders the 404 page.
    if (allowStatus.includes(404) && /Not found: \//.test(text)) return;
    fail(where, `console error: ${text}`);
  });
  page.on("pageerror", (err) => fail(where, `page error: ${err.message}`));
  page.on("requestfailed", (req) => {
    if (req.url().startsWith(ORIGIN) && !allowRequestFailed.some((p) => p.test(req.url()))) {
      fail(where, `request failed: ${req.url()} ${req.failure()?.errorText}`);
    }
  });
  page.on("response", (res) => {
    const expected = allowStatus.includes(res.status());
    if (res.url().startsWith(ORIGIN) && res.status() >= 400 && !expected) {
      fail(where, `HTTP ${res.status()} for ${res.url()}`);
    }
  });
  return external;
}

/**
 * Runs in the page. Returns layout and design measurements, or with `focusOnly` only the
 * focus ring of the focused element.
 */
function measure({
  design,
  focusOnly = false,
}: {
  design: typeof DESIGN;
  focusOnly?: boolean;
}): Measurements | FocusRing | null {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  // A 1x1 canvas always has a 2d context.
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  // Resolve any CSS color (oklch, color-mix, named) to sRGB through the canvas.
  const toRgba = (css: string | null): Rgba => {
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
  const over = (top: Rgba, bottom: Rgba): Rgba => {
    const a = top[3] + bottom[3] * (1 - top[3]);
    if (a === 0) return [0, 0, 0, 0];
    const mix = (i: number) => (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / a;
    return [mix(0), mix(1), mix(2), a];
  };
  const luminance = ([r, g, b]: Rgba) => {
    const lin = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const contrast = (a: Rgba, b: Rgba) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const hue = ([r, g, b]: Rgba): number | null => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d < design.minChroma) return null;
    let h: number;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  const visible = (el: Element) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0;
  };
  const describe = (el: Element) => {
    const text = ((el as HTMLElement).innerText || el.getAttribute("aria-label") || "")
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
  const rootBg: Rgba = dark ? [18, 18, 18, 1] : [255, 255, 255, 1];
  const backgroundOf = (el: Element) => {
    const chain: Element[] = [];
    for (let node: Element | null = el; node && node.nodeType === 1; node = node.parentElement)
      chain.push(node);
    let bg: Rgba = rootBg;
    let unknown = false;
    for (const node of chain.reverse()) {
      const style = getComputedStyle(node);
      if (style.backgroundImage && style.backgroundImage !== "none") unknown = true;
      bg = over(toRgba(style.backgroundColor), bg);
    }
    return { bg, unknown };
  };

  // Focus ring of the focused element: outline, or a box-shadow ring, against its surroundings.
  const focusRing = (): FocusRing | null => {
    const focused = document.activeElement;
    if (!focused || focused === document.body) return null;
    // A field inside a DaisyUI `input` wrapper shows its ring on the wrapper.
    const el = (focused.closest(".input") ?? focused) as HTMLElement;
    // Focus came back to an element already checked: the tab order has wrapped.
    if (el.dataset.auditFocused) return { wrapped: true };
    el.dataset.auditFocused = "1";
    const style = getComputedStyle(el);
    const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 1;
    const ringColor: string | null | undefined = outline
      ? style.outlineColor
      : style.boxShadow !== "none"
        ? style.boxShadow.match(/(?:rgba?|oklch|oklab|lab|lch|hsla?|color)\([^)]*\)/i)?.[0]
        : null;
    const rect = el.getBoundingClientRect();
    const where = describe(el);
    if (rect.width === 0 || rect.height === 0 || Number(style.opacity) === 0)
      return { where, ok: false, why: "focus is on an invisible element" };
    if (!ringColor) return { where, ok: false, why: "no outline or ring" };
    const bg = backgroundOf(el.parentElement ?? el).bg;
    const ratio = contrast(over(toRgba(ringColor), bg), bg);
    return {
      where,
      ok: ratio >= design.minFocusContrast,
      why: `ring contrast ${ratio.toFixed(2)} < ${design.minFocusContrast}`,
    };
  };
  if (focusOnly) return focusRing();

  // Status colors are allowed only in status messages and form validation (design.md, decision 5).
  const describedByInvalid = new Set(
    [...document.querySelectorAll("[aria-invalid=true][aria-describedby]")].flatMap((f) =>
      // The selector requires the attribute.
      f.getAttribute("aria-describedby")!.split(/\s+/)
    )
  );
  const isStatus = (el: Element) =>
    Boolean(el.closest("[role=status], [role=alert], [aria-invalid=true]")) ||
    [...describedByInvalid].some((id) => el.closest(`#${CSS.escape(id)}`));

  const doc = document.documentElement;
  const result: Measurements = {
    h1Count: document.querySelectorAll("h1").length,
    // What search engines and assistive technology read about the page.
    seo: {
      title: document.title,
      descriptions: document.querySelectorAll('meta[name="description"]').length,
      h1: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      lang: document.documentElement.lang,
      ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute("content") ?? "",
      canonicals: [...document.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]')].map(
        (l) => l.href
      ),
    },
    // Entries are rows everywhere: a word entry with side borders or corners is a boxed card.
    boxedEntries: [...document.querySelectorAll("article")].filter((a) => {
      const st = getComputedStyle(a);
      return parseFloat(st.borderLeftWidth) > 0 || parseFloat(st.borderTopLeftRadius) > 0;
    }).length,
    // Every list starts with its result line, first thing in the content column.
    resultLine: (() => {
      const main = document.querySelector("main");
      const line = document.querySelector("main p[aria-live]");
      if (!main || !line) return null;
      const top = main.getBoundingClientRect().top + parseFloat(getComputedStyle(main).paddingTop);
      return Math.round(line.getBoundingClientRect().top - top);
    })(),
    offScaleFonts: [],
    offScaleRadii: [],
    shortPrimaryTargets: [],
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    lowContrast: [],
    weakFields: [],
    smallTargets: [],
    shadows: [],
    hues: {},
    radii: {},
    fontSizes: {},
    // Report only, for the design pass: counts of each value in use.
    fontFamilies: {},
  };

  const all = [...document.body.querySelectorAll("*")].filter(visible);
  const bucket = (h: number) =>
    (Math.round(h / design.hueBucketDegrees) * design.hueBucketDegrees) % 360;
  const addHue = (el: Element, css: string, prop: string) => {
    if (isStatus(el)) return;
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
    if (style.borderRadius && style.borderRadius !== "0px") {
      result.radii[style.borderRadius] = (result.radii[style.borderRadius] ?? 0) + 1;
      const offScale = style.borderRadius
        .split(/[\s/]+/)
        .map(parseFloat)
        .some((r) => r !== 0 && r < design.pillRadius && !design.allowedRadii.includes(r));
      if (offScale) result.offScaleRadii.push(`${style.borderRadius} ${describe(el)}`);
    }

    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
    if (hasText) {
      result.fontSizes[style.fontSize] = (result.fontSizes[style.fontSize] ?? 0) + 1;
      if (!design.allowedFontSizes.includes(parseFloat(style.fontSize)))
        result.offScaleFonts.push(`${style.fontSize} ${describe(el)}`);
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

    // A <label for> is a target of its own only for a checkbox or radio;
    // a text field's label is not, because the field itself is the target (and is measured).
    const forControl = el.matches("label[for]")
      ? // The selector requires the attribute.
        document.getElementById(el.getAttribute("for")!)
      : null;
    const interactive =
      forControl?.matches("[type=checkbox], [type=radio]") ||
      el.matches(
        "a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=option], summary"
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

  // Field boundaries and placeholders (a placeholder is text, and is not a text node).
  for (const el of all) {
    if (!el.matches("input:not([type=hidden]):not(.input > input), textarea, label.input"))
      continue;
    if (el.matches(":disabled") || el.querySelector?.(":disabled")) continue;
    const style = getComputedStyle(el);
    if (parseFloat(style.borderTopWidth) > 0 && style.borderTopStyle !== "none") {
      const around = backgroundOf(el.parentElement ?? el).bg;
      const ratio = contrast(over(toRgba(style.borderTopColor), around), around);
      if (ratio < design.minFieldBoundary)
        result.weakFields.push(
          `boundary ${ratio.toFixed(2)} < ${design.minFieldBoundary} ${describe(el)}`
        );
    }
    const field = (el.matches("label.input") ? el.querySelector("input") : el) as
      HTMLInputElement | HTMLTextAreaElement | null;
    if (field?.placeholder && !field.value) {
      const bg = backgroundOf(field).bg;
      const ph = over(toRgba(getComputedStyle(field, "::placeholder").color), bg);
      const ratio = contrast(ph, bg);
      if (ratio < design.minContrast)
        result.weakFields.push(
          `placeholder ${ratio.toFixed(2)} < ${design.minContrast} "${field.placeholder}"`
        );
    }
  }

  // Letters and page numbers are the browse controls, so they get a larger minimum.
  for (const el of document.querySelectorAll(design.browseTargets)) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < design.minBrowseTarget || r.height < design.minBrowseTarget)
      result.smallTargets.push(
        `${Math.round(r.width)}x${Math.round(r.height)} (browse) ${describe(el)}`
      );
  }

  // Primary targets must be tall enough on a phone (checked only at narrow widths).
  if (innerWidth < 640) {
    for (const [name, selector] of design.primaryTargets) {
      for (const el of document.querySelectorAll(selector)) {
        if (!visible(el)) continue;
        const height = el.getBoundingClientRect().height;
        if (height < design.minPrimaryTarget)
          result.shortPrimaryTargets.push(`${name} ${Math.round(height)}px ${describe(el)}`);
      }
    }
  }
  return result;
}

async function openPage(context: BrowserContext, spec: PageState, where: string) {
  const page = await context.newPage();
  const external = instrument(
    page,
    where,
    spec.allowStatus,
    spec.allowConsole,
    spec.allowRequestFailed
  );
  if (spec.setup) await spec.setup(page);
  await page.goto(ORIGIN + spec.path, { waitUntil: "networkidle" });
  page.setDefaultTimeout(10_000);
  await spec.ready(page).catch((err) => fail(where, `never reached its state: ${firstLine(err)}`));
  page.setDefaultTimeout(5_000);
  return { page, external };
}

async function auditPages(browser: Browser) {
  for (const viewport of VIEWPORTS) {
    for (const scheme of SCHEMES) {
      const context = await newContext(browser, viewport, scheme);
      for (const spec of PAGES_AUDITED) {
        const where = `${spec.name}@${viewport.name}/${scheme}`;
        const own = spec.isolated
          ? await newContext(browser, viewport, scheme, { serviceWorkers: "block" })
          : null;
        const { page, external } = await openPage(own ?? context, spec, where);
        await page.screenshot({
          path: resolve(OUT_DIR, `${spec.name}-${viewport.name}-${scheme}.png`),
          fullPage: true,
        });
        const m = (await page.evaluate(measure, { design: DESIGN })) as Measurements;

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
          ...m.weakFields.map((x) => `field ${x}`),
          ...m.offScaleFonts.map((x) => `font size off scale ${x}`),
          ...m.offScaleRadii.map((x) => `radius off scale ${x}`),
          ...m.shortPrimaryTargets.map(
            (x) => `primary target under ${DESIGN.minPrimaryTarget}px: ${x}`
          ),
          ...(m.h1Count === 1 ? [] : [`${m.h1Count} h1 elements (expected 1)`]),
          ...(m.boxedEntries ? [`${m.boxedEntries} boxed word entries (entries are rows)`] : []),
          ...(!/^Monocuco \| .+/.test(m.seo.title)
            ? [`title "${m.seo.title}" does not name the page`]
            : []),
          ...(m.seo.descriptions !== 1
            ? [`${m.seo.descriptions} meta descriptions (expected 1)`]
            : []),
          ...(m.seo.h1.length < 3 ? [`h1 "${m.seo.h1}" does not describe the page`] : []),
          ...(m.seo.lang !== "es" ? [`lang "${m.seo.lang}"`] : []),
          ...(!m.seo.ogUrl.startsWith("https://")
            ? [`og:url "${m.seo.ogUrl}" is not absolute`]
            : []),
          ...(!spec.allowStatus?.includes(404) &&
          (m.seo.canonicals.length !== 1 || !m.seo.canonicals[0].startsWith("https://"))
            ? [`canonical links ${JSON.stringify(m.seo.canonicals)} (expected one absolute)`]
            : []),
          ...(m.resultLine === null &&
          ["home", "page-2", "letter", "search", "search-empty", "word"].includes(spec.name)
            ? ["no result line at the top of the list"]
            : []),
          ...(m.resultLine !== null && m.resultLine > 1
            ? [`result line starts ${m.resultLine}px below the top of the content`]
            : []),
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
        await own?.close();
      }
      await context.close();
    }
  }
}

/** Core flows, run once per viewport. Each step asserts the visible outcome. */
async function auditFlows(browser: Browser) {
  if (ONLY) return;
  for (const viewport of VIEWPORTS) {
    const context = await newContext(browser, viewport, "light");
    const at = (flow: string) => `flow:${flow}@${viewport.name}`;
    // Every name passed here is in PAGES.
    const pageNamed = (name: string | PageState): PageState =>
      typeof name === "string" ? PAGES.find((p) => p.name === name)! : name;
    const step = async (
      flow: string,
      startAt: string | PageState,
      fn: (page: Page) => Promise<unknown>
    ) => {
      let page: Page | undefined;
      try {
        ({ page } = await openPage(context, pageNamed(startAt), at(flow)));
        await fn(page);
      } catch (err) {
        fail(at(flow), firstLine(err));
      } finally {
        await page?.close();
      }
    };

    await step("search-submit", "home", async (page) => {
      const input = page.getByRole("combobox", { name: "Buscar palabras" });
      await input.fill("carnaval");
      // Real suggestions are showing, and Enter with none highlighted still searches.
      await page.locator("[role=option][data-suggestion]").first().waitFor();
      await input.press("Enter");
      await page.waitForURL(/\?q=carnaval/);
      await searchShows("carnaval")(page);
      // Back returns to all words.
      await page.goBack();
      await welcomeShows(page);
    });

    // A reader downloads no search data: not on load, not from the service worker, not on the
    // way back to all words from another page. The first focus on the search field does.
    // Context-level requests include the service worker's; the listener exists before loading.
    {
      const own = await newContext(browser, viewport, "light");
      const fetched: string[] = [];
      own.on("request", (request) => {
        if (/\/(data|search-index)\.json$/.test(new URL(request.url()).pathname))
          fetched.push(`${request.serviceWorker() ? "worker " : ""}${request.url()}`);
      });
      let page: Page | undefined;
      try {
        ({ page } = await openPage(own, pageNamed("about"), at("reader-loads-no-search-data")));
        await page.waitForFunction(() => "hydrated" in document.documentElement.dataset);
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.getByRole("link", { name: "Monocuco, inicio" }).click();
        await welcomeShows(page);
        await page.mouse.wheel(0, 1500);
        await page.waitForTimeout(1500);
        if (fetched.length) throw new Error(`a reader downloaded ${fetched.join(", ")}`);
        await page.getByRole("combobox", { name: "Buscar palabras" }).focus();
        await page.waitForFunction(() => "searchReady" in document.documentElement.dataset);
        const names = new Set(fetched.map((f) => new URL(f.split(" ").pop()!).pathname));
        if (!names.has("/data.json") || !names.has("/search-index.json"))
          throw new Error(`focusing search fetched only ${fetched.join(", ")}`);
        // The worker fetches the pair once, not once per request.
        const byWorker = fetched.filter((f) => f.startsWith("worker "));
        if (byWorker.length !== 2) throw new Error(`the worker fetched ${byWorker.join(", ")}`);
      } catch (err) {
        fail(at("reader-loads-no-search-data"), firstLine(err));
      } finally {
        await own.close();
      }
    }

    // Back on a page the server rendered shows its words again, also before the search data is
    // ready: a letter page, then "Todas" (the first page built with the site), then Back.
    {
      const own = await newContext(browser, viewport, "light", { serviceWorkers: "block" });
      let page: Page | undefined;
      try {
        ({ page } = await openPage(
          own,
          {
            ...pageNamed("letter"),
            // Hold the data back, so all of this happens before it is ready.
            setup: (p) =>
              p.route("**/data.json", async (route) => {
                await new Promise((r) => setTimeout(r, 4000));
                await route.continue();
              }),
          },
          at("back-to-rendered")
        ));
        await page.getByRole("link", { name: "Todas" }).click();
        await page.waitForURL((url) => !url.search);
        await cardsAre(0)(page);
        await page.goBack();
        await page.waitForURL(/letter=M/);
        const expected = words
          .filter((w) => filedUnder(w.word) === "M")
          .slice(0, 12)
          .map((w) => w.word);
        await page.waitForFunction(
          (want) =>
            JSON.stringify(
              [...document.querySelectorAll("article h2")].map((h) => h.textContent?.trim())
            ) === JSON.stringify(want),
          expected,
          { timeout: 2000 }
        );
        // Only meaningful before the data arrived; otherwise the browser computed the cards.
        if (await page.evaluate(() => "searchReady" in document.documentElement.dataset))
          throw new Error("the data was ready before Back; the flow proved nothing");
      } catch (err) {
        fail(at("back-to-rendered"), firstLine(err));
      } finally {
        await own.close();
      }
    }

    // Reaching for the pager starts the load; when it fails, the reader keeps the page, and
    // only the state that needs the data (the next page) shows the failure.
    {
      const own = await newContext(browser, viewport, "light", { serviceWorkers: "block" });
      let page: Page | undefined;
      try {
        ({ page } = await openPage(
          own,
          {
            ...pageNamed("home"),
            setup: (p) => p.route("**/data.json", (route) => route.fulfill({ status: 500 })),
            allowStatus: [500],
            allowConsole: [/Failed to init search data/, /Search data initialization failed/],
            allowRequestFailed: [/\/data\.json$/],
          },
          at("warm-failure-keeps-page")
        ));
        const asked = page.waitForRequest((r) => r.url().endsWith("/data.json"));
        await page.getByRole("button", { name: "Siguiente" }).focus();
        await asked;
        await page
          .getByRole("combobox", { name: "Buscar palabras" })
          .and(page.locator("[disabled]"))
          .waitFor();
        if (await page.getByRole("alert").count())
          throw new Error("a failed load started by focusing the pager replaced the page");
        if ((await page.locator("article").count()) !== 12)
          throw new Error("the page lost its words after a failed load");
        await page.getByText("La búsqueda no está disponible", { exact: false }).first().waitFor();
        if ((await page.getByRole("button", { name: "Reintentar" }).count()) !== 1)
          throw new Error("the notice has no Reintentar button");
        await page.getByRole("button", { name: "Siguiente" }).click();
        await page.getByRole("alert").getByRole("button", { name: "Reintentar" }).waitFor();
      } catch (err) {
        fail(at("warm-failure-keeps-page"), firstLine(err));
      } finally {
        await own.close();
      }
    }

    await step("search-stays-local", "about", async (page) => {
      // Searching from another page, and going home, never asks the server: the search
      // stays in the browser (the privacy page says so) and works offline.
      await page.waitForFunction(() => "hydrated" in document.documentElement.dataset);
      const asked: string[] = [];
      page.on("request", (request) => {
        const url = new URL(request.url());
        if (url.pathname === "/" || url.pathname.endsWith("__data.json")) asked.push(url.href);
      });
      const input = page.getByRole("combobox", { name: "Buscar palabras" });
      await input.fill("carnaval");
      await input.press("Enter");
      await page.waitForURL(/\?q=carnaval/);
      await searchShows("carnaval")(page);
      await page.getByRole("link", { name: "Monocuco, inicio" }).click();
      await welcomeShows(page);
      if (asked.length) throw new Error(`asked the server for ${asked.join(", ")}`);
    });

    {
      // After one visit with a search, the service worker opens any state of the home page offline. Its own
      // context, so the service worker and cache are this flow's alone.
      const own = await newContext(browser, viewport, "light");
      let page: Page | undefined;
      try {
        ({ page } = await openPage(
          own,
          // Offline, the browser logs that the worker's update check could not fetch the script.
          { ...pageNamed("home"), allowConsole: [/error occurred when fetching the script/] },
          at("offline-home")
        ));
        await page.evaluate(async () => {
          await navigator.serviceWorker.ready;
          if (!navigator.serviceWorker.controller)
            await new Promise((r) =>
              navigator.serviceWorker.addEventListener("controllerchange", r)
            );
        });
        // The search data is cached the first time it is used (it is not precached), so search
        // once online; after that every state opens offline.
        await page.getByRole("combobox", { name: "Buscar palabras" }).focus();
        await page.waitForFunction(() => "searchReady" in document.documentElement.dataset);
        await own.setOffline(true);
        await page.goto(`${ORIGIN}/?letter=M`);
        await letterShows("M")(page);
      } catch (err) {
        fail(at("offline-home"), firstLine(err));
      } finally {
        await own.close();
      }
    }

    await step("suggestion-select", "home", async (page) => {
      await page.getByRole("combobox", { name: "Buscar palabras" }).fill(sample.word);
      const option = page.locator("[role=option][data-suggestion]").first();
      await option.waitFor();
      const chosen = (await option.locator("span").first().innerText()).trim();
      await option.click();
      await page.waitForURL(/\?word=/);
      await wordShows(chosen)(page);
      // Choosing with the mouse keeps focus in the search field.
      const role = await page.evaluate(() => document.activeElement?.getAttribute("role"));
      if (role !== "combobox") throw new Error(`focus after choosing is on role "${role}"`);
    });

    await step(
      "suggestions-pending",
      {
        path: "/",
        // Hold the index back, so the list is open while the lookup waits for the data.
        setup: (page) =>
          page.route("**/search-index.json", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 1500));
            await route.continue();
          }),
        ready: (page) => page.getByRole("combobox", { name: "Buscar palabras" }).waitFor(),
      },
      async (page) => {
        await page.getByRole("combobox", { name: "Buscar palabras" }).pressSequentially("carn");
        await page.getByRole("option", { name: "Buscando..." }).waitFor();
        if (!(await page.getByRole("option", { name: 'Buscar "carn"' }).count()))
          throw new Error('no "Buscar" option while the lookup is still waiting');
        await page.locator("[role=option][data-suggestion]").first().waitFor();
      }
    );

    await step("pagination-next", "home", async (page) => {
      const next = page.getByRole("button", { name: "Siguiente" });
      await page.waitForFunction(() =>
        [...document.querySelectorAll("button")].some(
          (b) => b.textContent?.trim() === "Siguiente" && !b.disabled
        )
      );
      // Clicked from the bottom of the list, the new page starts at the top, and the result
      // line names it.
      await next.scrollIntoViewIfNeeded();
      await next.click();
      await page.waitForURL(/after=/);
      await cardsAre(12)(page);
      const scrolled = await page.evaluate(() => scrollY);
      if (scrolled > 0) throw new Error(`page 2 opened scrolled ${scrolled}px down`);
      // The page sits on the right of the result line, level with the count.
      const row = await page.evaluate(() => {
        const count = document.querySelector("p[aria-live]");
        const label = count?.nextElementSibling;
        if (!count || !label) return null;
        const a = count.getBoundingClientRect();
        const b = label.getBoundingClientRect();
        return {
          text: label.textContent?.trim(),
          right: b.left >= a.right,
          level: Math.abs(a.bottom - b.bottom) < 4,
        };
      });
      if (!row || !/^Página 2 de \d+$/.test(row.text ?? "") || !row.right || !row.level)
        throw new Error(`page label not on the right of the result line: ${JSON.stringify(row)}`);
      // Back to page 1 with "Anterior": focus moves to the page number without scrolling.
      const previous = page.getByRole("button", { name: "Anterior" });
      await previous.scrollIntoViewIfNeeded();
      await previous.click();
      await cardsAre(0)(page);
      await page.waitForFunction(() =>
        document.activeElement?.matches("button[aria-current=page]")
      );
      const back = await page.evaluate(() => scrollY);
      if (back > 0) throw new Error(`page 1 opened scrolled ${back}px down`);
    });

    await step("suggestion-keyboard", "home", async (page) => {
      const input = page.getByRole("combobox", { name: "Buscar palabras" });
      await input.fill(sample.word);
      await page.locator("[role=option][data-suggestion]").first().waitFor();
      // Up from no highlight wraps to the last suggestion, and Down from there back to none.
      const activeText = () =>
        page.evaluate(() => {
          const id = document
            .querySelector("input[role=combobox]")
            ?.getAttribute("aria-activedescendant");
          return id ? (document.getElementById(id)?.textContent?.trim() ?? null) : null;
        });
      await input.press("ArrowUp");
      const last = await page.locator("[role=option][data-suggestion]").last().textContent();
      if ((await activeText()) !== last?.trim())
        throw new Error("Up from no highlight did not wrap to the last suggestion");
      await input.press("ArrowDown");
      if ((await activeText()) !== null)
        throw new Error("Down from the last suggestion did not clear the highlight");
      // The first option searches the typed text; the second is the first suggestion.
      await input.press("ArrowDown");
      await input.press("ArrowDown");
      const chosen = await page.evaluate(() => {
        const input = document.querySelector("input[role=combobox]");
        const id = input?.getAttribute("aria-activedescendant");
        return id ? document.getElementById(id)?.querySelector("span")?.textContent?.trim() : null;
      });
      if (!chosen) throw new Error("ArrowDown did not highlight a suggestion");
      await input.press("Enter");
      await page.waitForURL(/\?word=/);
      await wordShows(chosen)(page);
    });

    await step("search-typed-option", "home", async (page) => {
      // A term with no suggestion offers to search it, never a dead "Sin resultados"; the
      // option does what Enter does, by mouse and by keyboard.
      const term = "zzqxjwv";
      const input = page.getByRole("combobox", { name: "Buscar palabras" });
      await input.fill(term);
      const option = page.getByRole("option", { name: `Buscar "${term}"` });
      await option.waitFor();
      await page.waitForFunction(
        () => document.querySelector("[role=listbox]")?.getAttribute("aria-busy") === "false"
      );
      if (await page.getByText("Sin resultados").count()) throw new Error('"Sin resultados" shows');
      await option.click();
      await page.waitForURL(new RegExp(`\\?q=${term}`));
      await page.getByText("No encontramos palabras para esta búsqueda.").waitFor();
      // Keyboard: Down highlights it, Enter runs it. The pointer moves away first, or hovering
      // where the option was clicked would highlight whatever renders under it.
      await page.mouse.move(0, 0);
      await input.fill("carnaval");
      await page.locator("[role=option][data-suggestion]").first().waitFor();
      // Down, Down, Up lands on the first option again (checked below), and Enter searches.
      await input.press("ArrowDown");
      await input.press("ArrowDown");
      await input.press("ArrowUp");
      const active = await page.evaluate(() => {
        const id = document
          .querySelector("input[role=combobox]")
          ?.getAttribute("aria-activedescendant");
        return id ? document.getElementById(id)?.textContent?.replace(/\s+/g, " ").trim() : null;
      });
      if (active !== 'Buscar "carnaval"') throw new Error(`ArrowDown highlighted ${active}`);
      await input.press("Enter");
      await page.waitForURL(
        (url) => url.searchParams.get("q") === "carnaval" && !url.searchParams.has("word")
      );
      await searchShows("carnaval")(page);
    });

    await step("letter-browse", "home", async (page) => {
      await page.getByRole("link", { name: /^M, \d+ palabras$/ }).click();
      await page.waitForURL(/\?letter=M/);
      await letterShows("M")(page);
      // The current letter is marked exactly like the current page: one style for "current".
      // Waits out the 150 ms color transition the click starts.
      await page
        .waitForFunction(
          () => {
            const mark = (selector: string) => {
              const el = document.querySelector(selector);
              if (!el) return null;
              const st = getComputedStyle(el);
              return `${st.borderTopWidth} ${st.borderTopColor} ${st.backgroundColor}`;
            };
            const letter = mark('nav[aria-label="Navegación por letras"] a[aria-current=page]');
            return letter !== null && letter === mark("button[aria-current=page]");
          },
          null,
          { timeout: 2000 }
        )
        .catch(() => {
          throw new Error("the current letter is not marked like the current page");
        });
    });

    await step("letter-pagination", "letter", async (page) => {
      const expected = words.filter((w) => filedUnder(w.word) === "M");
      await page.getByRole("button", { name: "Siguiente" }).click();
      await page.waitForURL(/letter=M.*after=|after=.*letter=M/);
      await page.waitForFunction(
        (word) => document.querySelector("article h2")?.textContent?.trim() === word,
        expected[12].word
      );
      await letterShows("M")(page);
    });

    await step("letter-to-all", "letter", async (page) => {
      await page.getByRole("link", { name: "Todas" }).click();
      await page.waitForURL((url) => url.pathname === "/" && url.search === "");
      await welcomeShows(page);
    });

    await step("letter-accent", "home", async (page) => {
      await page.goto(`${ORIGIN}/?letter=${encodeURIComponent("é")}`);
      await letterShows("E")(page);
    });

    await step("page-back", "home", async (page) => {
      await page.getByRole("button", { name: "Siguiente" }).click();
      await page.waitForURL(/after=/);
      await cardsAre(12)(page);
      await page.getByRole("button", { name: "Anterior" }).click();
      await page.waitForURL((url) => url.pathname === "/" && url.search === "");
      await welcomeShows(page);
    });

    await step("search-paging-history", "search", async (page) => {
      await page.goto(`${ORIGIN}/?q=de`);
      await page.waitForFunction(() => document.querySelector("button[aria-current=page]"));
      const first = await page.locator("article h2").first().innerText();
      const next = page.getByRole("button", { name: "Siguiente" });
      await next.click();
      await page.waitForURL(/after=/);
      // Paging keeps keyboard focus on the pager, and Back returns to the previous page.
      const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
      if (focused !== "Siguiente") throw new Error(`focus after paging is on "${focused}"`);
      await page.goBack();
      await page.waitForFunction(
        (w) => document.querySelector("article h2")?.textContent?.trim() === w,
        first.trim()
      );
      if (!page.url().includes("q=de") || page.url().includes("after="))
        throw new Error(`Back went to ${page.url()}`);
    });

    await step("clear-search", "search", async (page) => {
      const input = page.getByRole("combobox", { name: "Buscar palabras" });
      await input.fill("");
      await input.press("Enter");
      await page.waitForURL((url) => url.pathname === "/" && url.search === "");
      await welcomeShows(page);
    });

    await step("accents-fold", "home", async (page) => {
      // The count line renders once the search resolved.
      const counted = () =>
        page.waitForFunction(() =>
          [...document.querySelectorAll("p[aria-live]")].some((h) =>
            /^\d+ palabras? encontradas? para /.test(
              h.textContent?.replace(/\s+/g, " ").trim() ?? ""
            )
          )
        );
      await page.goto(`${ORIGIN}/?q=aja`);
      await counted();
      const plain = await page.locator("article h2").allInnerTexts();
      await page.goto(`${ORIGIN}/?q=${encodeURIComponent("ajá")}`);
      await counted();
      const accented = await page.locator("article h2").allInnerTexts();
      if (plain.join("|") !== accented.join("|"))
        throw new Error(`"aja" shows ${plain.length} words, "ajá" shows ${accented.length}`);
    });

    await step(
      "word-not-found",
      {
        // A link to a missing word is a real 404, with the page's own message.
        path: "/?word=nope",
        allowStatus: [404],
        allowConsole: [/status of 404/],
        ready: (page) => page.getByText("No encontramos la palabra solicitada.").waitFor(),
      },
      async (page) => {
        if (await page.getByRole("button", { name: "Siguiente" }).count())
          throw new Error("a missing word still shows the pager");
        await page.getByRole("link", { name: "Ver todas las palabras" }).click();
        await welcomeShows(page);
      }
    );

    await step("not-found-home", "not-found", async (page) => {
      await page.getByText("Ya no recibimos palabras desde la web.", { exact: false }).waitFor();
      await page.getByRole("link", { name: "Volver al inicio" }).click();
      await page.waitForURL((url) => url.pathname === "/");
      await welcomeShows(page);
    });

    await context.close();
  }
}

/** Tabs through each focus page and checks every stop shows a visible ring. */
async function auditFocus(browser: Browser) {
  for (const viewport of VIEWPORTS.filter((v) => DESIGN.focusViewports.includes(v.name)))
    for (const scheme of SCHEMES) {
      const context = await newContext(browser, viewport, scheme);
      for (const name of DESIGN.focusPages) {
        // focusPages names pages in PAGES.
        const spec = PAGES.find((p) => p.name === name)!;
        if (ONLY && ONLY !== name) continue;
        const where = `focus:${name}@${viewport.name}/${scheme}`;
        const { page } = await openPage(context, spec, where);
        for (let i = 0; i < DESIGN.maxFocusStops; i++) {
          await page.keyboard.press("Tab");
          // Links and inputs transition their outline; read it after the transition's first frames.
          await page.evaluate(
            () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
          );
          const ring = (await page.evaluate(measure, {
            design: DESIGN,
            focusOnly: true,
          })) as FocusRing | null;
          if (!ring) continue;
          if (ring.wrapped) break;
          if (!ring.ok) designIssues.push(`${where}: focus ${ring.why} ${ring.where}`);
        }
        await page.close();
      }
      await context.close();
    }
}

async function main() {
  if (BUILD) run(...viteCommand("build"));
  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const server = await startPreview();
  let browser: Browser | undefined;
  try {
    // Launched inside the try, so a missing browser build never leaves the server running.
    browser = await chromium.launch();
    if (!ONLY) await auditMachineReadable(fail);
    await auditPages(browser);
    await auditFlows(browser);
    await auditFocus(browser);
  } finally {
    await browser?.close();
    server.kill();
  }

  report.failures = failures;
  report.designIssues = designIssues;
  writeFileSync(resolve(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

  // Group findings that differ only by page, viewport, scheme or element text,
  // so one repeated class shows as one line with an example.
  const summarize = (title: string, list: string[], { ignoreText = false } = {}) => {
    const groups = new Map<string, { example: string; wheres: Set<string>; count: number }>();
    for (const line of list) {
      const split = line.indexOf(": ");
      const where = line.slice(0, split);
      const what = line.slice(split + 2).split("\n")[0];
      const key = ignoreText ? what.replace(/ "[^"]*"/, "") : what;
      if (!groups.has(key)) groups.set(key, { example: what, wheres: new Set(), count: 0 });
      const group = groups.get(key)!; // set just above
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
