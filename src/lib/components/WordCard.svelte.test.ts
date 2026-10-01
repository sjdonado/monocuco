import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-svelte";
import WordCard from "./WordCard.svelte";

const entry = {
  id: "test-id",
  word: "Bacán",
  definition: "Algo **muy** bueno.",
  example: "Qué *bacán* está eso",
  createdBy: { name: "Ana Pérez", website: "https://example.com/ana" },
  createdAt: "2021-08-31T12:00:00.000Z",
};
const shareUrl = "https://monocuco.sjdonado.com/?word=test-id&q=Bac%C3%A1n";

describe("WordCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as { share?: unknown }).share;
  });

  it("renders the word, markdown definition, example, author and date", async () => {
    render(WordCard, { entry, shareUrl });

    await expect.element(page.getByRole("heading", { name: "Bacán" })).toBeVisible();
    await expect
      .element(page.getByText("muy", { exact: true }))
      .toHaveProperty("tagName", "STRONG");
    await expect.element(page.getByText("bacán", { exact: true })).toHaveProperty("tagName", "EM");
    await expect
      .element(page.getByRole("link", { name: "Ana Pérez" }))
      .toHaveAttribute("href", "https://example.com/ana");
    await expect.element(page.getByText("31 de agosto de 2021", { exact: false })).toBeVisible();
  });

  it("shows the author as plain text when there is no website", async () => {
    render(WordCard, {
      entry: { ...entry, createdBy: { name: "Anónimo", website: "" } },
      shareUrl,
    });

    await expect.element(page.getByText("Anónimo")).toBeVisible();
    expect(page.getByRole("link", { name: "Anónimo" }).elements()).toHaveLength(0);
  });

  it("copies the share link and confirms it when the Web Share API is missing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(navigator, "clipboard", "get").mockReturnValue({ writeText } as unknown as Clipboard);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    render(WordCard, { entry, shareUrl });

    await page.getByRole("button", { name: "Compartir Bacán" }).click();

    expect(writeText).toHaveBeenCalledWith(shareUrl);
    await expect.element(page.getByText("Enlace copiado")).toBeVisible();
  });
});
