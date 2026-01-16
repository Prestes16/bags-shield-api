const $ = (id) => document.getElementById(id);

const STORE_RECENT  = "bagsShield.recentMints";
const STORE_LAST    = "bagsShield.lastReport";
const STORE_LANG    = "bagsShield.lang";
const STORE_WALLET  = "bagsShield.wallet";

const I18N = {
  en: {
    "splash.sub":"Risk check for memecoins on Solana",
    "splash.hint":"Loadingâ€¦",
    "home.subtitle":"Risk check for memecoins on Solana",
    "home.scan":"Scan",
    "home.recent":"Recent",
    "home.clear":"Clear",
    "home.recentEmpty":"No recent tokens yet. Scan a mint to start.",
    "home.sources":"Sources: Solana RPC Â· Bags API",
    "home.privacy":"Privacy: no personal data collected",
    "home.connect":"Connect wallet to simulate",
    "home.openLast":"Open last report",
    "common.details":"Details",
    "report.route":"Liquidity Route: Stable",
    "report.share":"Share report",
    "menu.home":"Home",
    "menu.report":"Report",
    "menu.dev":"Dev",
    "menu.lang":"Language",
    "menu.remember":"Remember this wallet (opt-in)",
    "menu.about":"About",
    "wallet.title":"Connect wallet",
    "wallet.recommended":"Recommended",
    "wallet.installed":"Installed",
    "common.continue":"Continue",
    "common.cancel":"Cancel"
  },
  pt: {
    "splash.sub":"VerificaÃ§Ã£o de risco para memecoins na Solana",
    "splash.hint":"Carregandoâ€¦",
    "home.subtitle":"VerificaÃ§Ã£o de risco para memecoins na Solana",
    "home.scan":"Scan",
    "home.recent":"Recentes",
    "home.clear":"Limpar",
    "home.recentEmpty":"Nenhum token recente ainda. FaÃ§a um scan para comeÃ§ar.",
    "home.sources":"Fontes: Solana RPC Â· Bags API",
    "home.privacy":"Privacidade: nenhum dado pessoal coletado",
    "home.connect":"Conectar carteira para simular",
    "home.openLast":"Abrir Ãºltimo relatÃ³rio",
    "common.details":"Detalhes",
    "report.route":"Rota de Liquidez: EstÃ¡vel",
    "report.share":"Compartilhar relatÃ³rio",
    "menu.home":"InÃ­cio",
    "menu.report":"RelatÃ³rio",
    "menu.dev":"Dev",
    "menu.lang":"Idioma",
    "menu.remember":"Lembrar esta carteira (opcional)",
    "menu.about":"Sobre",
    "wallet.title":"Conectar carteira",
    "wallet.recommended":"Recomendado",
    "wallet.installed":"Instalada",
    "common.continue":"Continuar",
    "common.cancel":"Cancelar"
  }
};

const state = {
  lang: "en",
  env: "PRODUCTION",
  wallet: null, // { type:'provider'|'mwa', name, pubkey, source }
  lastReport: null,
  recent: [],
  apiBase: "/api",
};

function detectLang(){
  const saved = localStorage.getItem(STORE_LANG);
  if (saved === "pt" || saved === "en") return saved;
  const nav = (navigator.language || "en").toLowerCase();
  return nav.startsWith("pt") ? "pt" : "en";
}

function t(key){
  const dict = I18N[state.lang] || I18N.en;
  return dict[key] || I18N.en[key] || key;
}

function applyI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const k = el.getAttribute("data-i18n");
    el.textContent = t(k);
  });
}

function show(id){
  ["screenSplash","screenHome","screenReport"].forEach(s=>{
    const el = $(s);
    if (!el) return;
    el.classList.toggle("hidden", s !== id);
  });
}

function openOverlay(id){
  const el = $(id);
  if (!el) return;
  el.classList.remove("hidden");
  el.setAttribute("aria-hidden","false");
}
function closeOverlay(id){
  const el = $(id);
  if (!el) return;
  el.classList.add("hidden");
  el.setAttribute("aria-hidden","true");
}

function shortMint(m){
  if (!m) return "--";
  if (m.length <= 10) return m;
  return m.slice(0,5) + "â€¦ " + m.slice(-4);
}

function readRecent(){
  try { return JSON.parse(localStorage.getItem(STORE_RECENT) || "[]") || []; }
  catch { return []; }
}
function saveRecent(list){
  localStorage.setItem(STORE_RECENT, JSON.stringify(list.slice(0,12)));
}

