import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { GET as list, fallback as listFallback } from "./words/+server";
import { GET as one, OPTIONS } from "./words/[id]/+server";
import { fallback as unknown } from "./[...path]/+server";

const root = resolve(__dirname, "../../..");
const words: Array<{ id: string; word: string }> = JSON.parse(
  readFileSync(resolve(root, "static/data.json"), "utf-8")
);
const openapi = JSON.parse(readFileSync(resolve(root, "static/openapi.json"), "utf-8"));

// The handlers read only `url`, `params` and `request`.
const event = (path: string, params: Record<string, string> = {}, method = "GET") =>
  ({
    url: new URL(path, "https://monocuco.sjdonado.com"),
    params,
    request: new Request(new URL(path, "https://monocuco.sjdonado.com"), { method }),
  }) as never;

const expectProblem = async (response: Response, status: number, code: string) => {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toBe("application/problem+json");
  const body = await response.json();
  expect(body).toMatchObject({ type: "about:blank", status, code });
  expect(body.title).toBeTruthy();
  expect(body.detail).toBeTruthy();
  expect(body.hint).toBeTruthy();
  expect(openapi.components.schemas.Problem.properties.code.enum).toContain(code);
};

describe("GET /api/words", () => {
  it("browses in dictionary order with absolute page links", async () => {
    const response = await list(event("/api/words?limit=2"));
    const body = await response.json();
    expect(body.items.map((w: { id: string }) => w.id)).toEqual([words[0].id, words[1].id]);
    expect(body).toMatchObject({
      total: words.length,
      page: 1,
      previous: null,
      approximate: false,
    });
    expect(body.next).toBe(`https://monocuco.sjdonado.com/api/words?limit=2&after=${words[2].id}`);
    expect(body.items[0].url).toBe(`https://monocuco.sjdonado.com/?word=${words[0].id}`);
    for (const key of openapi.components.schemas.WordPage.required)
      expect(body).toHaveProperty(key);
    for (const key of openapi.components.schemas.Word.required)
      expect(body.items[0]).toHaveProperty(key);
  });

  it("searches, and pages through a search", async () => {
    const first = await (await list(event("/api/words?q=carnaval&limit=1"))).json();
    expect(first.total).toBeGreaterThan(1);
    const second = await (
      await list(event(new URL(first.next).pathname + new URL(first.next).search))
    ).json();
    expect(second.page).toBe(2);
    expect(second.previous).toBe("https://monocuco.sjdonado.com/api/words?q=carnaval&limit=1");
  });

  it("browses a letter, folding accents", async () => {
    const body = await (await list(event("/api/words?letter=é"))).json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.next ?? "").not.toContain("letter=%C3%A9");
  });

  it("folds a decomposed accent like a composed one", async () => {
    const composed = await (await list(event("/api/words?letter=%C3%A9"))).json();
    const decomposed = await (await list(event("/api/words?letter=e%CC%81"))).json();
    expect(decomposed.total).toBe(composed.total);
  });

  it.each([
    ["/api/words?letter=MM", "invalid_letter"],
    ["/api/words?letter=1", "invalid_letter"],
    ["/api/words?limit=0", "invalid_limit"],
    ["/api/words?limit=51", "invalid_limit"],
    ["/api/words?limit=2.5", "invalid_limit"],
    ["/api/words?limit=1e1", "invalid_limit"],
    ["/api/words?q=a&letter=b", "conflicting_parameters"],
    ["/api/words?after=nope", "invalid_cursor"],
    // A real word, but not one this search returns.
    [`/api/words?q=carnaval&after=${words[0].id}`, "invalid_cursor"],
    ["/api/words?page=2", "unknown_parameter"],
  ])("%s is a 400 %s", async (path, code) => {
    await expectProblem(await list(event(path)), 400, code);
  });

  it("refuses other methods with Allow: GET", async () => {
    const response = await listFallback(event("/api/words", {}, "POST"));
    expect(response.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    await expectProblem(response, 405, "method_not_allowed");
  });
});

describe("GET /api/words/{id}", () => {
  it("returns the word", async () => {
    const response = await one(event(`/api/words/${words[5].id}`, { id: words[5].id }));
    expect((await response.json()).word).toBe(words[5].word);
  });

  it("is a 404 problem for an unknown id", async () => {
    await expectProblem(await one(event("/api/words/nope", { id: "nope" })), 404, "word_not_found");
  });
});

describe("CORS", () => {
  it("answers a preflight for any origin", async () => {
    const response = await OPTIONS(event("/api/words/x", { id: "x" }, "OPTIONS"));
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("unknown /api paths", () => {
  it("answer with a JSON 404", async () => {
    await expectProblem(
      await unknown(event("/api/nothing", { path: "nothing" })),
      404,
      "not_found"
    );
  });
});
