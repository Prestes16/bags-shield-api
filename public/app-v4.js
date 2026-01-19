// Helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

// STORE
const STORE = {
  currentView: "splash",
  selectedMint: null,
  wallet: null,
  pendingTransaction: null,
  pendingTokenInfo: null,
  history: []
};

const STORE_WALLET = "bagsShield.v4.wallet";
const STORE_HISTORY = "bagsShield.v4.history";

// Helper: short mint address
function shortMint(mint) {
  if (!mint || mint.length < 8) return mint || "";
  return `${mint.slice(0, 4)}....${mint.slice(-4)}`;
}

// Wallet Management
function detectProvider() {
  if (typeof window !== "undefined" && window.solana) {
    return window.solana;
  }
  return null;
}

function setWalletState(wallet) {
  STORE.wallet = wallet;
  if (wallet) {
    try {
      localStorage.setItem(STORE_WALLET, JSON.stringify(wallet));
    } catch (e) {
      log("wallet_save_error", e);
    }
  } else {
    try {
      localStorage.removeItem(STORE_WALLET);
    } catch (e) {
      log("wallet_remove_error", e);
    }
  }
  updateWalletStatus();
}

function loadWalletState() {
  try {
    const stored = localStorage.getItem(STORE_WALLET);
    if (stored) {
      STORE.wallet = JSON.parse(stored);
      updateWalletStatus();
    }
  } catch (e) {
    log("wallet_load_error", e);
  }
}

function updateWalletStatus() {
  const infoEl = $("#home-wallet-info");
  if (!infoEl) return;
  
  if (STORE.wallet) {
    const short = shortMint(STORE.wallet.pubkey);
    infoEl.innerHTML = `<span>${STORE.wallet.name}: ${short}</span> <button data-action="wallet_disconnect">Disconnect</button>`;
  } else {
    infoEl.innerHTML = `<button class="wallet-connect-btn" data-action="open_wallet_modal">Connect Wallet</button>`;
  }
  wireActions();
}

async function connectProvider(name) {
  const provider = detectProvider();
  if (!provider) {
    throw new Error(`${name} not detected. Please install the extension.`);
  }
  
  try {
    const resp = await provider.connect();
    setWalletState({
      type: "provider",
      name: name,
      pubkey: resp.publicKey.toString(),
      source: "extension",
      provider: provider
    });
    log("wallet_connected", { name, pubkey: resp.publicKey.toString() });
    return resp;
  } catch (e) {
    log("wallet_connect_error", e);
    throw e;
  }
}

async function connectMWA() {
  if (typeof window === "undefined" || !window.solanaMobileWalletAdapter) {
    throw new Error("Mobile Wallet Adapter not available");
  }
  
  try {
    const adapter = window.solanaMobileWalletAdapter;
    const resp = await adapter.connect();
    setWalletState({
      type: "mwa",
      name: "Seed Vault",
      pubkey: resp.publicKey.toString(),
      source: "mwa"
    });
    log("wallet_connected_mwa", { pubkey: resp.publicKey.toString() });
    return resp;
  } catch (e) {
    log("wallet_connect_mwa_error", e);
    throw e;
  }
}

async function signTransaction(txBase64) {
  if (!STORE.wallet) {
    throw new Error("No wallet connected");
  }
  
  if (STORE.wallet.type === "provider" && STORE.wallet.provider) {
    const tx = Buffer.from(txBase64, "base64");
    const signed = await STORE.wallet.provider.signTransaction(tx);
    return Buffer.from(signed.serialize()).toString("base64");
  } else if (STORE.wallet.type === "mwa") {
    const adapter = window.solanaMobileWalletAdapter;
    const tx = Buffer.from(txBase64, "base64");
    const signed = await adapter.signTransaction(tx);
    return Buffer.from(signed.serialize()).toString("base64");
  }
  
  throw new Error("Wallet type not supported for signing");
}

// History Management
function loadHistory() {
  try {
    const stored = localStorage.getItem(STORE_HISTORY);
    if (stored) {
      STORE.history = JSON.parse(stored);
    }
  } catch (e) {
    log("history_load_error", e);
    STORE.history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORE_HISTORY, JSON.stringify(STORE.history));
  } catch (e) {
    log("history_save_error", e);
  }
}

