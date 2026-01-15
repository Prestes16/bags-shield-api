(() => {
  const SAMPLE = {
    scan: { rawTransaction: "AQAAAAAAAAAAAAAA" },
    simulate: { mint: "So11111111111111111111111111111111111111112" }
  };

  const HDR_KEYS = ["x-vercel-id", "x-vercel-cache", "date", "content-type"];

  function $(root, selectors) {
    const list = Array.isArray(selectors) ? selectors : [selectors];
    for (const sel of list) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = String(text ?? "");
    return div.innerHTML;
  }

  function pretty(obj) {
    try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
  }

  function getCard(kind) {
    return (
      document.getElementById(`${kind}-card`) ||
      document.querySelector(`[data-card="${kind}"]`) ||
      document.querySelector(`.card--${kind}`) ||
      null
    );
  }

  function setStatus(card, state, text) {
    const pill = $(card, [".status-pill", "[data-status-pill]"]);
    if (!pill) return;
    pill.classList.remove("ok", "err", "run");
    if (state === "ok") pill.classList.add("ok");
    if (state === "err") pill.classList.add("err");
    if (state === "run") pill.classList.add("run");
    pill.textContent = text;
  }

  function setMeta(card, status, latency, requestId) {
    const statusEl = $(card, ["[data-status-code]", "[data-code]", ".meta [data-code]"]);
    const latEl = $(card, ["[data-latency]", ".meta [data-latency]"]);
    const reqEl = $(card, ["[data-request-id]", ".meta [data-request-id]"]);

    if (statusEl) statusEl.textContent = status ?? "—";
    if (latEl) latEl.textContent = latency ? `${Math.round(latency)}ms` : "—";
    if (reqEl) reqEl.textContent = requestId ?? "—";
  }

  function extractHighlights(data) {
    // Suporta vários formatos sem "quebrar"
    const resp = data?.response ?? data?.result ?? data;
    const meta = data?.meta ?? {};

    const score =
      resp?.shieldScore ??
      resp?.score ??
      resp?.ShieldScore ??
      null;

    const grade =
      resp?.grade ??
      resp?.riskGrade ??
      resp?.Grade ??
      null;

    const mode = meta?.mode ?? resp?.mode ?? null;

    const out = [];
    if (score !== null && score !== undefined) out.push({ k: "ShieldScore", v: String(score) });
    if (grade) out.push({ k: "Grade", v: String(grade) });
    if (mode) out.push({ k: "Mode", v: String(mode) });
    return out;
  }

  function renderHighlights(card, data) {
    const box = $(card, [".highlights", "[data-highlights]"]);
    if (!box) return;
    const items = extractHighlights(data);
    if (!items.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML = items.map(it => (
      `<span class="chip">${escapeHtml(it.k)}<b>${escapeHtml(it.v)}</b></span>`
    )).join("");
  }

  function renderHeaders(card, headers) {
    const container = $(card, ["[data-headers]", ".headers"]);
    if (!container) return;

    if (!headers) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <div class="headers-section">
        <div class="headers-title">Headers</div>
        <div class="headers-list">
          ${HDR_KEYS.map(k => `
            <div class="header-item">
              <span class="header-name">${escapeHtml(k)}:</span>
              <span class="header-value">${escapeHtml(headers[k] ?? "—")}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderResponse(card, data, headers) {
    const pre = $(card, ["pre", ".response pre", ".response-json"]);
    if (pre) pre.textContent = data ? pretty(data) : "// Aguardando…";
    renderHighlights(card, data);
    renderHeaders(card, headers);
  }

  async function makeRequest(path, method, body) {
    const start = performance.now();
    try {
      const res = await fetch(path, {
        method,
        headers: {
          "accept": "application/json",
          ...(method !== "GET" ? { "content-type": "application/json" } : {})
        },
        body: method === "GET" ? undefined : JSON.stringify(body ?? {})
      });

      const latency = performance.now() - start;

      let data = null;
      try { data = await res.json(); } catch { data = null; }

      const headers = {};
      for (const k of HDR_KEYS) headers[k] = res.headers.get(k) || "—";

      const requestId =
        res.headers.get("x-request-id") ||
        data?.meta?.requestId ||
        null;

      return { ok: res.ok, status: res.status, latency, data, requestId, headers };
    } catch (err) {
      const latency = performance.now() - start;
      const headers = {};
      for (const k of HDR_KEYS) headers[k] = "—";
      return {
        ok: false,
        status: 0,
        latency,
        data: { success: false, error: String(err?.message ?? err) },
        requestId: null,
        headers
      };
    }
  }

  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
  }

  async function runHealth() {
    const card = getCard("health");
    if (!card) return;

    const btn = $(card, ["button[data-action='health']", "#btn-health", "button"]);
    setBusy(btn, true);
    setStatus(card, "run", "Running…");
    setMeta(card, "—", null, "—");
    renderResponse(card, null, null);

    const r = await makeRequest("/api/health", "GET");
    setMeta(card, r.status, r.latency, r.requestId);

    if (r.ok) setStatus(card, "ok", "OK");
    else setStatus(card, "err", r.status ? `ERR ${r.status}` : "ERR");

    renderResponse(card, r.data, r.headers);
    setBusy(btn, false);
  }

  async function runScan() {
    const card = getCard("scan");
    if (!card) return;

    const ta = $(card, ["textarea[name='rawTransaction']", "textarea[data-raw-tx]", "textarea", "#scan-rawtx"]);
    const btnScan = $(card, ["button[data-action='scan']", "#btn-scan", "button.primary", "button"]);
    const btnSample = $(card, ["button[data-action='scan-sample']", "#btn-scan-sample"]);

    if (btnSample && ta) {
      btnSample.onclick = () => { ta.value = SAMPLE.scan.rawTransaction; };
    }

    const payload = { rawTransaction: (ta && ta.value ? ta.value.trim() : "") || SAMPLE.scan.rawTransaction };

    setBusy(btnScan, true);
    setStatus(card, "run", "Running…");
    setMeta(card, "—", null, "—");
    renderResponse(card, null, null);

    const r = await makeRequest("/api/scan", "POST", payload);
    setMeta(card, r.status, r.latency, r.requestId);

    if (r.ok) setStatus(card, "ok", "OK");
    else setStatus(card, "err", r.status ? `ERR ${r.status}` : "ERR");

    renderResponse(card, r.data, r.headers);
    setBusy(btnScan, false);
  }

  async function runSimulate() {
    const card = getCard("simulate");
    if (!card) return;

    const inp = $(card, ["input[name='mint']", "input[data-mint]", "input[type='text']", "#simulate-mint"]);
    const btnSim = $(card, ["button[data-action='simulate']", "#btn-simulate", "button.primary", "button"]);
    const btnSample = $(card, ["button[data-action='simulate-sample']", "#btn-simulate-sample"]);

    if (btnSample && inp) {
      btnSample.onclick = () => { inp.value = SAMPLE.simulate.mint; };
    }

    const payload = { mint: (inp && inp.value ? inp.value.trim() : "") || SAMPLE.simulate.mint };

    setBusy(btnSim, true);
    setStatus(card, "run", "Running…");
    setMeta(card, "—", null, "—");
    renderResponse(card, null, null);

    const r = await makeRequest("/api/simulate", "POST", payload);
    setMeta(card, r.status, r.latency, r.requestId);

    if (r.ok) setStatus(card, "ok", "OK");
    else setStatus(card, "err", r.status ? `ERR ${r.status}` : "ERR");

    renderResponse(card, r.data, r.headers);
    setBusy(btnSim, false);
  }

  function setEnvBadge() {
    const badge = document.querySelector(".env-badge, [data-env-badge]");
    if (!badge) return;
    const host = window.location.host || "";
    const isProd = host.includes("bags-shield-api.vercel.app");
    badge.textContent = isProd ? "Production" : "Preview/Local";
  }

  function wireButtons() {
    const health = getCard("health");
    const scan = getCard("scan");
    const sim = getCard("simulate");

    if (health) {
      const btn = $(health, ["button[data-action='health']", "#btn-health", "button"]);
      if (btn) btn.addEventListener("click", runHealth);
    }
    if (scan) {
      const btn = $(scan, ["button[data-action='scan']", "#btn-scan", "button.primary", "button"]);
      if (btn) btn.addEventListener("click", runScan);
    }
    if (sim) {
      const btn = $(sim, ["button[data-action='simulate']", "#btn-simulate", "button.primary", "button"]);
      if (btn) btn.addEventListener("click", runSimulate);
    }
  }

  // Boot
  document.addEventListener("DOMContentLoaded", () => {
    setEnvBadge();
    wireButtons();
    runHealth();
  });
})();