function renderRecent(){
  const list = state.recent || [];
  const empty = $("recentEmpty");
  const box = $("recentList");
  if (!box || !empty) return;

  box.innerHTML = "";
  empty.style.display = list.length ? "none" : "block";

  list.forEach(item=>{
    const row = document.createElement("div");
    row.className = "recentItem";
    row.innerHTML = `
      <div class="left">
        <div class="name">${item.symbol || "TOKEN"}</div>
        <div class="sub">${shortMint(item.mint)} Â· ${Math.round(item.score||0)} (${item.grade||"-"})</div>
      </div>
      <button class="btn ghost small">${t("common.details")}</button>
    `;
    row.querySelector("button").addEventListener("click", ()=>{
      loadReport(item.mint);
    });
    box.appendChild(row);
  });
}

function setNow(){
  const d = new Date();
  if ($("nowTxt")) $("nowTxt").textContent = d.toLocaleString();
}

function setEnv(){
  if ($("envTxt")) $("envTxt").textContent = state.env;
}

function toast(msg){
  // simples: usa o walletStatus se existir, senÃ£o console
  const ws = $("walletStatus");
  if (ws) ws.textContent = msg;
  console.log("[BS]", msg);
}

async function fetchJson(url, opts={}){
  const ctl = new AbortController();
  const t = setTimeout(()=>ctl.abort(), 15000);
  try{
    const res = await fetch(url, {
      ...opts,
      headers: {
        "content-type":"application/json",
        ...(opts.headers||{})
      },
      signal: ctl.signal
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw:text }; }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return data;
  } finally {
    clearTimeout(t);
  }
}

async function apiCall(path, payload){
  // fallback: /api/v0/* -> /api/*
  const candidates = [path, path.replace("/api/v0/","/api/")];
  let lastErr = null;
  for (const p of candidates){
    try{
      const t0 = performance.now();
      const data = await fetchJson(p, { method:"POST", body: JSON.stringify(payload) });
      const ms = Math.round(performance.now() - t0);
      if ($("apiLine")) $("apiLine").textContent = `API: OK Â· ${ms}ms`;
      return data;
    }catch(e){
      lastErr = e;
    }
  }
  if ($("apiLine")) $("apiLine").textContent = `API: FAIL`;
  throw lastErr || new Error("API call failed");
}

function normalizeReport(apiResp){
  const resp = apiResp?.response ?? apiResp ?? {};
  const score = Number(resp.shieldScore ?? resp.finalScore ?? resp.score ?? resp.totalScore ?? 0) || 0;
  const grade = String(resp.grade ?? resp.rank ?? resp.letter ?? "-");
  const badges = resp.badges ?? resp.riskBadges ?? resp.checks ?? [];
  return { raw: resp, score, grade, badges };
}

function badgePillClass(b){
  const s = String(b.status ?? b.level ?? b.severity ?? "").toLowerCase();
  if (s.includes("crit")) return "crit";
  if (s.includes("high")) return "high";
  if (s.includes("att"))  return "att";
  if (s.includes("warn")) return "att";
  if (s.includes("ok"))   return "ok";
  // fallback por boolean / risk
  if (b.ok === true) return "ok";
  if (b.risk === "CRITICAL") return "crit";
  if (b.risk === "HIGH") return "high";
  if (b.risk === "ATTENTION") return "att";
  return "ok";
}

function badgeTitle(b){
  return b.title ?? b.name ?? b.key ?? "Check";
}

function badgeStatusText(b){
  const s = String(b.status ?? b.level ?? b.severity ?? b.risk ?? "").toUpperCase();
  if (s) return s.replace("_"," ");
  return (b.ok === true) ? "OK" : "ATTENTION";
}

function setGauge(score){
  const v = Math.max(0, Math.min(100, Number(score)||0));
  const circle = document.querySelector(".gProg");
  const dash = 289;
  const off = dash - (dash * (v/100));
  if (circle) circle.style.strokeDashoffset = String(off);

  if ($("scoreTxt")) $("scoreTxt").textContent = String(Math.round(v));
  // cor do gauge por score
  let color = "var(--blue)";
  if (v < 45) color = "var(--crit)";
  else if (v < 65) color = "var(--high)";
  else if (v < 80) color = "var(--att)";
  circle && (circle.style.stroke = color);
}