function addHistoryEntry(type, data) {
  const entry = {
    id: Date.now().toString(36),
    type,
    timestamp: Date.now(),
    ...data
  };
  STORE.history.unshift(entry);
  if (STORE.history.length > 100) {
    STORE.history = STORE.history.slice(0, 100);
  }
  saveHistory();
  return entry;
}

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

// Scan Transaction
async function runScan() {
  const rawTx = $("#scan-raw-tx")?.value?.trim();
  const network = $("#scan-network")?.value || "mainnet-beta";
  const resultEl = $("#scan-result");
  
  if (!rawTx) {
    if (resultEl) resultEl.textContent = "Error: Please paste a raw transaction";
    return;
  }
  
  try {
    const result = await apiFetch("/api/scan", {
      method: "POST",
      body: {
        rawTransaction: rawTx,
        network,
        wallet: STORE.wallet?.pubkey,
        source: "app-v4"
      }
    });
    
    if (resultEl) {
      resultEl.textContent = JSON.stringify(result, null, 2);
    }
    
    addHistoryEntry("scan", {
      network,
      shieldScore: result?.response?.shieldScore,
      grade: result?.response?.grade,
      isSafe: result?.response?.isSafe
    });
    
    log("scan_success", result);
  } catch (e) {
    if (resultEl) {
      resultEl.textContent = `Error: ${e.message}`;
    }
    log("scan_error", e);
  }
}

// Simulate Swap
async function runSimulate() {
  const mint = $("#simulate-mint-input")?.value?.trim();
  const amount = parseFloat($("#simulate-amount-input")?.value || "0");
  const slippageBps = parseInt($("#simulate-slippage-input")?.value || "50");
  const isBuy = $("#simulate-buy-btn")?.classList?.contains("active");
  const resultEl = $("#simulate-result");
  
  if (!mint || amount <= 0) {
    if (resultEl) resultEl.textContent = "Error: Please fill all fields";
    return;
  }
  
  try {
    const result = await apiFetch("/api/simulate", {
      method: "POST",
      body: {
        mint,
        action: isBuy ? "buy" : "sell",
        amount: amount.toString(),
        slippageBps,
        wallet: STORE.wallet?.pubkey
      }
    });
    
    if (resultEl) {
      resultEl.textContent = JSON.stringify(result, null, 2);
    }
    
    STORE.pendingTransaction = {
      mint,
      action: isBuy ? "buy" : "sell",
      amount,
      slippageBps,
      result
    };
    
    addHistoryEntry("simulate", {
      mint,
      action: isBuy ? "buy" : "sell",
      amount,
      shieldScore: result?.response?.shieldScore,
      grade: result?.response?.grade
    });
    
    log("simulate_success", result);
  } catch (e) {
    if (resultEl) {
      resultEl.textContent = `Error: ${e.message}`;
    }
    log("simulate_error", e);
  }
}

// Buy/Sell Token
async function getSwapQuote(mint, action, amount, slippageBps) {
  return await apiFetch("/api/simulate", {
    method: "POST",
    body: { mint, action, amount: amount.toString(), slippageBps }
  });
}

async function scanTransactionBeforeExecute(rawTransaction, network) {
  return await apiFetch("/api/scan", {
    method: "POST",
    body: { rawTransaction, network, wallet: STORE.wallet?.pubkey }
  });
}

async function buyTokenWithWallet(mint, solAmount, slippageBps = 50) {
  if (!STORE.wallet) {
    throw new Error("Wallet not connected");
  }
  
  const quote = await getSwapQuote(mint, "buy", solAmount, slippageBps);
  const scanResult = await scanTransactionBeforeExecute(quote?.response?.rawTransaction || "", "mainnet-beta");
  
  STORE.pendingTransaction = {
    type: "buy",
    mint,
    solAmount,
    slippageBps,
    quote,
    scanResult
  };
  
  navigate("preview-transaction");
  renderPreviewTransaction(STORE.pendingTransaction);
}

async function sellTokenWithWallet(mint, tokenAmount, slippageBps = 50) {
  if (!STORE.wallet) {
    throw new Error("Wallet not connected");
  }
  
  const quote = await getSwapQuote(mint, "sell", tokenAmount, slippageBps);
  const scanResult = await scanTransactionBeforeExecute(quote?.response?.rawTransaction || "", "mainnet-beta");
  
  STORE.pendingTransaction = {
    type: "sell",
    mint,
    tokenAmount,
    slippageBps,
    quote,
    scanResult
  };
  
  navigate("preview-transaction");
  renderPreviewTransaction(STORE.pendingTransaction);
}

