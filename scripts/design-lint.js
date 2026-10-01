#!/usr/bin/env bun
/**
 * Fails when Svelte components use a class or character the design system bans
 * (openspec/changes/revamp-minimalist-design/design.md, decision 8). Colors, radii,
 * type and borders come from the tokens in src/app.css, so these patterns are either
 * off-system or bring back a second hue, a shadow or an ad hoc size.
 *
 * Usage: node scripts/design-lint.js [--report]   (--report lists without failing)
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const REPORT = process.argv.includes("--report");

const BANNED = [
  [/\bshadow-/, "shadows: separate surfaces with border-hairline"],
  [
    /\brounded-(sm|md|lg|xl|2xl|3xl)\b/,
    "radius off the token set: use rounded-field, rounded-box or rounded-full",
  ],
  [/\btext-(xl|[4-9]xl)\b/, "font size off the scale (xs, sm, base, lg, 2xl, 3xl)"],
  [/\bfont-(bold|extrabold|black)\b/, "weight off the scale: use font-medium or font-semibold"],
  [/\btext-base-content\/\d+/, "ad hoc opacity: use text-muted"],
  [
    /\b(text|bg|border|btn|badge|link)-(secondary|accent|neutral)\b/,
    "second hue: only primary is an accent",
  ],
  [
    /\balert-(warning|info|success)\b/,
    "status color outside a status message: use a neutral panel with role=status",
  ],
  [/\bdark:/, "per-scheme override: the tokens already carry both themes"],
  [
    /\b(gray|slate|zinc|neutral|stone|red|green|blue|yellow)-\d{2,3}\b/,
    "raw palette color: use a token",
  ],
  [/\[[^\]\s]*\d(px|vh|vw)[^\]\s]*\]/, "arbitrary px or viewport value: stay on the 4 px grid"],
  [/\bskeleton\b/, "skeleton class: pending states are inline indicators"],
  [/\p{Extended_Pictographic}/u, "decorative emoji in interface copy"],
  [
    /class="(?![^"]*prose-tokens)[^"]*\bprose(?![-\w])/,
    "bare prose: add prose-tokens so Markdown uses the tokens",
  ],
  [/\bfocus(-visible)?:outline-none\b/, "removes the global focus ring"],
];

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (entry.name.endsWith(".svelte")) files.push(path);
  }
};
walk(resolve(ROOT, "src"));

const findings = [];
for (const file of files) {
  readFileSync(file, "utf-8")
    .split("\n")
    .forEach((line, i) => {
      for (const [pattern, why] of BANNED) {
        const match = line.match(pattern);
        if (match) findings.push(`${relative(ROOT, file)}:${i + 1}: ${match[0]}: ${why}`);
      }
    });
}

for (const finding of findings) console.log(finding);
console.log(`design-lint: ${findings.length} banned pattern(s) in ${files.length} files`);
if (findings.length > 0 && !REPORT) process.exit(1);
