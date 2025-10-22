const fs = require("fs");
const path = require("path");

// arquivos de entrypoint que vamos tocar (index.ts sob api/**)
function listEntrypoints(dir="api") {
  const out = [];
  function walk(p) {
    for (const name of fs.readdirSync(p)) {
      const abs = path.join(p, name);
      const st = fs.statSync(abs);
      if (st.isDirectory()) walk(abs);
      else if (/[/\\]index\.ts$/i.test(abs)) out.push(abs);
    }
  }
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

function addJsExt(spec) {
  // só adiciona .js se não terminar com .js / .mjs / .cjs
  if (/\.(mjs|cjs|js)$/.test(spec)) return spec;
  return spec + ".js";
}

function patchFile(f) {
  let s = fs.readFileSync(f, "utf8");
  const before = s;

  // 1) ./_foo -> ../_foo(.js)
  s = s.replace(/from\s+(['"])\.\/(_[A-Za-z0-9._\-\/]+)\1/g, (m,q,rest)=>`from ${q}${addJsExt("../"+rest)}${q}`);

  // 2) ../_foo -> ../_foo(.js)
  s = s.replace(/from\s+(['"])(\.\.\/_[A-Za-z0-9._\-\/]+)\1/g, (m,q,rest)=>`from ${q}${addJsExt(rest)}${q}`);

  if (s !== before) {
    fs.writeFileSync(f, s);
    return true;
  }
  return false;
}

const files = listEntrypoints("api");
let changed = 0;
for (const f of files) if (patchFile(f)) { console.log("patched", f); changed++; }
console.log("done. changed:", changed);
