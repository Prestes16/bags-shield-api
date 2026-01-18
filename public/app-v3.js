// Helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

// STORE (estado global)
const STORE = {
  lang: "pt-BR",
  wallet: { connected: false, address: null },
  last: { type: null, payload: null }
};

// API (ainda stub, mas já pronto)
async function apiFetch(path, { method = "GET", body = null, timeoutMs = 12000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: body ? JSON.stringify(body) : null,
      signal: ctrl.signal
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) {
      const msg = (json && (json.error || json.message)) || text || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return json;
  } finally {
    clearTimeout(t);
  }
}

// RENDER
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderReport(type, payload) {
  STORE.last = { type, payload };
  const out = $("#reportOut");
  if (!out) return;

  // Verifica se tem resultado com score/grade/badges
  const result = payload?.result;
  const hasResult = result && (result.shieldScore !== undefined || result.score !== undefined);

  if (hasResult) {
    const score = result.shieldScore ?? result.score ?? 0;
    const grade = result.grade || "—";
    const badges = result.badges ?? [];

    // Atualiza score/grade no header
    if ($("#score")) {
      $("#score").textContent = String(Math.round(score));
    }
    if ($("#grade")) {
      $("#grade").textContent = `(${grade})`;
    }

    // Renderiza badges no container principal
    const badgesWrap = $("#badges");
    if (badgesWrap) {
      badgesWrap.innerHTML = "";
      if (badges.length > 0) {
        badges.forEach(b => {
          const div = document.createElement("div");
          const level = (b.level || "neutral").toLowerCase();
          let className = "chip ";
          if (level === "low" || level === "ok" || level === "good") {
            className += "good";
          } else if (level === "med" || level === "warn" || level === "attention") {
            className += "warn";
          } else if (level === "high" || level === "bad" || level === "critical") {
            className += "bad";
          } else {
            className += "neutral";
          }
          div.className = className;
          div.textContent = b.id || b.label || b.name || "badge";
          badgesWrap.appendChild(div);
        });
      } else {
        badgesWrap.innerHTML = '<div class="chip neutral">No badges</div>';
      }
    }

    // Renderiza hero com score grande
    out.innerHTML = `
      <div class="report-hero">
        <div class="score">${Math.round(score)}</div>
        <div class="grade-pill">${escapeHtml(grade)}</div>
      </div>
      <div class="report-meta">Last action: <b>${escapeHtml(type)}</b></div>
      <details>
        <summary>Raw JSON</summary>
        <pre class="report-json">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
      </details>
    `;
  } else {
    // Sem resultado: mostra apenas meta + JSON
    out.innerHTML = `
      <div class="report-meta">Last action: <b>${escapeHtml(type)}</b></div>
      <details>
        <summary>Raw JSON</summary>
        <pre class="report-json">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
      </details>
    `;
  }

  // Atualiza também o JSON antigo (para compatibilidade)
  const jsonEl = $("#json");
  if (jsonEl) {
    jsonEl.textContent = JSON.stringify(payload, null, 2);
  }
}

// ACTIONS (os "agentes")
const ACTIONS = {
  wallet_connect: async () => {
    // stub agora (Seed Vault entra depois)
    STORE.wallet.connected = true;
    STORE.wallet.address = "SeekerWalletStub111...";
    
    // Atualiza UI
    const statusEl = $("#wallet-status");
    const addrEl = $("#wallet-addr");
    if (statusEl) {
      statusEl.textContent = "CONNECTED";
      statusEl.className = "badge ok";
    }
    if (addrEl) {
      addrEl.textContent = STORE.wallet.address;
    }
    
    renderReport("wallet_connect", { ok: true, wallet: STORE.wallet });
  },

  scan_run: async () => {
    const rawTx = ($("#scanRawTx")?.value || "").trim();
    if (!rawTx) return renderReport("scan_run", { ok: false, error: "Cole uma rawTransaction." });

    // stub: depois vira POST /api/scan
    renderReport("scan_run", {
      ok: true,
      stub: true,
      input: { rawTxLen: rawTx.length },
      result: { shieldScore: 80, grade: "B", badges: [{ id: "mint_authority", level: "LOW" }] }
    });
  },

  simulate_run: async () => {
    const mint = ($("#simulateMint")?.value || "").trim();
    if (!mint) return renderReport("simulate_run", { ok: false, error: "Informe o mint." });

    // stub: depois vira POST /api/simulate
    renderReport("simulate_run", {
      ok: true,
      stub: true,
      input: { mint },
      result: { shieldScore: 68, grade: "C", badges: [{ id: "liquidity_lock", level: "MED" }] }
    });
  },

  settings_toggle_lang: async () => {
    STORE.lang = (STORE.lang === "pt-BR") ? "en-US" : "pt-BR";
    const btnLang = $("#btn-lang");
    if (btnLang) {
      btnLang.textContent = STORE.lang === "pt-BR" ? "PT-BR" : "EN-US";
    }
    renderReport("settings_toggle_lang", { ok: true, lang: STORE.lang });
  },

  settings_open: async () => {
    renderReport("settings_open", { ok: true, message: "SETTINGS: próximo passo é menu + idioma + configs" });
    alert("SETTINGS: próximo passo é menu + idioma + configs");
  }
};

// WIRES (liga botões -> actions)
function wireActions() {
  $$("[data-action]").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const key = btn.getAttribute("data-action");
      const fn = ACTIONS[key];
      if (!fn) return renderReport("wire_error", { ok: false, error: `Action não existe: ${key}` });
      try {
        await fn();
      } catch (err) {
        renderReport(key, { ok: false, error: String(err?.message || err) });
      }
    });
  });
}

// Bottom nav tabs (mantém funcionalidade existente)
function wireTabs() {
  $("#tab-home")?.addEventListener("click", () => setActiveTab("#tab-home"));
  $("#tab-scan")?.addEventListener("click", () => {
    setActiveTab("#tab-scan");
    $("#scanRawTx")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("#tab-sim")?.addEventListener("click", () => {
    setActiveTab("#tab-sim");
    $("#simulateMint")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("#tab-report")?.addEventListener("click", () => {
    setActiveTab("#tab-report");
    $("#reportOut")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function setActiveTab(id) {
  $$(".tab").forEach(t => t.classList.remove("active"));
  $(id)?.classList.add("active");
}

// init
function init() {
  wireActions();
  wireTabs();
  
  // Inicializa estado da wallet
  const statusEl = $("#wallet-status");
  const addrEl = $("#wallet-addr");
  if (statusEl) statusEl.textContent = "DISCONNECTED";
  if (addrEl) addrEl.textContent = "—";
  
  // Inicializa report
  renderReport("boot", { ok: true, lang: STORE.lang, wallet: STORE.wallet });
}

document.addEventListener("DOMContentLoaded", init);
