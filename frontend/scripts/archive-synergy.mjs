import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");
const deployDir = path.join(frontendDir, ".deploy", "synergy");
const tarPath = path.join(frontendDir, ".deploy", "synergy.tar.gz");
const deployParent = path.dirname(deployDir);
const deployName = path.basename(deployDir);

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

if (!(await pathExists(deployDir))) {
  console.error(
    `Deploy folder not found: ${deployDir}\nRun \`npm run build:synergy\` from the repo root first.`,
  );
  process.exit(1);
}

const result = spawnSync(
  "tar",
  ["-czf", tarPath, "-C", deployParent, deployName],
  { stdio: "inherit", shell: false },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  `Created ${tarPath} (symlink-friendly; upload via cPanel File Manager or SFTP and extract on the Linux host).`,
);
