const $ = (sel) => document.querySelector(sel);

const state = {
  lang: "PT-BR",
  wallet: { connected: false, address: null },
  last: { score: null, grade: null, badges: [], raw: null },
};

function setLang(next) {
  state.lang = next;
  $("#btn-lang").textContent = next;
}

function walletSet(connected, address) {
  state.wallet.connected = connected;
  state.wallet.address = address;

  $("#wallet-status").textContent = connected ? "CONNECTED" : "DISCONNECTED";
  $("#wallet-status").className = "badge " + (connected ? "ok" : "neutral");
  $("#wallet-addr").textContent = address ?? "—";
}

function renderReport(payload) {
  // payload esperado (futuro): { score, grade, badges:[{key,level,label}], raw }
  const score = payload?.score ?? "—";
  const grade = payload?.grade ?? "—";
  const badges = payload?.badges ?? [{ label: "No data yet", level: "neutral" }];
  const raw = payload?.raw ?? { status: "waiting" };

  $("#score").textContent = score;
  $("#grade").textContent = grade;

  const wrap = $("#badges");
  wrap.innerHTML = "";
  for (const b of badges) {
    const div = document.createElement("div");
    const level = b.level || "neutral";
    div.className = "chip " + (level === "good" ? "good" : level === "warn" ? "warn" : level === "bad" ? "bad" : "neutral");
    div.textContent = b.label || b.key || "badge";
    wrap.appendChild(div);
  }

  $("#json").textContent = JSON.stringify(raw, null, 2);
}

/**
 * AGENTES (stubs agora; depois a gente liga API e Wallet de verdade)
 */
const actions = {
  async connectWallet() {
    // stub: simula conexão
    walletSet(true, "So1aNa...DemoAddress");
  },

  async runScan() {
    const rawTx = $("#in-rawtx").value.trim();
    const net = $("#in-network").value;

    if (!rawTx) {
      $("#out-scan").textContent = "Cole uma rawTransaction (base64) para escanear.";
      return;
    }

    $("#out-scan").textContent = `SCAN (stub): network=${net} | len=${rawTx.length}`;
    // stub report
    renderReport({
      score: 80,
      grade: "B",
      badges: [
        { label: "No honeypot detected", level: "good" },
        { label: "New deploy risk", level: "warn" },
        { label: "LP lock unknown", level: "warn" },
      ],
      raw: { stub: true, action: "scan", network: net, rawLen: rawTx.length },
    });
  },

  async runSimulate() {
    const mint = $("#in-mint").value.trim();
    const quote = $("#in-quote").value.trim() || "USDC";

    if (!mint) {
      $("#out-sim").textContent = "Informe um mint para simular.";
      return;
    }

    $("#out-sim").textContent = `SIMULATE (stub): mint=${mint.slice(0, 10)}... | quote=${quote}`;
    // stub report
    renderReport({
      score: 68,
      grade: "C",
      badges: [
        { label: "High tax risk", level: "bad" },
        { label: "Creator concentration", level: "warn" },
        { label: "Liquidity ok", level: "good" },
      ],
      raw: { stub: true, action: "simulate", mint, quote },
    });
  },
};

function bind() {
  $("#btn-lang").addEventListener("click", () => {
    setLang(state.lang === "PT-BR" ? "EN" : "PT-BR");
  });

  $("#btn-connect").addEventListener("click", actions.connectWallet);
  $("#btn-scan").addEventListener("click", actions.runScan);
  $("#btn-simulate").addEventListener("click", actions.runSimulate);

  $("#btn-settings").addEventListener("click", () => {
    alert("SETTINGS: próximo passo é menu + idioma + configs");
  });

  $("#tab-home").addEventListener("click", () => setActiveTab("#tab-home"));
  $("#tab-scan").addEventListener("click", () => { setActiveTab("#tab-scan"); document.getElementById("in-rawtx").scrollIntoView({behavior:"smooth", block:"center"}); });
  $("#tab-sim").addEventListener("click", () => { setActiveTab("#tab-sim"); document.getElementById("in-mint").scrollIntoView({behavior:"smooth", block:"center"}); });
  $("#tab-report").addEventListener("click", () => { setActiveTab("#tab-report"); document.getElementById("json").scrollIntoView({behavior:"smooth", block:"center"}); });

  // boot state
  walletSet(false, null);
  renderReport(null);
}

function setActiveTab(id) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelector(id).classList.add("active");
}

window.addEventListener("DOMContentLoaded", bind);
