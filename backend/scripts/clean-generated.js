const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');
const targets = [
  '.strapi',
  'dist',
  path.join('node_modules', '.strapi'),
  '.cache',
];

for (const relativeTarget of targets) {
  const absoluteTarget = path.join(backendRoot, relativeTarget);

  if (!fs.existsSync(absoluteTarget)) {
    continue;
  }

  fs.rmSync(absoluteTarget, { recursive: true, force: true });
  console.log(`Removed ${relativeTarget}`);
}