function renderBadges(badges){
  const grid = $("badgesGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const list = Array.isArray(badges) ? badges : [];
  if (!list.length){
    const d = document.createElement("div");
    d.className = "muted";
    d.textContent = "No badges returned.";
    grid.appendChild(d);
    return;
  }
  list.slice(0,8).forEach(b=>{
    const cls = badgePillClass(b);
    const card = document.createElement("div");
    card.className = "badge glass";
    card.innerHTML = `
      <div class="title">${badgeTitle(b)}</div>
      <div class="row">
        <span class="pill2 ${cls}">${badgeStatusText(b)}</span>
        <span class="details">${t("common.details")}</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function doScan(mint){
  const payload = { mint };
  const data = await apiCall("/api/v0/scan", payload);
  const rep = normalizeReport(data);
  const report = { mint, score: rep.score, grade: rep.grade, badges: rep.badges, ts: Date.now() };

  state.lastReport = report;
  localStorage.setItem(STORE_LAST, JSON.stringify(report));

  // recent
  const item = { mint, symbol: (rep.raw?.symbol ?? "TOKEN"), score: rep.score, grade: rep.grade, ts: Date.now() };
  state.recent = [item, ...state.recent.filter(x=>x.mint!==mint)].slice(0,12);
  saveRecent(state.recent);
  renderRecent();

  openReport(report);
  return report;
}

function openReport(report){
  if (!report) return;
  $("mintShort") && ($("mintShort").textContent = shortMint(report.mint));
  $("gradeTxt") && ($("gradeTxt").textContent = `(${report.grade})`);
  setGauge(report.score);
  renderBadges(report.badges);
  show("screenReport");
}

async function loadReport(mint){
  // se for o Ãºltimo, usa cache local
  if (state.lastReport?.mint === mint){
    openReport(state.lastReport);
    return;
  }
  // senÃ£o re-scan
  await doScan(mint);
}

/* Wallet */
function detectProvider(){
  const p = window.solana;
  if (!p || typeof p.connect !== "function") return null;
  return p;
}

function setWalletState(w){
  state.wallet = w;
  if ($("walletTxt")) $("walletTxt").textContent = w ? `${w.name} ${shortMint(w.pubkey)}` : "none";
  localStorage.setItem(STORE_WALLET, JSON.stringify(w || null));
}

function loadWalletState(){
  try {
    const w = JSON.parse(localStorage.getItem(STORE_WALLET) || "null");
    if (w && typeof w.pubkey === "string") state.wallet = w;
  } catch {}
}

async function connectProvider(name){
  const p = detectProvider();
  if (!p) throw new Error("No window.solana provider");
  const res = await p.connect();
  const pubkey = (res?.publicKey?.toString?.() || p.publicKey?.toString?.() || "").toString();
  if (!pubkey) throw new Error("Provider connected but no publicKey");
  setWalletState({ type:"provider", name, pubkey, source:name.toLowerCase() });
  toast(`${name} connected: ${shortMint(pubkey)}`);
}

async function connectMWA(){
  // carrega libs sob demanda
  const [{ transact }, bs58] = await Promise.all([
    import("https://esm.sh/@solana-mobile/mobile-wallet-adapter-protocol-web3js@2.1.0"),
    import("https://esm.sh/bs58@5.0.0")
  ]);

  const icon = `${location.origin}/icons/icon-192.png`;

  const authResult = await transact(async (wallet) => {
    return wallet.authorize({
      cluster: "mainnet-beta",
      identity: {
        name: "Bags Shield",
        uri: location.origin,
        icon
      }
    });
  });

  const acct = authResult?.accounts?.[0];
  const addrBytes = acct?.address;
  if (!addrBytes) throw new Error("MWA authorize returned no account");

  const pubkey = bs58.default.encode(addrBytes);
  setWalletState({ type:"mwa", name:"Seed Vault", pubkey, source:"seed-vault" });
  toast(`MWA connected: ${shortMint(pubkey)}`);
}

async function simulateWithWallet(){
  // chama simulate; se wallet for MWA manda source seed-vault
  const mint = ($("mintInput")?.value || "").trim();
  if (!mint) throw new Error("Mint vazio");
  if (!state.wallet?.pubkey) throw new Error("Wallet nÃ£o conectada");

  const payload = {
    mint,
    wallet: state.wallet.pubkey,
    source: state.wallet.source || "ui"
  };
  const data = await apiCall("/api/v0/simulate", payload);
  toast("simulate OK");
  return data;
}

function wire(){
  state.lang = detectLang();
  applyI18n();

  state.recent = readRecent();
  renderRecent();

  loadWalletState();

  $("buildTxt") && ($("buildTxt").textContent = window.__BUILD__ || "dev");
  $("hostTxt") && ($("hostTxt").textContent = location.host);

  setEnv();
  setNow();
  setInterval(setNow, 1000);

  // splash -> home
  show("screenSplash");
  setTimeout(()=>show("screenHome"), 900);

  // menu
  const openMenu = ()=>openOverlay("menuOverlay");
  const closeMenu = ()=>closeOverlay("menuOverlay");
  $("btnMenu")?.addEventListener("click", openMenu);
  $("btnMenu2")?.addEventListener("click", openMenu);
  $("btnCloseMenu")?.addEventListener("click", closeMenu);
  $("menuOverlay")?.addEventListener("click", (e)=>{ if (e.target?.id==="menuOverlay") closeMenu(); });

  $("navHome")?.addEventListener("click", ()=>{ closeMenu(); show("screenHome"); });
  $("navReport")?.addEventListener("click", ()=>{ closeMenu(); state.lastReport ? openReport(state.lastReport) : toast("No last report"); });
  $("navDev")?.addEventListener("click", ()=>{
    const box = $("devBox");
    if (box) box.classList.toggle("hidden");
  });
  $("navAbout")?.addEventListener("click", ()=>{
    toast("Bags Shield â€” UI mock + API v0 scan/simulate");
  });

  // lang toggle
  $("langEN")?.addEventListener("click", ()=>{ state.lang="en"; localStorage.setItem(STORE_LANG,"en"); applyI18n(); renderRecent(); });
  $("langPT")?.addEventListener("click", ()=>{ state.lang="pt"; localStorage.setItem(STORE_LANG,"pt"); applyI18n(); renderRecent(); });

  // remember wallet
  const chk = $("chkRemember");
  if (chk){
    chk.checked = !!localStorage.getItem(STORE_WALLET);
    chk.addEventListener("change", ()=>{
      if (!chk.checked){
        localStorage.removeItem(STORE_WALLET);
        toast("Wallet not remembered");
      } else if (state.wallet){
        localStorage.setItem(STORE_WALLET, JSON.stringify(state.wallet));
        toast("Wallet remembered");
      }
    });
  }

  // home actions
  $("btnClearRecent")?.addEventListener("click", ()=>{
    state.recent = [];
    saveRecent([]);
    renderRecent();
  });

  $("btnScan")?.addEventListener("click", async ()=>{
    try{
      const mint = ($("mintInput")?.value || "").trim();
      if (!mint) return toast("Mint vazio");
      await doScan(mint);
    }catch(e){ toast(String(e.message||e)); }
  });

  $("btnOpenLast")?.addEventListener("click", ()=>{
    try{
      const raw = localStorage.getItem(STORE_LAST);
      if (!raw) return toast("No last report");
      state.lastReport = JSON.parse(raw);
      openReport(state.lastReport);
    }catch(e){ toast("Failed to open last report"); }
  });

  $("btnBackHome")?.addEventListener("click", ()=>show("screenHome"));

  // wallet modal
  const openWallet = ()=>{
    // detect provider
    const p = detectProvider();
    $("wPhantomState") && ($("wPhantomState").textContent = p ? "Installed" : "â€”");
    $("wSolflareState") && ($("wSolflareState").textContent = p ? "Installed" : "â€”");
    $("walletStatus") && ($("walletStatus").textContent = state.wallet ? `${state.wallet.name} connected` : "Select a wallet");
    openOverlay("walletOverlay");
  };
  const closeWallet = ()=>closeOverlay("walletOverlay");

  $("btnConnect")?.addEventListener("click", openWallet);
  $("btnConnect2")?.addEventListener("click", openWallet);
  $("btnCloseWallet")?.addEventListener("click", closeWallet);
  $("btnWalletCancel")?.addEventListener("click", closeWallet);
  $("walletOverlay")?.addEventListener("click", (e)=>{ if (e.target?.id==="walletOverlay") closeWallet(); });

  $("wPhantom")?.addEventListener("click", async ()=>{
    try{ await connectProvider("Phantom"); $("walletStatus").textContent = "Connected"; }
    catch(e){ $("walletStatus").textContent = String(e.message||e); }
  });
  $("wSolflare")?.addEventListener("click", async ()=>{
    try{ await connectProvider("Solflare"); $("walletStatus").textContent = "Connected"; }
    catch(e){ $("walletStatus").textContent = String(e.message||e); }
  });
  $("wMWA")?.addEventListener("click", async ()=>{
    try{ await connectMWA(); $("walletStatus").textContent = "Connected (MWA)"; }
    catch(e){ $("walletStatus").textContent = "MWA failed: " + String(e.message||e); }
  });

  $("btnWalletContinue")?.addEventListener("click", async ()=>{
    try{
      if (!state.wallet) return toast("No wallet connected");
      closeWallet();

      // demonstra: quando conecta, jÃ¡ tenta simulate (pra provar que tÃ¡ vivo)
      await simulateWithWallet();
      toast("SeedVault/Wallet simulate call OK");
    }catch(e){ toast(String(e.message||e)); }
  });

  // carregar lastReport no boot
  try{
    const raw = localStorage.getItem(STORE_LAST);
    if (raw) state.lastReport = JSON.parse(raw);
  }catch{}
}

wire();
