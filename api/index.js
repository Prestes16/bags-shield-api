// api/index.js
import { APP_VERSION } from './_version.js';

export default async function handler(req, res) {
  // Garantir que o CDN não cache e que o navegador renderize como HTML
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  const hasKey = !!process.env.BAGS_API_KEY;
  const baseUrl = process.env.BAGS_API_BASE || 'https://api.bags.app';

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bags Shield API — Status</title>
<style>
:root{
  --bg:#0b1220; --card:#0f172a; --fg:#e5e7eb; --muted:#9ca3af;
  --ok:#00ffa3; --warn:#ffd166; --btn:#111827; --bd:#374151; --hl:#06b6d4;
}
*{box-sizing:border-box}
body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--fg)}
.wrap{max-width:980px;margin:40px auto;padding:24px}
.card{background:var(--card);border:1px solid #1f2937;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
h1{margin:0 0 6px;font-size:28px}
.muted{color:var(--muted);margin:0 0 18px}
.row{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 18px}
.badge{display:inline-block;background:linear-gradient(90deg,var(--ok),var(--hl));color:#001b12;font-weight:700;border-radius:999px;padding:6px 10px;margin-left:8px}
a.btn,button.btn{display:inline-flex;align-items:center;gap:8px;margin:6px 6px 0 0;padding:10px 14px;border-radius:10px;text-decoration:none;background:var(--btn);border:1px solid var(--bd);color:var(--fg);cursor:pointer}
a.btn:hover,button.btn:hover{border-color:#4b5563}
pre{background:#111827;border:1px solid #1f2937;border-radius:10px;padding:12px;overflow:auto;white-space:pre-wrap;word-break:break-word}
code{font-family:ui-monospace,Menlo,Consolas,monospace}
.kv{display:grid;grid-template-columns:180px 1fr;gap:8px;margin:10px 0}
.kv div{padding:6px 10px;border:1px solid #1f2937;border-radius:10px;background:#0b1220}
hr{border:none;border-top:1px solid #1f2937;margin:22px 0}
small{color:var(--muted)}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Bags Shield API <span class="badge">online</span></h1>
      <p class="muted">Produção: <strong>https://bags-shield-api.vercel.app</strong> · Versão: <strong>${APP_VERSION}</strong></p>

      <div class="kv">
        <div><strong>BAGS_API_KEY</strong></div><div>${hasKey ? '✅ configurada' : '❌ não configurada'}</div>
        <div><strong>BAGS_API_BASE</strong></div><div>${baseUrl}</div>
      </div>

      <div class="row">
        <a class="btn" href="/api/health" target="_blank">/api/health</a>
        <a class="btn" href="/api/scan" target="_blank">/api/scan (POST)</a>
        <a class="btn" href="/api/simulate" target="_blank">/api/simulate (POST)</a>
        <a class="btn" href="/api/apply" target="_blank">/api/apply (POST)</a>
      </div>

      <hr/>

      <h3>Testes (PowerShell)</h3>

      <p class="muted">Health (GET)</p>
      <pre><code id="c1">irm "https://bags-shield-api.vercel.app/api/health"</code></pre>
      <button class="btn" data-copy="#c1">Copiar</button>

      <p class="muted">Scan (POST) com <code>mint</code></p>
      <pre><code id="c2">irm "https://bags-shield-api.vercel.app/api/scan" -Method Post -ContentType "application/json" -Body '{"mint":"9xQeWvG816bUx9EPjHmaT23yvVM2ZWJw6z9vG9W7fZ5F","network":"devnet"}'</code></pre>
      <button class="btn" data-copy="#c2">Copiar</button>

      <p class="muted">Scan (POST) com <code>tokenMint</code></p>
      <pre><code id="c3">irm "https://bags-shield-api.vercel.app/api/scan" -Method Post -ContentType "application/json" -Body '{"tokenMint":"9xQeWvG816bUx9EPjHmaT23yvVM2ZWJw6z9vG9W7fZ5F","network":"devnet"}'</code></pre>
      <button class="btn" data-copy="#c3">Copiar</button>

      <p class="muted">Simulate (POST)</p>
      <pre><code id="c4">irm "https://bags-shield-api.vercel.app/api/simulate" -Method Post -ContentType "application/json" -Body '{"mint":"9xQeWvG816bUx9EPjHmaT23yvVM2ZWJw6z9vG9W7fZ5F","network":"devnet","mock":{"mintAuthorityActive":false,"top10HoldersPct":35,"freezeNotRenounced":false,"tokenAgeDays":15,"liquidityLocked":true,"creatorReputation":20}}'</code></pre>
      <button class="btn" data-copy="#c4">Copiar</button>

      <p class="muted">Apply (POST)</p>
      <pre><code id="c5">irm "https://bags-shield-api.vercel.app/api/apply" -Method Post -ContentType "application/json" -Body '{"mint":"9xQeWvG816bUx9EPjHmaT23yvVM2ZWJw6z9vG9W7fZ5F","network":"devnet","mock":{"top10HoldersPct":82}}'</code></pre>
      <button class="btn" data-copy="#c5">Copiar</button>

      <p class="muted">Scan por <code>transactionSig</code> (MVP, min 8 chars)</p>
      <pre><code id="c6">irm "https://bags-shield-api.vercel.app/api/scan" -Method Post -ContentType "application/json" -Body '{"transactionSig":"5SxABCDEF123","network":"devnet"}'</code></pre>
      <button class="btn" data-copy="#c6">Copiar</button>

      <hr/>
      <small>© Bags Shield — API ${APP_VERSION}</small>
    </div>
  </div>

  <script>
    document.querySelectorAll('[data-copy]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        try{
          const sel = btn.getAttribute('data-copy');
          const el = document.querySelector(sel);
          const txt = el ? el.textContent : '';
          await navigator.clipboard.writeText(txt);
          btn.textContent = 'Copiado!';
          setTimeout(()=>btn.textContent='Copiar', 1200);
        }catch(e){
          btn.textContent = 'Erro :(';
          setTimeout(()=>btn.textContent='Copiar', 1200);
        }
      });
    });
  </script>
</body>
</html>`;

  res.status(200).end(html);
}
