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
  out.innerHTML = `
    <div class="report-meta">Last action: <b>${escapeHtml(type)}</b></div>
    <pre class="report-json">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
  `;

  // Atualiza também o JSON antigo (para compatibilidade)
  const jsonEl = $("#json");
  if (jsonEl) {
    jsonEl.textContent = JSON.stringify(payload, null, 2);
  }

  // Atualiza score/grade/badges se disponível
  if (payload?.result) {
    const score = payload.result.shieldScore ?? payload.result.score;
    const grade = payload.result.grade;
    const badges = payload.result.badges ?? [];

    if (score !== undefined && $("#score")) {
      $("#score").textContent = String(Math.round(score));
    }
    if (grade && $("#grade")) {
      $("#grade").textContent = `(${grade})`;
    }
    if (badges.length > 0 && $("#badges")) {
      const wrap = $("#badges");
      wrap.innerHTML = "";
      badges.forEach(b => {
        const div = document.createElement("div");
        const level = (b.level || "neutral").toLowerCase();
        div.className = "chip " + (level === "low" || level === "good" ? "good" : level === "med" || level === "warn" ? "warn" : level === "high" || level === "bad" ? "bad" : "neutral");
        div.textContent = b.id || b.label || "badge";
        wrap.appendChild(div);
      });
    }
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
