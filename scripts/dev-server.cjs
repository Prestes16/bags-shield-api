/**
 * Bags Shield — Dev Server v0 (refactor limpo)
 * - Express + body-parser
 * - AJV com formats
 * - Envelope consistente { success, response|error, meta }
 * - X-Request-Id e Cache-Control: no-store em TODAS as respostas
 * - Rotas: /api/health, /api/v0/scan, /api/v0/simulate (+ 405)
 */
const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const app = express();
const PORT = Number(process.env.PORT || 4000);

// ---- Utils
function newRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
function issueFromAjvError(e) {
  const path = e.instancePath || e.dataPath || "/";
  return { path: path || "/", message: e.message || "invalid", code: e.keyword || "invalid" };
}
function ok(response, rid, started) {
  return { success: true, response, meta: { requestId: rid, started, durationMs: Date.now() - started } };
}
function errorPayload(errCode, message, issues, rid, started) {
  const meta = { requestId: rid, started, durationMs: Date.now() - started };
  const base = { success: false, error: errCode, message, meta };
  if (issues && issues.length) base.issues = issues;
  return base;
}

// ---- AJV
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Schemas mínimos v0 (alinhados aos testes atuais)
const scanReqSchema = {
  type: "object",
  additionalProperties: false,
  required: ["chain", "cluster", "tokenMint"],
  properties: {
    chain: { type: "string", enum: ["solana"] },
    cluster: { type: "string", enum: ["mainnet", "devnet", "testnet"] },
    tokenMint: { type: "string", minLength: 32 },
    options: { type: "object", additionalProperties: true },
    context: { type: "object", additionalProperties: true }
  }
};
const simulateReqSchema = {
  type: "object",
  additionalProperties: false,
  required: ["action", "chain", "cluster", "mint", "input", "slippageBps"],
  properties: {
    action: { type: "string", enum: ["BUY", "SELL"] },
    chain: { type: "string", enum: ["solana"] },
    cluster: { type: "string", enum: ["mainnet", "devnet", "testnet"] },
    mint: { type: "string", minLength: 32 },
    input: {
      type: "object",
      required: ["sol"],
      additionalProperties: false,
      properties: { sol: { type: "number", minimum: 0 } }
    },
    slippageBps: { type: "integer", minimum: 0, maximum: 10000 },
    context: { type: "object", additionalProperties: true }
  }
};
const validateScan = ajv.compile(scanReqSchema);
const validateSim = ajv.compile(simulateReqSchema);

// ---- Middlewares base
// 1) Request-Id + cache-control + cronômetro
app.use((req, res, next) => {
  const rid = String(req.headers["x-request-id"] || newRequestId());
  res.set("X-Request-Id", rid);
  res.set("Cache-Control", "no-store");
  res.locals.requestId = rid;
  res.locals.started = Date.now();
  next();
});

// 2) Body parsers
app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: false }));

// ---- Health
app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, ts: new Date().toISOString() });
});

// ---- Helpers 405
function methodNotAllowed(req, res) {
  const rid = res.get("X-Request-Id") || newRequestId();
  const started = res.locals.started || Date.now();
  return res
    .status(405)
    .json(errorPayload("METHOD_NOT_ALLOWED", "Método não permitido", [], rid, started));
}

// ---- /api/v0/scan
app.post("/api/v0/scan", (req, res) => {
  const rid = res.get("X-Request-Id") || newRequestId();
  const started = res.locals.started || Date.now();
  const body = req.body || {};

  const valid = validateScan(body);
  if (!valid) {
    const issues = (validateScan.errors || []).map(issueFromAjvError);
    return res.status(400).json(errorPayload("BAD_REQUEST", "Payload inválido", issues, rid, started));
  }

  const resp = {
    token: { mint: body.tokenMint, name: "Unknown", symbol: "UNK", decimals: 9 },
    badges: [{ key: "POOL_AGE_LOW", title: "Pool Age Low", severity: "low", impact: "neutral", tags: ["pool"] }],
    shieldScore: { grade: "B", score: 80, rationale: "Baseline v0", rulesTriggered: ["baseline"] },
    summary: "Contrato v0 ativo (dev JS CJS)."
  };
  return res.status(200).json(ok(resp, rid, started));
});
app.all("/api/v0/scan", methodNotAllowed);

// ---- /api/v0/simulate
app.post("/api/v0/simulate", (req, res) => {
  const rid = res.get("X-Request-Id") || newRequestId();
  const started = res.locals.started || Date.now();
  const body = req.body || {};

  const valid = validateSim(body);
  if (!valid) {
    const issues = (validateSim.errors || []).map(issueFromAjvError);
    return res.status(400).json(errorPayload("BAD_REQUEST", "Payload inválido", issues, rid, started));
  }

  const resp = {
    actionEcho: body.action,
    mint: body.mint,
    tx: { estimatedFeesLamports: 5000, canExecute: true, blockers: [] },
    outcomeRisk: {
      badges: [{ key: "LOW_LIQUIDITY", title: "Low Liquidity", severity: "high", impact: "negative", tags: ["liquidity"] }],
      shieldScore: { grade: "C", score: 68, rationale: "Slippage potencial", rulesTriggered: ["liquidity.depthInput"] }
    },
    notes: "Dev server v0."
  };
  return res.status(200).json(ok(resp, rid, started));
});
app.all("/api/v0/simulate", methodNotAllowed);

// ---- Error handler final
app.use((err, req, res, next) => {
  try {
    const rid = res.get("X-Request-Id") || newRequestId();
    const started = res.locals.started || Date.now();
    const status = Number(err.statusCode || err.status || 500);
    let issues = [];

    if (Array.isArray(err.errors)) issues = err.errors.map(issueFromAjvError);
    else if (Array.isArray(err.issues)) issues = err.issues;

    return res
      .status(status)
      .json(errorPayload(err.code || err.name || "INTERNAL_ERROR", err.message || "Erro interno", issues, rid, started));
  } catch (e) {
    const rid = newRequestId();
    return res.status(500).json({ success: false, error: "INTERNAL_ERROR", meta: { requestId: rid } });
  }
});

// ---- Boot
app.listen(PORT, () => {
  console.log(`>> Dev server JS v0 ouvindo em http://localhost:${PORT}`);
});
