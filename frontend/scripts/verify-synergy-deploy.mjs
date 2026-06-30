import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const defaultDeployDir = path.join(frontendDir, ".deploy", "synergy");

const deployDir = process.env.SYNERGY_DEPLOY_DIR
  ? path.resolve(process.env.SYNERGY_DEPLOY_DIR)
  : defaultDeployDir;

const requiredRelative = [
  "app.js",
  "frontend/server.js",
  "frontend/.next/static",
  "node_modules/next/package.json",
  "node_modules/next/dist/server/next.js",
];

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

let failed = false;
for (const rel of requiredRelative) {
  const full = path.join(deployDir, rel);
  const ok = await pathExists(full);
  if (!ok) {
    console.error(`Missing: ${rel} (expected at ${full})`);
    failed = true;
  } else {
    console.log(`OK: ${rel}`);
  }
}

if (failed) {
  console.error(
    "\nSynergy/cPanel deploy package layout is invalid. Re-run `npm run build:synergy` or `npm run release:synergy` from the repo root.",
  );
  process.exit(1);
}

const rootPackagePath = path.join(deployDir, "package.json");
let rootPkg;
try {
  rootPkg = JSON.parse(await fs.readFile(rootPackagePath, "utf8"));
} catch (err) {
  console.error(`Missing or invalid root package.json at ${rootPackagePath}`, err);
  process.exit(1);
}
if (rootPkg.main !== "app.js") {
  console.error(
    `Invalid root package.json: expected main "app.js", got ${JSON.stringify(rootPkg.main)}. ` +
      "Do not ship the monorepo package.json at the deploy root.",
  );
  process.exit(1);
}
console.log('OK: package.json main is "app.js"');
if (Object.hasOwn(rootPkg, "workspaces")) {
  console.error(
    "Invalid root package.json: must not declare workspaces (cPanel npm wrapper will clobber traced Next).",
  );
  process.exit(1);
}
console.log("OK: package.json has no workspaces key");

console.log(`
cPanel Node.js app checklist (Synergy / after upload):
- Application Root (cPanel "Application Root") is the folder that contains BOTH "frontend" and "node_modules" (same level as app.js).
- File exists: node_modules/next/dist/server/next.js
- From that folder (SSH or cPanel Terminal): node -e "require('next'); console.log('ok')"
- Do NOT click "Run NPM Install" in cPanel after upload; it can break traced node_modules/next.
`);
