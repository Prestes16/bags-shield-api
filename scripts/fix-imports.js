const fs = require('fs');
const path = require('path');

const apiRoot = path.join(process.cwd(), 'api');

function depthFromApi(dir) {
  const rel = path.relative(apiRoot, dir);
  if (!rel) return 0;
  return rel.split(path.sep).filter(Boolean).length;
}

function walk(dir, out=[]) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

const targets = walk(apiRoot);
let changed = [];

for (const file of targets) {
  const depth = depthFromApi(path.dirname(file));
  const prefix = '../'.repeat(depth);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;

  // Somente imports de helpers no root (nomes iniciando com "_")
  src = src.replace(/(from\s+['"])\.\/(_[^'"]+)/g, $1);
  src = src.replace(/(require\(\s*['"])\.\/(_[^'"]+)/g, $1);
  src = src.replace(/(import\(\s*['"])\.\/(_[^'"]+)/g, $1);

  if (src !== before) {
    fs.writeFileSync(file, src);
    changed.push({ file: path.relative(process.cwd(), file), depth });
  }
}

console.log('Patched files:', changed.length);
for (const c of changed) console.log( - \ (depth \));

// Aviso amigável se os helpers não existirem no root
['_util.js','_cors.js','_rate.js','_risk.js'].forEach(n => {
  const p = path.join(apiRoot, n);
  if (!fs.existsSync(p)) console.warn('WARN missing helper:', path.relative(process.cwd(), p));
});