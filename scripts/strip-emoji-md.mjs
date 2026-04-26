// Strip emoji + variation selectors + ZWJ from every *.md file in the repo.
// Idempotent. Skips node_modules / .next / .git.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SKIP = new Set(["node_modules", ".next", ".git", "playwright-report", "test-results"]);

const EMOJI = /\p{Extended_Pictographic}/gu;
const ZWJ_VS = /[‍️⃣]/g;
const SKIN = /[\u{1F3FB}-\u{1F3FF}]/gu;

function clean(s) {
  return s
    .replace(EMOJI, "")
    .replace(SKIN, "")
    .replace(ZWJ_VS, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n");
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) out.push(full);
  }
}

const targets = [];
walk(ROOT, targets);

let changed = 0;
for (const p of targets) {
  const before = fs.readFileSync(p, "utf8");
  const after = clean(before);
  if (before !== after) {
    fs.writeFileSync(p, after);
    console.log("clean", path.relative(ROOT, p));
    changed += 1;
  }
}
console.log(`---\n${changed} of ${targets.length} markdown files updated`);
