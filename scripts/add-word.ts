#!/usr/bin/env bun
/**
 * CLI to append a new word entry to the project JSON dataset.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { Command } from "commander";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_JSON_PATH = resolve(__dirname, "../data.json");
const README_PATH = resolve(__dirname, "../README.md");
const CONTRIBUTORS_HEADER = "## Contribuidores";

/**
 * Split markdown table row into cells
 * @param {string} line - Markdown table row
 * @returns {string[]} Array of cell contents
 */
function splitMarkdownRow(line: string): string[] {
  let core = line.trim();
  if (core.startsWith("|")) core = core.slice(1);
  if (core.endsWith("|")) core = core.slice(0, -1);
  return core.split("|").map((cell: string) => cell.trim());
}

/**
 * Format cells into a markdown row
 * @param {string[]} cells - Array of cell contents
 * @returns {string} Formatted markdown row
 */
function formatMarkdownRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

/**
 * Normalize identifier for comparison
 * @param {string | null | undefined} value - Value to normalize
 * @returns {string} Normalized identifier
 */
function normalizeIdentifier(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Update README contributors table
 * @param {string | null} author - Author name
 * @param {string | null} website - Author website
 * @param {string} readmePath - Path to README file
 * @returns {boolean} True if updated successfully
 */
function updateReadmeContributors(
  author: string | null | undefined,
  website: string | null | undefined,
  readmePath = README_PATH
): boolean {
  const authorName = (author || "").trim();
  if (!authorName) return false;

  try {
    const content = readFileSync(readmePath, "utf-8");
    const lines = content.split("\n");

    const headerIdx = lines.findIndex(
      (line) => normalizeIdentifier(line) === normalizeIdentifier(CONTRIBUTORS_HEADER)
    );

    let tableStart: number | null = null;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      if (lines[i].trim().startsWith("|")) {
        tableStart = i;
        break;
      }
    }
    // Without a table the old code threw on `lines[null].trim()`; the catch below reports it.
    if (tableStart === null) throw new Error("no se encontró la tabla de contribuidores");

    let tableEnd = lines.length;
    for (let i = tableStart; i < lines.length; i++) {
      if (!lines[i].trim().startsWith("|")) {
        tableEnd = i;
        break;
      }
    }

    const tableLines = lines.slice(tableStart, tableEnd);
    const headerCells = splitMarkdownRow(tableLines[0]);
    const dataLines = tableLines.slice(2);
    const columns = headerCells.length;

    // Build flat cells array from table
    const rows: string[][] = [];
    for (const line of dataLines) {
      if (!line.trim().startsWith("|")) continue;
      const cells = splitMarkdownRow(line);
      while (cells.length < columns) {
        cells.push("");
      }
      rows.push(cells);
    }

    const flatCells = rows.flat();
    const normalizedAuthor = normalizeIdentifier(authorName);

    // Check if author already exists and update if needed
    for (let idx = 0; idx < flatCells.length; idx++) {
      const cell = flatCells[idx];
      if (!cell.trim()) continue;
      if (!normalizedAuthor || !normalizeIdentifier(cell).includes(normalizedAuthor)) continue;

      if (!website?.trim()) {
        console.log(`ℹ️ README.md ya incluía a ${authorName}.`);
        return true;
      }

      const target = website.trim();
      const hrefMatch = cell.match(/href="([^"]*)"/);

      // Update existing href
      if (hrefMatch) {
        const current = hrefMatch[1];
        if (current === target) {
          console.log(`ℹ️ README.md ya incluía a ${authorName}.`);
          return true;
        }

        flatCells[idx] = cell.replace(/href="[^"]*"/, `href="${target}"`);
        const newRows: string[][] = [];
        for (let i = 0; i < flatCells.length; i += columns) {
          newRows.push(flatCells.slice(i, i + columns));
        }
        const formatted = newRows
          .filter((row) => row.some((item) => item.trim()))
          .map((row) => formatMarkdownRow(row));
        lines.splice(tableStart, tableEnd - tableStart, tableLines[0], tableLines[1], ...formatted);
        writeFileSync(readmePath, lines.join("\n") + "\n", "utf-8");
        console.log(`ℹ️ README.md ya incluía a ${authorName}; la información fue actualizada.`);
        return true;
      }

      // Add href to existing cell
      flatCells[idx] = `<a href="${target}">${cell}</a>`;
      const newRows: string[][] = [];
      for (let i = 0; i < flatCells.length; i += columns) {
        newRows.push(flatCells.slice(i, i + columns));
      }
      const formatted = newRows
        .filter((row) => row.some((item) => item.trim()))
        .map((row) => formatMarkdownRow(row));
      lines.splice(tableStart, tableEnd - tableStart, tableLines[0], tableLines[1], ...formatted);
      writeFileSync(readmePath, lines.join("\n") + "\n", "utf-8");
      console.log(`ℹ️ README.md ya incluía a ${authorName}; la información fue actualizada.`);
      return true;
    }

    // Add new contributor
    const label = authorName.trim();
    const href = (website || "").trim();
    const newCell = `<a href="${href}"><img src="" width="460px;" alt="${label}"/><br /><sub><b>${label}</b></sub></a>`;

    const emptyIndex = flatCells.findIndex((cell) => !cell.trim());

    if (emptyIndex === -1) {
      flatCells.push(newCell);
      while (flatCells.length % columns !== 0) {
        flatCells.push("");
      }
    } else {
      flatCells[emptyIndex] = newCell;
    }

    const newRows: string[][] = [];
    for (let i = 0; i < flatCells.length; i += columns) {
      newRows.push(flatCells.slice(i, i + columns));
    }

    const formattedRows = newRows
      .filter((row) => row.some((item) => item.trim()))
      .map((row) => formatMarkdownRow(row));

    lines.splice(tableStart, tableEnd - tableStart, tableLines[0], tableLines[1], ...formattedRows);
    writeFileSync(readmePath, lines.join("\n") + "\n", "utf-8");
    console.log(`✅ README.md actualizado con ${authorName} en la lista de contribuidores.`);
    return true;
  } catch (err) {
    console.log(
      `⚠️ No se pudo actualizar README.md: ${err instanceof Error ? err.message : String(err)}`
    );
    return false;
  }
}

