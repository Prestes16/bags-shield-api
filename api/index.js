// api/index.js
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).end(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bags Shield API — Status</title>
<style>
:root{--bg:#0b1220;--fg:#e5e7eb;--muted:#9ca3af;--ok:#00ffa3;--btn:#111827;--bd:#374151}
*{box-sizing:border-box}body{margin:0;font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--fg)}
.wrap{max-width:880px;margin:40px auto;padding:24px}
.card{background:#0f172a;border:1px solid #1f2937;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
h1{margin:0 0 6px;font-size:28px}
.muted{color:var(--muted);margin:0 0 18px}
a.btn{display:inline-block;margin:8px 8px 0 0;padding:10px 14px;border-radius:10px;text-decoration:none;background:var(--btn);border:1px solid var(--bd);color:var(--fg)}
a.btn:hover{border-color:#4b5563}
pre{background:#111827;border:1px solid #1f2937;border-radius:10px;padding:10px;overflow:auto}
.badge{display:inline-block;background:linear-gradient(90deg,var(--ok),#06b6d4);color:#001b12;font-weight:700;border-radius:999px;padding:6px 10px;margin-left:8px}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Bags Shield API <span class="badge">online</span></h1>
      <p class="muted">Produção: <strong>https://bags-shield-api.vercel.app</strong></p>

      <div>
        <a class="btn" href="/api/health" target="_blank">/api/health</a>
        <a class="btn" href="/api/scan" target="_blank">/api/scan (POST)</a>
        <a class="btn" href="/api/simulate" target="_blank">/api/simulate (POST)</a>
        <a class="btn" href="/api/apply" target="_blank">/api/apply (POST)</a>
      </div>

      <h3>Testes (PowerShell)</h3>
      <p class="muted">Health (GET)</p>
      <pre>irm "https://bags-shield-api.vercel.app/api/health"</pre>

      <p class="muted">Scan (POST) com <code>mint</code></p>
      <pre>irm "https://bags-shield-api.vercel.app/api/scan" -Method Post -ContentType "application/json" -Body '{"mint":"9xQeWvG816bUx9EPjHmaT23yvVM2ZWJw6z9vG9W7fZ5F","network":"devnet"}'</pre>

      <p class="muted">Scan (POST) com <code>tokenMint</code></p>
      <pre>irm "https://bags-shield-api.vercel.app/api/scan" -Method Post -ContentType "application/json" -Body '{"tokenMint":"9xQeWvG816bUx9EPjHmaT23yvVM2ZWJw6z9vG9W7fZ5F","network":"devnet"}'</pre>

      <p class="muted">Simulate (POST)</p>
      <pre>irm "https://bags-shield-api.vercel.app/api/simulate" -Method Post -ContentType "application/json" -Body '{"mint":"9xQeWvG816bUx9EPjHmaT23yvVM2ZWJw6z9vG9W7fZ5F","network":"devnet","mock":{"mintAuthorityActive":false,"top10HoldersPct":35,"freezeNotRenounced":false,"tokenAgeDays":15,"liquidityLocked":true,"creatorReputation":20}}'</pre>

      <p class="muted">Apply (POST)</p>
      <pre>irm "https://bags-shield-api.vercel.app/api/apply" -Method Post -ContentType "application/json" -Body '{"mint":"9xQeWvG816bUx9EPjHmaT23yvVM2ZWJw6z9vG9W7fZ5F","network":"devnet","mock":{"top10HoldersPct":82}}'</pre>
    </div>
  </div>
</body>
</html>`);
}
