#!/usr/bin/env bun
/**
 * Adds a word to data.json and its author to the README contributors table, then regenerates
 * the published data (`bun run build-data`).
 */

import { parseArgs } from "util";

const ROOT = new URL("..", import.meta.url).pathname;
const README = `${ROOT}README.md`;

const USAGE = `Usage: bun run add-word --word <word> --definition <markdown> [options]

  -w, --word <word>             Word or expression to add
  -d, --definition <markdown>   Definition (Markdown)
  -e, --example <markdown>      Example of use; one per line
  --author <name>               Who contributed it
  --website <url>               The author's website
  --created-at <iso>            Timestamp (default: now, UTC)
  --json <path>                 Target file (default: data.json)
  --dry-run                     Print the entry without writing anything`;

const parsed = (() => {
  try {
    return parseArgs({
      options: {
        word: { type: "string", short: "w" },
        definition: { type: "string", short: "d" },
        example: { type: "string", short: "e", default: "" },
        author: { type: "string" },
        website: { type: "string" },
        "created-at": { type: "string" },
        json: { type: "string", default: `${ROOT}data.json` },
        "dry-run": { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (err) {
    // An unknown or misspelled flag.
    console.log(`${err instanceof Error ? err.message : String(err)}\n\n${USAGE}`);
    process.exit(1);
  }
})();
const args = parsed.values;

if (args.help || !args.word?.trim() || !args.definition?.trim()) {
  console.log(USAGE);
  process.exit(args.help ? 0 : 1);
}

const word = args.word.trim();
const author = args.author?.trim() || null;
const website = args.website?.trim() || null;
const entry = {
  id: crypto.randomUUID(),
  word: word[0].toUpperCase() + word.slice(1),
  definition: args.definition.trim(),
  // One example per line, each in quotes.
  example: args.example
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith('"') && line.endsWith('"') ? line : `"${line}"`))
    .join("\n"),
  createdBy: { name: author, website },
  createdAt: args["created-at"] || new Date().toISOString(),
};

if (args["dry-run"]) {
  console.log(JSON.stringify(entry, null, 2));
  process.exit(0);
}

const file = Bun.file(args.json);
const records = (await file.exists()) ? await file.json() : [];
records.push(entry);
await Bun.write(args.json, JSON.stringify(records, null, 2));
if (author) {
  try {
    await addContributor(author, website);
  } catch (err) {
    // The word is already saved; the README can be fixed by hand.
    console.log(
      `⚠️ No se pudo actualizar README.md: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
console.log(`✅ Added '${entry.word}' to ${args.json}`);
const build = Bun.spawnSync(["bun", "run", "build-data"], { stdout: "inherit", stderr: "inherit" });
process.exit(build.exitCode);

/** Lists the author in the README's contributors grid, or updates their link. */
async function addContributor(name: string, link: string | null) {
  const fold = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase();
  const cellsOf = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());

  const lines = (await Bun.file(README).text()).split("\n");
  const header = lines.findIndex((line) => fold(line) === fold("## Contribuidores"));
  const start = lines.findIndex((line, i) => i > header && line.trim().startsWith("|"));
  if (header < 0 || start < 0) {
    console.log("⚠️ No se pudo actualizar README.md: no se encontró la tabla de contribuidores");
    return;
  }
  let end = lines.findIndex((line, i) => i > start && !line.trim().startsWith("|"));
  if (end < 0) end = lines.length;

  // The table is a grid: header, separator, then rows of cells read left to right.
  const columns = cellsOf(lines[start]).length;
  const cells = lines.slice(start + 2, end).flatMap((line) => {
    const row = cellsOf(line);
    while (row.length < columns) row.push("");
    return row;
  });

  const existing = cells.findIndex((cell) => cell && fold(cell).includes(fold(name)));
  if (existing >= 0) {
    if (!link || cells[existing].includes(`href="${link}"`)) {
      console.log(`ℹ️ README.md ya incluía a ${name}.`);
      return;
    }
    cells[existing] = /href="[^"]*"/.test(cells[existing])
      ? cells[existing].replace(/href="[^"]*"/, `href="${link}"`)
      : `<a href="${link}">${cells[existing]}</a>`;
    console.log(`ℹ️ README.md ya incluía a ${name}; la información fue actualizada.`);
  } else {
    const cell = `<a href="${link ?? ""}"><img src="" width="460px;" alt="${name}"/><br /><sub><b>${name}</b></sub></a>`;
    const empty = cells.findIndex((value) => !value);
    if (empty >= 0) cells[empty] = cell;
    else {
      cells.push(cell);
      while (cells.length % columns) cells.push("");
    }
    console.log(`✅ README.md actualizado con ${name} en la lista de contribuidores.`);
  }

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += columns) {
    const row = cells.slice(i, i + columns);
    if (row.some(Boolean)) rows.push(`| ${row.join(" | ")} |`);
  }
  lines.splice(start, end - start, lines[start], lines[start + 1], ...rows);
  await Bun.write(README, lines.join("\n"));
}