function renderPreviewTransaction(pending) {
  if (!pending) return;
  
  const quote = pending.quote?.response;
  const scan = pending.scanResult?.response;
  
  // Token info
  const tokenName = quote?.tokenSymbol || pending.mint ? shortMint(pending.mint) : "TOKEN";
  const tokenAddress = pending.mint ? shortMint(pending.mint) : "";
  $("#preview-token-name").textContent = tokenName;
  $("#preview-token-address").textContent = tokenAddress;
  
  // Amount
  const amount = pending.type === "buy" 
    ? `${pending.solAmount} SOL` 
    : `${pending.tokenAmount} TOKENS`;
  $("#preview-amount").textContent = amount;
  
  // Score and grade
  const grade = scan?.grade || "N/A";
  const score = scan?.shieldScore || "";
  $("#preview-score").textContent = `${grade} ${score}`;
  
  // Token price
  const price = quote?.price ? `1 SOL = ${quote.price.toLocaleString()} ${tokenName}` : "Price: N/A";
  $("#preview-token-price").textContent = price;
  
  // Slippage
  const slippage = pending.slippageBps ? `${(pending.slippageBps / 100).toFixed(2)}%` : "0.5%";
  $("#preview-slippage").textContent = slippage;
  
  // Estimated received
  const estimated = quote?.estimatedOut 
    ? `${quote.estimatedOut.toLocaleString()} ${tokenName} (after fees)`
    : "Calculating...";
  $("#preview-estimated").textContent = estimated;
  
  // Route
  const route = quote?.route || quote?.dex || "Meteora → Raydium";
  $("#preview-route").textContent = route;
  
  // Network fee
  const networkFee = quote?.networkFee || "0.000005 SOL";
  $("#preview-network-fee").textContent = networkFee;
  
  // Liquidity fee
  const liquidityFee = quote?.liquidityFee || "0.25%";
  $("#preview-liquidity-fee").textContent = liquidityFee;
  
  // Price impact
  const priceImpact = quote?.priceImpact ? `${quote.priceImpact.toFixed(2)}%` : "0.42%";
  $("#preview-price-impact").textContent = priceImpact;
  
  // Risk badges
  if (scan?.badges && scan.badges.length > 0) {
    const badgesEl = $("#preview-risk-badges");
    if (badgesEl) {
      badgesEl.innerHTML = scan.badges.map(b => {
        const severity = b.severity || "ok";
        const label = b.label || b.id || "Unknown";
        return `<div class="risk-badge ${severity}">${escapeHtml(label)}</div>`;
      }).join("");
    }
  } else {
    const badgesEl = $("#preview-risk-badges");
    if (badgesEl) {
      badgesEl.innerHTML = '<div class="risk-badge ok">No risks detected</div>';
    }
  }
  
  // Wallet status
  const walletStatusEl = $("#preview-wallet-status");
  if (walletStatusEl) {
    if (STORE.wallet) {
      const walletName = STORE.wallet.name || "Wallet";
      const walletIcon = STORE.wallet.type === "mwa" ? "💜" : "👛";
      walletStatusEl.innerHTML = `
        <div class="wallet-icon">${walletIcon}</div>
        <span>${walletName} connected</span>
      `;
    } else {
      walletStatusEl.innerHTML = `
        <div class="wallet-icon">⚠️</div>
        <span>No wallet connected</span>
      `;
    }
  }
}

