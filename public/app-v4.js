// Helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

// STORE
const STORE = {
  currentView: "splash",
  selectedMint: null
};

// Helper: escape HTML
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Dev Log helper
function log(message, data = null) {
  const logContent = $("#logContent");
  if (logContent) {
    const entry = document.createElement("div");
    entry.className = "log-entry";

    const time = new Date().toLocaleTimeString();
    const messageSpan = document.createElement("span");
    messageSpan.className = data?.error ? "log-error" : "log-message";
    messageSpan.textContent = message;

    entry.innerHTML = `<span class="log-time">${time}</span>`;
    entry.appendChild(messageSpan);

    if (data) {
      const dataSpan = document.createElement("span");
      dataSpan.style.marginLeft = "8px";
      dataSpan.style.color = "rgba(255, 255, 255, 0.65)";
      dataSpan.textContent = typeof data === "string" ? data : JSON.stringify(data);
      entry.appendChild(dataSpan);
    }

    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight;
  } else {
    console.log("[BS]", message, data);
  }
}

// API helper
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

// Trending Tokens
async function fetchTrendingTokens() {
  // obrigatoriamente via nosso backend (evita CORS, protege key e padroniza shape)
  const url = "/api/bags/trending";

  const r = await apiFetch(url, { method: "GET" });
  // esperamos: { success:true, response:{ tokens:[...] } }
  const tokens = r?.response?.tokens;

  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error("No trending tokens from Bags API");
  }
  return tokens;
}

function renderTrendingError(message) {
  const host = document.getElementById("trendOverlay");
  if (!host) return;

  host.innerHTML = `
    <div class="trend-item" style="cursor:default; opacity:0.9;">
      <div class="trend-icon">!</div>
      <div class="trend-name">
        <div class="trend-sym">Unable to load</div>
        <div class="trend-sub">${escapeHtml(message || "Bags API unavailable")}</div>
      </div>
      <div class="trend-right">
        <div class="trend-pill attention">Attention</div>
      </div>
    </div>
  `;
}

function renderTrending(tokens) {
  const host = document.getElementById("trendOverlay");
  if (!host) return;

  host.innerHTML = "";
  const top = tokens.slice(0, 4);

  for (const t of top) {
    const sym = (t.symbol || t.ticker || "TOKEN").toString();
    const name = (t.name || sym).toString();
    const mint = (t.mint || t.address || "").toString();
    const pct = typeof t.change24h === "number" ? t.change24h : (typeof t.pct24h === "number" ? t.pct24h : null);

    const badge = (t.badge || t.risk || "ok").toString().toLowerCase();
    const badgeClass = badge.includes("high") ? "high" : (badge.includes("att") ? "attention" : "ok");
    const badgeText = badgeClass === "high" ? "High" : (badgeClass === "attention" ? "Attention" : "OK");

    const row = document.createElement("div");
    row.className = "trend-item";
    row.setAttribute("role", "button");
    row.tabIndex = 0;

    row.innerHTML = `
      <div class="trend-icon">${sym.slice(0,1)}</div>
      <div class="trend-name">
        <div class="trend-sym">${escapeHtml(sym)}</div>
        <div class="trend-sub">${escapeHtml(name)}</div>
      </div>
      <div class="trend-right">
        <div class="trend-pct">${pct === null ? "" : `${pct.toFixed(1)}%`}</div>
        <div class="trend-pill ${badgeClass}">${badgeText}</div>
      </div>
    `;

    const open = () => {
      STORE.selectedMint = mint || sym;
      log("TRENDING_TOKEN_CLICK", { symbol: sym, mint: STORE.selectedMint });
      // Próximo passo (em outro 1×1): navegar pra tela ShieldScore e buscar o relatório real
      // navigate("shieldscore");
    };

    row.addEventListener("click", open);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") open(); });

    host.appendChild(row);
  }
}

// ACTIONS
const ACTIONS = {
  nav_home: () => {
    navigate("home");
    log("nav_home", "→ home view");
  },

  nav_scan: () => {
    log("nav_scan", "TODO: scan screen");
  },

  nav_simulate: () => {
    log("nav_simulate", "TODO: simulate screen");
  },

  nav_settings: () => {
    log("nav_settings", "TODO: settings screen");
  }
};

// View management
function navigate(viewName) {
  STORE.currentView = viewName;
  $$(".view").forEach(view => {
    const viewId = `view-${viewName}`;
    view.classList.toggle("hidden", view.id !== viewId);
  });
  
  // Quando a HOME carregar, busca e renderiza trending
  if (viewName === "home") {
    (async () => {
      try {
        const tokens = await fetchTrendingTokens();
        renderTrending(tokens);
        log("TRENDING_LOADED", { count: tokens.length });
      } catch (err) {
        renderTrendingError("Bags trending not available");
        log("TRENDING_FAILED", { error: String(err) });
      }
    })();
  }
}

function showView(id) {
  navigate(id);
}

// Wire actions
function wireActions() {
  $$("[data-action]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const key = btn.getAttribute("data-action");
      const fn = ACTIONS[key];
      if (fn) {
        try {
          fn();
        } catch (err) {
          log(key, { error: String(err?.message || err) });
        }
      } else {
        log("wire_error", `Action não existe: ${key}`);
      }
    });
  });
}

// Boot
function boot() {
  wireActions();
  navigate("splash");

  // Hotspot Debug: tecla "H" liga/desliga as áreas clicáveis
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "h") {
      const root = document.documentElement;
      const on = root.getAttribute("data-debug-hotspots") === "1";
      root.setAttribute("data-debug-hotspots", on ? "0" : "1");
      log("debug_hotspots", { enabled: !on });
    }
  });
}

document.addEventListener("DOMContentLoaded", boot);
