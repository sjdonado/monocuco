#!/usr/bin/env node
/**
 * Generate initial words data for prerendering
 * This runs at build time to extract the first 12 alphabetically sorted words
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const JSON_PATH = resolve(__dirname, "../data.json");
const OUTPUT_PATH = resolve(__dirname, "../src/lib/data/initial-words.json");
const PAGE_SIZE = 12;

/**
 * Normalize word for sorting to match DuckDB behavior
 * DuckDB's default collation treats punctuation differently than JS localeCompare
 */
function normalizeForSort(word) {
  // Convert to lowercase for case-insensitive comparison
  // This matches DuckDB's LOWER(word) behavior
  return word.toLowerCase();
}

function main() {
  // Read data.json
  const data = JSON.parse(readFileSync(JSON_PATH, "utf-8"));

  if (!Array.isArray(data)) {
    throw new Error("data.json must be an array");
  }

  // Sort to match DuckDB's ORDER BY word ASC behavior
  // DuckDB uses binary/lexicographic ordering after LOWER()
  const sorted = data.slice().sort((a, b) => {
    const aLower = normalizeForSort(a.word);
    const bLower = normalizeForSort(b.word);

    // Binary comparison (matches DuckDB's default collation)
    if (aLower < bLower) return -1;
    if (aLower > bLower) return 1;

    // If lowercase versions are equal, compare original (for case sensitivity)
    if (a.word < b.word) return -1;
    if (a.word > b.word) return 1;

    // If words are identical, sort by ID for consistency
    return a.id.localeCompare(b.id);
  });

  // Take first PAGE_SIZE words
  const initialWords = sorted.slice(0, PAGE_SIZE);

  // Calculate pagination info
  const total = data.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Create output directory if needed
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  // Write output with pagination info
  const output = {
    words: initialWords,
    total: total,
    totalPages: totalPages,
    pageSize: PAGE_SIZE,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`✅ Generated ${initialWords.length} initial words for prerendering`);
  console.log(`   Total words: ${total}`);
  console.log(`   Total pages: ${totalPages}`);
  console.log(`   Output: ${OUTPUT_PATH}`);
}

main();