async function executeTransaction() {
  if (!STORE.pendingTransaction) {
    throw new Error("No pending transaction");
  }
  
  if (!STORE.wallet) {
    throw new Error("Wallet not connected. Please connect a wallet first.");
  }
  
  const pending = STORE.pendingTransaction;
  const rawTx = pending.quote?.response?.rawTransaction || pending.rawTransaction;
  
  // Show loading state
  const confirmBtn = $("[data-action='preview_confirm_transaction']");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Signing...";
  }
  
  try {
    if (!rawTx) {
      // Mock execution for now (no real transaction available)
      addHistoryEntry("execute", {
        type: pending.type,
        mint: pending.mint,
        amount: pending.type === "buy" ? pending.solAmount : pending.tokenAmount,
        status: "mock-executed",
        timestamp: Date.now(),
        note: "No rawTransaction available - mock mode"
      });
      
      log("execute_mock", { type: pending.type, mint: pending.mint });
      
      if (confirmBtn) {
        confirmBtn.textContent = "Mock Executed";
        confirmBtn.style.background = "#4ade80";
      }
      
      setTimeout(() => {
        alert("Transaction executed (mock mode - no on-chain action)\n\nIn production, this would sign and send the transaction to the Solana network.");
        navigate("home");
      }, 1000);
      return;
    }
    
    // Sign transaction
    log("execute_signing", { txLength: rawTx.length });
    const signedTx = await signTransaction(rawTx);
    log("execute_signed", { signedTxLength: signedTx.length });
    
    // TODO: Send signed transaction to network via RPC
    // For now, just log and show success
    const txHash = "mock_" + Date.now().toString(36);
    
    addHistoryEntry("execute", {
      type: pending.type,
      mint: pending.mint,
      amount: pending.type === "buy" ? pending.solAmount : pending.tokenAmount,
      status: "signed",
      txHash,
      timestamp: Date.now(),
      note: "Transaction signed but not sent (RPC send not implemented)"
    });
    
    if (confirmBtn) {
      confirmBtn.textContent = "Signed ✓";
      confirmBtn.style.background = "#4ade80";
    }
    
    setTimeout(() => {
      alert(`Transaction signed successfully!\n\nHash: ${txHash}\n\nNote: Transaction sending to network is not yet implemented.`);
      navigate("home");
    }, 1000);
    
  } catch (e) {
    log("execute_error", e);
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Confirm transaction";
      confirmBtn.style.background = "";
    }
    throw e;
  }
}

// Render History
function renderHistory() {
  const listEl = $("#history-list");
  if (!listEl) return;
  
  if (STORE.history.length === 0) {
    listEl.innerHTML = '<div class="history-empty">No history yet</div>';
    return;
  }
  
  listEl.innerHTML = STORE.history.map(entry => {
    const date = new Date(entry.timestamp).toLocaleString();
    return `
      <div class="history-item">
        <div class="history-type">${entry.type}</div>
        <div class="history-details">
          ${entry.mint ? shortMint(entry.mint) : ""}
          ${entry.shieldScore ? `Score: ${entry.shieldScore}` : ""}
          ${entry.grade ? `Grade: ${entry.grade}` : ""}
        </div>
        <div class="history-time">${date}</div>
        <button data-action="share_history_${entry.id}">Share</button>
      </div>
    `;
  }).join("");
  
  wireActions();
}

// Share functionality
function generateShareCard(data) {
  const canvas = $("#share-canvas");
  if (!canvas) return;
  
  const ctx = canvas.getContext("2d");
  const width = 800;
  const height = 400;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.5, "#0a1429");
  gradient.addColorStop(1, "#020617");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Header
  ctx.fillStyle = "#7af0d6";
  ctx.font = "bold 36px system-ui";
  ctx.fillText("🛡️ Bags Shield", 40, 60);
  
  // Type
  ctx.fillStyle = "#4dd4ff";
  ctx.font = "20px system-ui";
  const type = data.type || "Result";
  ctx.fillText(type.toUpperCase(), 40, 100);
  
  // Main content
  ctx.fillStyle = "#e8f4ff";
  ctx.font = "18px system-ui";
  let y = 150;
  
  if (data.grade) {
    ctx.fillText(`Grade: ${data.grade}`, 40, y);
    y += 35;
  }
  if (data.shieldScore !== undefined) {
    ctx.fillText(`Shield Score: ${data.shieldScore}`, 40, y);
    y += 35;
  }
  if (data.mint) {
    ctx.fillText(`Token: ${shortMint(data.mint)}`, 40, y);
    y += 35;
  }
  if (data.amount) {
    ctx.fillText(`Amount: ${data.amount}`, 40, y);
    y += 35;
  }
  if (data.isSafe !== undefined) {
    ctx.fillStyle = data.isSafe ? "#4ade80" : "#f87171";
    ctx.fillText(`Status: ${data.isSafe ? "SAFE ✓" : "RISKY ⚠"}`, 40, y);
    y += 35;
  }
  
  // Badges
  if (data.badges && data.badges.length > 0) {
    ctx.fillStyle = "#e8f4ff";
    ctx.font = "16px system-ui";
    ctx.fillText("Risk Badges:", 40, y);
    y += 30;
    data.badges.slice(0, 3).forEach((badge, i) => {
      ctx.fillText(`• ${badge.label || badge.id}`, 60, y);
      y += 25;
    });
  }
  
  // Footer
  ctx.fillStyle = "rgba(232, 244, 255, 0.5)";
  ctx.font = "14px system-ui";
  const date = new Date().toLocaleDateString();
  ctx.fillText(`Generated on ${date}`, 40, height - 20);
  ctx.fillText("bags-shield-api.vercel.app", width - 250, height - 20);
}

