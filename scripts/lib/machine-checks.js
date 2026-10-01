/**
 * What agents and crawlers get without a browser: raw HTML, the Markdown version of the home
 * page, the sitemap, robots.txt, llms.txt, the OpenAPI document and the API with its errors.
 * Plain HTTP against the preview server; every finding is a hard failure.
 */

import { ORIGIN, sample, words } from "./app-states.js";
import { firstLetter } from "../../src/lib/text.js";

const SITE = "https://monocuco.sjdonado.com";
const MIN_TEXT = 500;

// Visible text of the <main> element, as a client that does not run JavaScript reads it.
const mainText = (html) =>
  (/<main[^>]*>([\s\S]*)<\/main>/.exec(html)?.[1] ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const headings = (html) =>
  [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => ({
    level: Number(m[1]),
    text: m[2].replace(/<[^>]+>/g, "").trim(),
  }));

const attr = (html, pattern) => new RegExp(pattern).exec(html)?.[1] ?? null;

export async function auditMachineReadable(fail) {
  const get = (path, headers = {}, init = {}) =>
    fetch(ORIGIN + path, { headers, redirect: "manual", ...init });

  // Pages: content, one h1, sequential headings and metadata, before any JavaScript runs.
  const pages = [
    { path: "/", h1: /Monocuco/, text: words[0].word },
    // A word page is as long as its definition: it must carry the word, not 500 characters.
    {
      path: `/?word=${encodeURIComponent(sample.id)}`,
      h1: sample.word,
      text: sample.definition.replace(/[*_]/g, "").slice(0, 40),
      min: 0,
    },
    {
      path: "/?letter=M",
      h1: /Palabras con M/,
      text: words.find((w) => firstLetter(w.word) === "M").word,
    },
    { path: "/about", h1: /Acerca de/ },
    { path: "/contact", h1: /Contacto/ },
    { path: "/privacy", h1: /Privacidad/ },
    { path: "/guidelines", h1: /Pautas/ },
  ];
  for (const spec of pages) {
    const where = `raw ${spec.path}`;
    const res = await get(spec.path, { accept: "text/html" });
    const html = await res.text();
    if (res.status !== 200) fail(where, `status ${res.status}`);
    const text = mainText(html);
    if (text.length < (spec.min ?? MIN_TEXT))
      fail(
        where,
        `${text.length} characters of content without JavaScript (at least ${spec.min ?? MIN_TEXT})`
      );
    if (spec.text && !text.includes(spec.text))
      fail(where, `does not contain "${spec.text}" without JavaScript`);
    const hs = headings(html);
    const h1s = hs.filter((h) => h.level === 1);
    if (h1s.length !== 1) fail(where, `${h1s.length} h1 elements in the HTML`);
    else if (typeof spec.h1 === "string" ? h1s[0].text !== spec.h1 : !spec.h1.test(h1s[0].text))
      fail(where, `h1 "${h1s[0].text}"`);
    hs.forEach((h, i) => {
      if (i > 0 && h.level > hs[i - 1].level + 1)
        fail(where, `h${h.level} "${h.text}" skips a level`);
    });
    if (!/<html lang="es"/.test(html)) fail(where, "no lang=es");
    const canonical = attr(html, '<link rel="canonical" href="([^"]+)"');
    if (!canonical?.startsWith(SITE)) fail(where, `canonical "${canonical}"`);
    if (!/<meta property="og:type" content="website"/.test(html)) fail(where, "no og:type");
    if (!/<meta property="og:image" content="https:\/\//.test(html))
      fail(where, "no absolute og:image");
    if (spec.path.startsWith("/?") || spec.path === "/") {
      const jsonLd = attr(html, '<script type="application/ld\\+json">([\\s\\S]*?)</script>');
      try {
        const graph = JSON.parse(jsonLd ?? "")["@graph"];
        const type = spec.path.includes("word=") ? "DefinedTerm" : "WebSite";
        if (!graph.some((node) => node["@type"] === type)) fail(where, `JSON-LD has no ${type}`);
      } catch {
        fail(where, "no valid JSON-LD");
      }
    }
  }

  // A link to a word that does not exist is a 404 in HTML too, not a soft 404.
  const missingWord = await get("/?word=does-not-exist", { accept: "text/html" });
  await missingWord.body?.cancel();
  if (missingWord.status !== 404) fail("raw /?word=does-not-exist", `status ${missingWord.status}`);

  // Markdown negotiation on the home page, and HTML for everyone else.
  const md = await get("/", { accept: "text/markdown" });
  const mdBody = await md.text();
  if (md.status !== 200 || !md.headers.get("content-type")?.startsWith("text/markdown"))
    fail("markdown /", `Accept: text/markdown got ${md.status} ${md.headers.get("content-type")}`);
  if (!/\baccept\b/i.test(md.headers.get("vary") ?? "")) fail("markdown /", "no Vary: Accept");
  // The adapter's edge cache keys on the URL alone; a cacheable Markdown response would reach browsers.
  if (md.headers.get("cache-control"))
    fail("markdown /", `cache-control "${md.headers.get("cache-control")}"`);
  if (!mdBody.startsWith("# ") || !mdBody.includes(`## ${words[0].word}`))
    fail("markdown /", "body is not the home page in Markdown");
  for (const accept of [
    "text/html",
    "text/html,application/xhtml+xml,*/*;q=0.8",
    "*/*",
    "text/markdown;q=0.5, */*",
  ]) {
    const res = await get("/", { accept });
    await res.body?.cancel();
    if (!res.headers.get("content-type")?.startsWith("text/html"))
      fail("markdown /", `Accept: ${accept} got ${res.headers.get("content-type")}`);
    if (!/\baccept\b/i.test(res.headers.get("vary") ?? ""))
      fail("markdown /", `no Vary: Accept for ${accept}`);
  }

  // An unknown address answers in JSON to a client that asks for JSON.
  const unknownJson = await get("/no-such-page", { accept: "application/json" });
  if (
    unknownJson.status !== 404 ||
    !unknownJson.headers.get("content-type")?.startsWith("application/problem+json")
  )
    fail(
      "raw /no-such-page",
      `Accept: application/json got ${unknownJson.status} ${unknownJson.headers.get("content-type")}`
    );
  await unknownJson.body?.cancel();

  // robots.txt, sitemap.xml, llms.txt.
  const robots = await (await get("/robots.txt")).text();
  if (!robots.includes(`Sitemap: ${SITE}/sitemap.xml`)) fail("robots.txt", "no Sitemap line");
  const sitemapRes = await get("/sitemap.xml");
  const sitemap = await sitemapRes.text();
  if (!/xml/.test(sitemapRes.headers.get("content-type") ?? ""))
    fail("sitemap.xml", "not served as XML");
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) =>
    m[1].replace(/&amp;/g, "&")
  );
  if (!sitemap.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'))
    fail("sitemap.xml", "no sitemap namespace");
  if (locs.some((l) => !l.startsWith(`${SITE}/`))) fail("sitemap.xml", "a URL is not on the site");
  if (/&(?!amp;|lt;|gt;)/.test(sitemap)) fail("sitemap.xml", "unescaped &");
  const missing = words.filter((w) => !locs.includes(`${SITE}/?word=${encodeURIComponent(w.id)}`));
  if (missing.length) fail("sitemap.xml", `${missing.length} words missing`);
  for (const path of ["/", "/about", "/contact", "/privacy", "/guidelines"])
    if (!locs.includes(SITE + path)) fail("sitemap.xml", `no ${path}`);
  const llms = await (await get("/llms.txt")).text();
  if (!/^# Monocuco\n\n> /.test(llms)) fail("llms.txt", "does not start with an h1 and a summary");
  // llmstxt.org: free text (here the when-to-use section) comes before the first H2, and
  // every H2 section is a list of links.
  const [intro, ...sections] = llms.split(/^## /m);
  if (!/\*\*When to use Monocuco:\*\*/.test(intro))
    fail("llms.txt", "no when-to-use section before the first H2");
  for (const section of sections) {
    const items = section
      .split("\n")
      .slice(1)
      .filter((line) => line.trim());
    if (items.some((line) => !/^- \[[^\]]+\]\(https?:\/\/[^)]+\)(: .+)?$/.test(line)))
      fail("llms.txt", `section "${section.split("\n")[0]}" is not a list of links`);
  }
  if (!llms.includes(`${SITE}/openapi.json`))
    fail("llms.txt", "does not link the OpenAPI document");

  // The OpenAPI document, and each documented endpoint answering as documented.
  const spec = await (await get("/openapi.json")).json();
  if (spec.openapi !== "3.1.0") fail("openapi.json", `openapi "${spec.openapi}"`);
  for (const path of ["/api/words", "/api/words/{id}"])
    if (!spec.paths?.[path]?.get) fail("openapi.json", `no GET ${path}`);
  const required = spec.components.schemas.WordPage.required;
  const list = await get("/api/words?q=carnaval");
  const listBody = await list.json();
  if (list.status !== 200 || required.some((k) => !(k in listBody)))
    fail("api", `GET /api/words?q=carnaval: ${list.status}, keys ${Object.keys(listBody)}`);
  if (!listBody.items?.length) fail("api", "search for carnaval found nothing");
  if (listBody.next) {
    const next = await get(new URL(listBody.next).pathname + new URL(listBody.next).search);
    if (next.status !== 200 || (await next.json()).page !== 2)
      fail("api", "next link does not open page 2");
  }
  const one = await get(`/api/words/${encodeURIComponent(sample.id)}`);
  const oneBody = await one.json();
  if (one.status !== 200 || oneBody.word !== sample.word)
    fail("api", `GET /api/words/{id}: ${one.status}`);

  // Every error is an RFC 9457 problem document with the documented code.
  const codes = spec.components.schemas.Problem.properties.code.enum;
  const errors = [
    ["/api/words/does-not-exist", 404, "word_not_found"],
    ["/api/words?letter=MM", 400, "invalid_letter"],
    ["/api/words?limit=0", 400, "invalid_limit"],
    ["/api/words?q=a&letter=b", 400, "conflicting_parameters"],
    ["/api/words?after=nope", 400, "invalid_cursor"],
    ["/api/words?page=2", 400, "unknown_parameter"],
    ["/api/nothing/here", 404, "not_found"],
    ["/api/words", 405, "method_not_allowed", "POST"],
  ];
  const preflight = await get("/api/words", {}, { method: "OPTIONS" });
  if (preflight.status !== 204 || preflight.headers.get("access-control-allow-origin") !== "*")
    fail("api OPTIONS /api/words", `status ${preflight.status}`);
  for (const [path, status, code, method = "GET"] of errors) {
    const where = `api ${method} ${path}`;
    const res = await get(path, { accept: "application/json" }, { method });
    const type = res.headers.get("content-type") ?? "";
    const body = await res.json().catch(() => null);
    if (res.status !== status) fail(where, `status ${res.status} (expected ${status})`);
    if (!type.startsWith("application/problem+json")) fail(where, `content-type ${type}`);
    if (
      body?.code !== code ||
      body?.status !== status ||
      !body?.hint ||
      !body?.detail ||
      !body?.title
    )
      fail(where, `body ${JSON.stringify(body)}`);
    if (!codes.includes(code)) fail(where, `code ${code} is not in the OpenAPI document`);
  }
}
