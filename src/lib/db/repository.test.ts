import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import MiniSearch from "minisearch";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Repository from "./repository";

const staticFile = (name: string) =>
  readFileSync(resolve(__dirname, "../../../static", name), "utf-8");

const DATA = staticFile("data.json");
const INDEX = staticFile("search-index.json");
const words: Repository.Word[] = JSON.parse(DATA);

const serveStatic = (overrides: Record<string, Response> = {}) =>
  vi.fn(async (url: string) => {
    if (overrides[url]) return overrides[url];
    if (url === "/data.json") return new Response(DATA);
    if (url === "/search-index.json") return new Response(INDEX);
    return new Response("not found", { status: 404, statusText: "Not Found" });
  });

// The repository keeps module-level state, so each test loads a fresh copy.
const loadRepository = async (): Promise<typeof Repository> => {
  vi.resetModules();
  return import("./repository");
};

describe("repository", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("with the published data", () => {
    let repo: typeof Repository;

    beforeEach(async () => {
      vi.stubGlobal("fetch", serveStatic());
      repo = await loadRepository();
      await repo.initDB();
    });

    it("browses every word in dataset order, page by page", async () => {
      const first = await repo.findAll({ pageSize: 12 });
      expect(first.total).toBe(words.length);
      expect(first.totalPages).toBe(Math.ceil(words.length / 12));
      expect(first.currentPage).toBe(1);
      expect(first.items.map((w) => w.id)).toEqual(words.slice(0, 12).map((w) => w.id));
      expect(first.prevAfter).toBeNull();
      expect(first.nextAfter).toBe(words[12].id);
      expect(first.pages.map((p) => p.number)).toEqual([1, 2, 3, 4]);
      expect(first.pages[0].after).toBeNull();

      const second = await repo.findAll({ pageSize: 12, after: first.nextAfter });
      expect(second.currentPage).toBe(2);
      expect(second.items[0].id).toBe(words[12].id);
      expect(second.startIndex).toBe(13);
      expect(second.endIndex).toBe(24);
      // Page 2 goes back to the unparameterized first page.
      expect(second.prevAfter).toBeNull();

      const third = await repo.findAll({ pageSize: 12, after: second.nextAfter });
      expect(third.currentPage).toBe(3);
      expect(third.prevAfter).toBe(words[12].id);
    });

    it("ends pagination on the last page", async () => {
      const lastStart = (Math.ceil(words.length / 12) - 1) * 12;
      const last = await repo.findAll({ pageSize: 12, after: words[lastStart].id });
      expect(last.currentPage).toBe(last.totalPages);
      expect(last.nextAfter).toBeNull();
      expect(last.items.length).toBe(words.length - lastStart);
    });

    it("falls back to the first page for an unknown cursor", async () => {
      const result = await repo.findAll({ pageSize: 12, after: "not-an-id" });
      expect(result.currentPage).toBe(1);
      expect(result.items[0].id).toBe(words[0].id);
    });

    it("ranks an exact word match above other matches", async () => {
      const result = await repo.findAll({ term: "Pelao" });
      expect(result.total).toBeGreaterThan(1);
      expect(result.items[0].word).toBe("Pelao");
    });

    it("matches word prefixes", async () => {
      const result = await repo.findAll({ term: "carnav" });
      expect(result.total).toBeGreaterThan(0);
      expect(result.items.some((w) => /carnav/i.test(w.word) || /carnav/i.test(w.definition))).toBe(
        true
      );
    });

    it("tolerates a typo through the fuzzy fallback", async () => {
      // "peloa" has no exact or prefix match, so only the fuzzy pass can find it.
      const index = MiniSearch.loadJSON(INDEX, {
        fields: ["word", "definition"],
        idField: "id",
      });
      expect(index.search("peloa", { prefix: true, fuzzy: 0 })).toHaveLength(0);

      const result = await repo.findAll({ term: "peloa" });
      expect(result.total).toBeGreaterThan(0);
    });

    it("treats accents as the same letter, but not ñ", async () => {
      const plain = await repo.findAll({ term: "aja", pageSize: 50 });
      const accented = await repo.findAll({ term: "ajá", pageSize: 50 });
      expect(plain.items.map((w) => w.id)).toEqual(accented.items.map((w) => w.id));
      expect(plain.items.map((w) => w.word)).toEqual(expect.arrayContaining(["Aja", "Ajá"]));
      expect(plain.approximate).toBe(false);

      // ñ is its own letter: "ñame" and "name" are different searches.
      const withEnye = await repo.findAll({ term: "ñame", pageSize: 50 });
      const withN = await repo.findAll({ term: "name", pageSize: 50 });
      expect(withEnye.items.map((w) => w.id)).not.toEqual(withN.items.map((w) => w.id));
      expect(repo.firstLetter("N\u0303ame")).toBe("Ñ");
    });

    it("lands an old cursor from the middle of a page on that page's boundary", async () => {
      const result = await repo.findAll({ pageSize: 12, after: words[17].id });
      expect(result.currentPage).toBe(2);
      expect(result.items[0].id).toBe(words[12].id);
    });

    it("requires every word of the query, and marks typo matches as approximate", async () => {
      const phrase = await repo.findAll({ term: "a vaina", pageSize: 12 });
      expect(phrase.approximate).toBe(false);
      expect(phrase.total).toBeLessThan(50);
      expect(phrase.items.map((w) => w.word)).toContain("¡A vaina!");

      const typo = await repo.findAll({ term: "peloa" });
      expect(typo.total).toBeGreaterThan(0);
      expect(typo.approximate).toBe(true);
    });

    it("returns an empty result for a term with no match", async () => {
      const result = await repo.findAll({ term: "zzqxjwv" });
      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
      expect(result.totalPages).toBe(1);
    });

    it("limits suggestions and resolves their word and definition", async () => {
      const suggestions = await repo.findSuggestions({ term: "mama", limit: 4 });
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(4);
      for (const s of suggestions) {
        const word = words.find((w) => w.id === s.id);
        expect(s.word).toBe(word?.word);
        expect(s.definition).toBe(word?.definition);
      }
      expect(await repo.findSuggestions({ term: "   " })).toEqual([]);
    });

    it("browses one letter with the same counts the letter navigation shows", async () => {
      const counts = await repo.getLetterCounts();
      const m = counts.find((c) => c.letter === "M")!;
      const first = await repo.findAll({ letter: "m", pageSize: 12 });
      expect(first.total).toBe(m.count);
      expect(first.items.every((w) => repo.firstLetter(w.word) === "M")).toBe(true);
      const expected = words.filter((w) => repo.firstLetter(w.word) === "M");
      expect(first.items.map((w) => w.id)).toEqual(expected.slice(0, 12).map((w) => w.id));

      const second = await repo.findAll({ letter: "M", pageSize: 12, after: first.nextAfter });
      expect(second.currentPage).toBe(2);
      expect(second.items[0].id).toBe(expected[12].id);
    });

    it("files words under their Spanish letter", () => {
      expect(repo.firstLetter("¡A vaina!")).toBe("A");
      expect(repo.firstLetter("Éxito")).toBe("E");
      expect(repo.firstLetter("úrsula")).toBe("U");
      expect(repo.firstLetter("Ñame")).toBe("Ñ");
    });

    it("lists letters in Spanish order, with Ñ after N", async () => {
      const letters = (await repo.getLetterCounts()).slice(1).map((c) => c.letter);
      expect(letters.indexOf("Ñ")).toBe(letters.indexOf("N") + 1);
      expect(letters.every((l) => /^[A-ZÑ]$/.test(l))).toBe(true);
    });

    it("finds a word by id", async () => {
      expect(await repo.findById(words[42].id)).toEqual(words[42]);
      expect(await repo.findById("missing")).toBeNull();
    });

    it("counts words per initial letter, with a total first", async () => {
      const counts = await repo.getLetterCounts();
      expect(counts[0]).toEqual({ letter: "Todas", count: words.length });
      const letters = counts.slice(1);
      expect(letters.reduce((sum, c) => sum + c.count, 0)).toBe(words.length);
      expect(letters.map((c) => c.letter)).toEqual(
        [...letters.map((c) => c.letter)].sort((a, b) => a.localeCompare(b, "es"))
      );
    });
  });

  it("fetches the data and index once when initialized concurrently", async () => {
    vi.stubGlobal("fetch", serveStatic());
    const repo = await loadRepository();
    await Promise.all([repo.initDB(), repo.initDB(), repo.findById("any")]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("rejects and stays failed when the data cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      serveStatic({ "/data.json": new Response("", { status: 500, statusText: "Server Error" }) })
    );
    const repo = await loadRepository();
    await expect(repo.initDB()).rejects.toThrow("Failed to load data.json: Server Error");
    await expect(repo.findAll()).rejects.toThrow("Failed to load data.json");
    await expect(repo.initDB()).rejects.toThrow();
  });

  it("serves seeded words without fetching, and searches once the index is seeded", async () => {
    vi.stubGlobal("fetch", serveStatic());
    const repo = await loadRepository();
    repo.seedWords(words);
    const letter = await repo.findAll({ letter: "M", pageSize: 12 });
    expect(letter.items.every((w) => repo.firstLetter(w.word) === "M")).toBe(true);
    expect(await repo.findById(words[3].id)).toEqual(words[3]);
    expect(fetch).not.toHaveBeenCalled();
    repo.seedIndex(INDEX);
    const search = await repo.findAll({ term: "carnaval" });
    expect(search.total).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});