// Create Token Info
async function createTokenInfo() {
  const name = $("#create-token-name")?.value?.trim();
  const symbol = $("#create-token-symbol")?.value?.trim();
  const description = $("#create-token-description")?.value?.trim();
  const imageUrl = $("#create-token-image-url")?.value?.trim();
  const website = $("#create-token-website")?.value?.trim();
  const twitter = $("#create-token-twitter")?.value?.trim();
  const telegram = $("#create-token-telegram")?.value?.trim();
  const resultEl = $("#create-token-result");
  
  if (!name || !symbol) {
    if (resultEl) resultEl.textContent = "Error: Name and Symbol are required";
    return;
  }
  
  try {
    const result = await apiFetch("/api/bags/token-info", {
      method: "POST",
      body: {
        name,
        symbol,
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        website: website || undefined,
        twitter: twitter || undefined,
        telegram: telegram || undefined
      }
    });
    
    if (resultEl) {
      resultEl.textContent = JSON.stringify(result, null, 2);
    }
    
    addHistoryEntry("create_token", {
      name,
      symbol,
      tokenMint: result?.response?.tokenMint,
      status: result?.success ? "success" : "failed"
    });
    
    log("create_token_success", result);
    
    // Navigate to create config if successful
    if (result?.success && result?.response) {
      STORE.pendingTokenInfo = result.response;
      setTimeout(() => navigate("create-config"), 1000);
    }
  } catch (e) {
    if (resultEl) {
      resultEl.textContent = `Error: ${e.message}`;
    }
    log("create_token_error", e);
  }
}

// Create Config
async function createConfig() {
  const network = $("#create-config-network")?.value || "devnet";
  const launchWallet = $("#create-config-launch-wallet")?.value?.trim() || STORE.wallet?.pubkey;
  const tipWallet = $("#create-config-tip-wallet")?.value?.trim();
  const tipLamports = $("#create-config-tip-lamports")?.value ? parseInt($("#create-config-tip-lamports").value) : undefined;
  const resultEl = $("#create-config-result");
  
  if (!launchWallet) {
    if (resultEl) resultEl.textContent = "Error: Launch wallet is required (connect wallet or enter manually)";
    return;
  }
  
  try {
    const result = await apiFetch("/api/bags/create-config", {
      method: "POST",
      body: {
        network,
        launchWallet,
        tipWallet: tipWallet || undefined,
        tipLamports: tipLamports || undefined,
        tokenInfo: STORE.pendingTokenInfo
      }
    });
    
    if (resultEl) {
      resultEl.textContent = JSON.stringify(result, null, 2);
    }
    
    addHistoryEntry("create_config", {
      network,
      launchWallet,
      configKey: result?.response?.configKey,
      status: result?.success ? "success" : "failed"
    });
    
    log("create_config_success", result);
  } catch (e) {
    if (resultEl) {
      resultEl.textContent = `Error: ${e.message}`;
    }
    log("create_config_error", e);
  }
}

