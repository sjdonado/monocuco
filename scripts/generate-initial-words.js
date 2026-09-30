#!/usr/bin/env node
/**
 * Generate initial words data for prerendering
 * Runs after build-index.js and extracts the first page of static/data.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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
