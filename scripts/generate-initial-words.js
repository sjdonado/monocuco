#!/usr/bin/env bun
/**
 * Generate initial words data for prerendering
 * Runs after build-index.js and extracts the first page of static/data.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { firstLetter } from "../src/lib/text.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JSON_PATH = resolve(__dirname, "../static/data.json");
const OUTPUT_PATH = resolve(__dirname, "../src/lib/data/initial-words.json");
const PAGE_SIZE = 12;

function main() {
  // Read the dataset build-index.js already normalized and sorted, so the
  // prerendered first page matches the first page the client loads.
  const data = JSON.parse(readFileSync(JSON_PATH, "utf-8"));

  if (!Array.isArray(data)) {
    throw new Error("static/data.json must be an array");
  }

  const initialWords = data.slice(0, PAGE_SIZE);

  // Calculate pagination info
  const total = data.length;

  // Letter counts for the letter row, so it renders before the search data loads.
  const counts = new Map();
  for (const item of data) {
    const letter = firstLetter(item.word);
    counts.set(letter, (counts.get(letter) ?? 0) + 1);
  }
  const letters = [...counts.keys()]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((letter) => ({ letter, count: counts.get(letter) }));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // The pager of the first page (the same links findAll returns: up to 4 pages, each named by
  // the id of its first word), so the first page works with no search data loaded.
  const pages = Array.from({ length: Math.min(4, totalPages) }, (_, i) => ({
    number: i + 1,
    after: i === 0 ? null : data[i * PAGE_SIZE].id,
  }));
  const nextAfter = totalPages > 1 ? data[PAGE_SIZE].id : null;

  // Create output directory if needed
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  // Write output with pagination info
  const output = {
    words: initialWords,
    total: total,
    totalPages: totalPages,
    pageSize: PAGE_SIZE,
    letters,
    pages,
    nextAfter,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`✅ Generated ${initialWords.length} initial words for prerendering`);
  console.log(`   Total words: ${total}`);
  console.log(`   Total pages: ${totalPages}`);
  console.log(`   Output: ${OUTPUT_PATH}`);
}

main();
