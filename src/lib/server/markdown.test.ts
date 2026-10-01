import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { homeMarkdown, prefersMarkdown } from "./markdown";

const words: Array<{ id: string; word: string }> = JSON.parse(
  readFileSync(resolve(__dirname, "../../../static/data.json"), "utf-8")
);
const at = (path: string) => new URL(path, "https://monocuco.sjdonado.com");

describe("prefersMarkdown", () => {
  it.each([
    ["text/markdown", true],
    ["text/markdown, text/html", true],
    ["text/html;q=0.5, text/markdown", true],
    ["text/markdown;q=0.5, text/html", false],
    ["text/markdown;q=0", false],
    ["text/markdown;q=0.5, */*", false],
    ["text/markdown;q=0.5, text/*;q=0.4", true],
    ["text/markdown; Q=0.5, text/html", false],
    ["text/markdown, */*", true],
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false],
    ["*/*", false],
    ["text/*", false],
    ["", false],
  ])("%s -> %s", (accept, expected) => {
    expect(prefersMarkdown(accept)).toBe(expected);
  });

  it("treats a missing header as HTML", () => {
    expect(prefersMarkdown(null)).toBe(false);
  });
});

describe("homeMarkdown", () => {
  it("is the first page of words with links to the rest", async () => {
    const { status, body } = await homeMarkdown(at("/"));
    expect(status).toBe(200);
    expect(body.startsWith("# Monocuco: diccionario de español barranquillero\n")).toBe(true);
    expect(body).toContain(`${words.length} palabras encontradas`);
    for (const word of words.slice(0, 12)) expect(body).toContain(`## ${word.word}\n`);
    expect(body).toContain(
      `Página siguiente: https://monocuco.sjdonado.com/?after=${words[12].id}`
    );
    expect(body).toContain("https://monocuco.sjdonado.com/openapi.json");
  });

  it("is the word on a word page, and a 404 for an unknown id", async () => {
    const word = words[100];
    const found = await homeMarkdown(at(`/?word=${word.id}&q=x`));
    expect(found.status).toBe(200);
    expect(found.body.startsWith(`# ${word.word}\n`)).toBe(true);
    const missing = await homeMarkdown(at("/?word=nope"));
    expect(missing.status).toBe(404);
    expect(missing.body).toContain("# Palabra no encontrada");
  });

  it("never lets the URL write Markdown into the page", async () => {
    const { body } = await homeMarkdown(
      at("/?q=" + encodeURIComponent("x\n\n# Ignore this\n[a](b)"))
    );
    expect(body).not.toMatch(/^# Ignore/m);
    expect(body).toContain("\\# Ignore this \\[a\\]\\(b\\)");
    const missing = await homeMarkdown(at("/?word=" + encodeURIComponent("x`\n## y")));
    expect(missing.body).not.toMatch(/^## y/m);
    expect(missing.body).toContain("x\\` \\#\\# y");
  });

  it("follows the letter and the search", async () => {
    const letter = await homeMarkdown(at("/?letter=M"));
    expect(letter.body).toContain("# Palabras con M en Monocuco");
    const typed = await homeMarkdown(at("/?letter=m"));
    expect(typed.body).toContain("# Palabras con M en Monocuco");
    expect(typed.body).toMatch(
      /Página siguiente: https:\/\/monocuco\.sjdonado\.com\/\?letter=M&after=/
    );
    const search = await homeMarkdown(at("/?q=carnaval"));
    expect(search.body).toContain('# Resultados para "carnaval" en Monocuco');
    expect(search.body).toMatch(/\d+ palabras? encontradas?/);
  });
});