/** Entry data structure */
interface Entry {
  id: string;
  word: string;
  definition: string;
  example: string;
  createdBy: { name: string | null; website: string | null };
  createdAt: string;
}

/** Add entry options */
interface AddEntryOptions {
  /** Word or expression to add */
  word: string;
  /** Definition in markdown */
  definition: string;
  example?: string;
  author?: string | null;
  website?: string | null;
  /** ISO timestamp */
  createdAt?: string | null;
  /** Path to JSON file */
  jsonPath?: string;
  /** Print without writing */
  dryRun?: boolean;
}

/** Add a new word entry */
function addEntry({
  word,
  definition,
  example = "",
  author = null,
  website = null,
  createdAt = null,
  jsonPath = DEFAULT_JSON_PATH,
  dryRun = false,
}: AddEntryOptions): Entry {
  const timestamp = createdAt || new Date().toISOString().replace(/\+00:00$/, "Z");
  const entryId = randomUUID();

  const trimmedWord = word.trim();
  const normalizedWord = trimmedWord ? trimmedWord[0].toUpperCase() + trimmedWord.slice(1) : "";
  const cleanedDefinition = definition.trim();

  let normalizedExample = "";
  if (example) {
    const exampleLines = example
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    if (exampleLines.length > 0) {
      const formattedLines = exampleLines.map((line) => {
        if (line.startsWith('"') && line.endsWith('"')) {
          return line;
        }
        return `"${line}"`;
      });
      normalizedExample = formattedLines.join("\n");
    }
  }

  const authorValue = author?.trim() || null;
  const websiteValue = website?.trim() || null;

  const entry: Entry = {
    id: entryId,
    word: normalizedWord,
    definition: cleanedDefinition,
    example: normalizedExample,
    createdBy: {
      name: authorValue,
      website: websiteValue,
    },
    createdAt: timestamp,
  };

  if (dryRun) {
    console.log(JSON.stringify(entry, null, 2));
    return entry;
  }

  // Update JSON file
  let records: Entry[] = [];
  if (existsSync(jsonPath)) {
    records = JSON.parse(readFileSync(jsonPath, "utf-8"));
  }
  records.push(entry);
  writeFileSync(jsonPath, JSON.stringify(records, null, 2), "utf-8");

  updateReadmeContributors(author, website);

  console.log(`✅ Added '${entry.word}' to ${jsonPath}`);
  return entry;
}

interface AddEntryCliOptions {
  word: string;
  definition: string;
  example: string;
  author?: string;
  website?: string;
  createdAt?: string;
  json: string;
  dryRun: boolean;
}

const program = new Command();

program
  .name("add-word")
  .description("CLI to append a new word entry to the project JSON dataset")
  .requiredOption("-w, --word <word>", "Word or expression to add")
  .requiredOption("-d, --definition <definition>", "Definition in markdown")
  .option("-e, --example <example>", "Example usage (markdown, optional)", "")
  .option("--author <author>", "Author name")
  .option("--website <website>", "Author website")
  .option("--created-at <timestamp>", "ISO timestamp (defaults to current UTC time)")
  .option("--json <path>", "Target JSON file", DEFAULT_JSON_PATH)
  .option("--dry-run", "Print the would-be entry without writing to disk", false)
  .action((options: AddEntryCliOptions) => {
    addEntry({
      word: options.word,
      definition: options.definition,
      example: options.example,
      author: options.author,
      website: options.website,
      createdAt: options.createdAt,
      jsonPath: options.json,
      dryRun: options.dryRun,
    });
  });

program.parse();
