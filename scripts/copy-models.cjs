const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const srcDir = path.join(repoRoot, 'src', 'assets', 'models');
const outDir = path.join(repoRoot, 'public', 'assets', 'models');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyRecursive(src, dest) {
  ensureDir(dest);
  if (!fs.existsSync(src)) return;
  const items = fs.readdirSync(src);
  for (const item of items) {
    const s = path.join(src, item);
    const d = path.join(dest, item);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) {
      copyRecursive(s, d);
    } else {
      try {
        fs.copyFileSync(s, d);
      } catch (e) {
        console.warn('Failed to copy', s, e && e.message);
      }
    }
  }
}

(function main() {
  console.log('Copying models from', srcDir, 'to', outDir);
  if (!fs.existsSync(srcDir)) {
    console.warn('Source models directory does not exist:', srcDir);
    return;
  }
  copyRecursive(srcDir, outDir);
  console.log('Model copy complete.');
})();