// ACTIONS
const ACTIONS = {
  nav_home: () => {
    navigate("home");
    log("nav_home", "→ home view");
  },

  nav_scan: () => {
    navigate("scan");
    log("nav_scan", "→ scan view");
  },

  nav_simulate: () => {
    navigate("simulate");
    log("nav_simulate", "→ simulate view");
  },

  nav_settings: () => {
    navigate("settings");
    log("nav_settings", "→ settings view");
  },

  nav_history: () => {
    loadHistory();
    renderHistory();
    navigate("history");
    log("nav_history", "→ history view");
  },

  nav_share: () => {
    navigate("share");
    // Generate share card from pending transaction or last scan/simulate
    const data = STORE.pendingTransaction || STORE.lastScanResult || STORE.lastSimulateResult || {};
    generateShareCard(data);
    log("nav_share", "→ share view");
  },

  nav_create_token: () => {
    navigate("create-token");
    log("nav_create_token", "→ create token view");
  },

  nav_create_config: () => {
    navigate("create-config");
    log("nav_create_config", "→ create config view");
  },

  run_scan: runScan,
  run_simulate: runSimulate,

  open_wallet_modal: () => {
    $("#wallet-modal")?.classList.remove("hidden");
  },

  close_wallet_modal: () => {
    $("#wallet-modal")?.classList.add("hidden");
  },

  wallet_connect_phantom: async () => {
    try {
      await connectProvider("Phantom");
      $("#wallet-modal")?.classList.add("hidden");
    } catch (e) {
      alert(`Failed to connect Phantom: ${e.message}`);
    }
  },

  wallet_connect_solflare: async () => {
    try {
      await connectProvider("Solflare");
      $("#wallet-modal")?.classList.add("hidden");
    } catch (e) {
      alert(`Failed to connect Solflare: ${e.message}`);
    }
  },

  wallet_connect_mwa: async () => {
    try {
      await connectMWA();
      $("#wallet-modal")?.classList.add("hidden");
    } catch (e) {
      alert(`Failed to connect MWA: ${e.message}`);
    }
  },

  wallet_disconnect: () => {
    setWalletState(null);
    log("wallet_disconnected");
  },

  preview_confirm_transaction: async () => {
    try {
      await executeTransaction();
    } catch (e) {
      alert(`Transaction failed: ${e.message}`);
    }
  },

  preview_back_simulate: () => {
    navigate("simulate");
  },

  search_token: () => {
    const input = $("#token-search-input");
    const mint = input?.value?.trim();
    if (mint) {
      STORE.selectedMint = mint;
      $("#simulate-mint-input").value = mint;
      navigate("simulate");
    }
  },

  set_simulate_mode_buy: () => {
    $("#simulate-buy-btn")?.classList.add("active");
    $("#simulate-sell-btn")?.classList.remove("active");
  },

  set_simulate_mode_sell: () => {
    $("#simulate-sell-btn")?.classList.add("active");
    $("#simulate-buy-btn")?.classList.remove("active");
  },

  share_web: async () => {
    const canvas = $("#share-canvas");
    if (!canvas) return;
    
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const file = new File([blob], `bags-shield-${Date.now()}.png`, { type: "image/png" });
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: "Bags Shield Result",
              text: "Check out this Bags Shield scan result",
              files: [file]
            });
            log("share_web_success", "Shared via Web Share API");
          } catch (e) {
            if (e.name !== "AbortError") {
              log("share_web_error", e);
              // Fallback to download
              ACTIONS.share_download();
            }
          }
        } else {
          // Fallback to download
          ACTIONS.share_download();
        }
      }, "image/png");
    } catch (e) {
      log("share_web_error", e);
      ACTIONS.share_download();
    }
  },

  share_download: () => {
    const canvas = $("#share-canvas");
    if (canvas) {
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bags-shield-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        log("share_download_success", "Image downloaded");
      }, "image/png");
    }
  },

  share_copy: () => {
    const canvas = $("#share-canvas");
    if (!canvas) return;
    
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      
      try {
        const item = new ClipboardItem({ "image/png": blob });
        await navigator.clipboard.write([item]);
        log("share_copy_success", "Image copied to clipboard");
        alert("Image copied to clipboard!");
      } catch (e) {
        log("share_copy_error", e);
        // Fallback: copy text
        const text = "Bags Shield Result - Check out this scan!";
        navigator.clipboard.writeText(text).then(() => {
          log("share_copied_text", "Text copied to clipboard");
          alert("Text summary copied to clipboard!");
        });
      }
    }, "image/png");
  },

  create_token_info: createTokenInfo,
  create_config: createConfig
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
  loadWalletState();
  loadHistory();
  wireActions();
  navigate("splash");

  // Search input Enter key
  const searchInput = $("#token-search-input");
  if (searchInput) {
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        ACTIONS.search_token();
      }
    });
  }

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
