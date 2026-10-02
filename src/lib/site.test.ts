import { describe, expect, it } from "vitest";
import { canonicalPath, plainText } from "./site";

const at = (path: string) => new URL(path, "https://monocuco.sjdonado.com");

describe("canonicalPath", () => {
  it("keeps only the word on a word page", () => {
    expect(canonicalPath(at("/?q=aja&word=abc&after=x"))).toBe("/?word=abc");
  });

  it("keeps the list's search, letter and page in a fixed order", () => {
    expect(canonicalPath(at("/?after=x&letter=M&utm_source=y"))).toBe("/?letter=M&after=x");
    expect(canonicalPath(at("/?q=%20carnaval%20"))).toBe("/?q=carnaval");
    expect(canonicalPath(at("/"))).toBe("/");
  });

  it("names a letter page by its letter, however it was typed", () => {
    expect(canonicalPath(at("/?letter=m"))).toBe("/?letter=M");
    expect(canonicalPath(at("/?letter=%C3%A9"))).toBe("/?letter=E");
    expect(canonicalPath(at("/?letter=1"))).toBe("/");
    expect(canonicalPath(at("/?q=aja&letter=M"))).toBe("/?q=aja");
  });

  it("ignores the query on other pages", () => {
    expect(canonicalPath(at("/about?ref=x"))).toBe("/about");
  });
});

describe("plainText", () => {
  it("drops Markdown marks and keeps link text", () => {
    expect(plainText("*Expresión* coger **a cuello** [corto](https://x.y)\n\n_ya_")).toBe(
      "Expresión coger a cuello corto ya"
    );
  });
});
