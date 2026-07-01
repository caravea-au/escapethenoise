#!/usr/bin/env node
// Convert source images to WebP under a size budget, written into frontend/public/.
// Usage: node scripts/optimize-image.mjs <src> <destRelativeToPublic> [--mobile]
//   <src>                 absolute or relative path to a source jpg/png (e.g. a design-input asset)
//   <destRelativeToPublic> output path under public/, .webp enforced (e.g. photos/hero.webp)
//   --mobile              use the 100 KB budget instead of 200 KB
// Budgets (CLAUDE.md): <=200 KB desktop / <=100 KB mobile. Width is capped, then quality
// is stepped down until the file fits. Fails loudly if it can't meet the budget.
import sharp from "sharp";
import { mkdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const [src, dest, ...flags] = process.argv.slice(2);
if (!src || !dest) {
  console.error("usage: optimize-image.mjs <src> <destUnderPublic> [--mobile]");
  process.exit(1);
}
const mobile = flags.includes("--mobile");
const budget = (mobile ? 100 : 200) * 1024;
const maxWidth = mobile ? 800 : 1920;
const out = resolve(join("public", dest.endsWith(".webp") ? dest : dest.replace(/\.\w+$/, ".webp")));

await mkdir(dirname(out), { recursive: true });

let quality = 82;
for (; quality >= 40; quality -= 6) {
  await sharp(src).resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality }).toFile(out);
  const { size } = await stat(out);
  if (size <= budget) {
    console.log(`✓ ${out}  ${(size / 1024).toFixed(0)}KB  q${quality}  (budget ${budget / 1024}KB)`);
    process.exit(0);
  }
}
const { size } = await stat(out);
console.error(`✗ ${out} is ${(size / 1024).toFixed(0)}KB at q${quality + 6}; over the ${budget / 1024}KB budget. Crop/resize the source.`);
process.exit(2);
