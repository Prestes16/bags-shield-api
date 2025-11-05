#!/usr/bin/env node
/* Dev server para validar schemas v0 com AJV (scan + simulate) */
const fs = require("fs");
const path = require("path");
const express = require("express");
const Ajv = require("ajv");

const ajv = new Ajv({ strict: false, allErrors: true, validateFormats: false });

function stripIds(schema) {
  if (schema && typeof schema === "object") {
    delete schema.$id;
    delete schema.$schema;
    for (const k of Object.keys(schema)) stripIds(schema[k]);
  }
  return schema;
}
function loadSchema(rel) {
  const p = path.join(process.cwd(), rel);
  const raw = fs.readFileSync(p, "utf8");
  return stripIds(JSON.parse(raw));
}

// === Carrega schemas v0 ===
const scanReqSchema = loadSchema("schemas/v0/scan.request.json");
const scanResSchema = loadSchema("schemas/v0/scan.response.json");
const simReqSchema  = loadSchema("schemas/v0/simulate.request.json");
const simResSchema  = loadSchema("schemas/v0/simulate.response.json");

const validateScanReq = ajv.compile(scanReqSchema);
const validateScanRes = ajv.compile(scanResSchema);
const validateSimReq  = ajv.compile(simReqSchema);
const validateSimRes  = ajv.compile(simResSchema);

const app = express();
app.use(express.json({ limit: "1mb" }));

// === Util determinístico (igual nas rotas) ===
function simpleHash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 101;
}
function gradeFromScore(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "E";
}
const base58Re = /^[1-9A-HJ-NP-Za-km-z]+$/;

app.post("/api/v0/scan", (req, res) => {
  if (!validateScanReq(req.body)) {
    return res.status(400).json({ success: false, error: "invalid_request", issues: validateScanReq.errors });
  }
  const { rawTransaction } = req.body;

  const score = simpleHash(rawTransaction);
  const grade = gradeFromScore(score);
  const warnings = [];
  if (rawTransaction.length < 40) warnings.push("short_base64_input");
  if (rawTransaction.includes("==")) warnings.push("padded_base64");
  if (/[^A-Za-z0-9+/=]/.test(rawTransaction)) warnings.push("non_base64_chars");

  const response = {
    isSafe: score >= 70 && warnings.length === 0,
    shieldScore: score,
    grade,
    warnings,
    metadata: { mode: "mock", rawLength: rawTransaction.length, base: process.env.BAGS_API_BASE || null }
  };
  const envelope = { success: true, response, meta: { requestId: "req_devserver", mode: "mock" } };

  if (!validateScanRes(envelope)) {
    return res.status(500).json({ success: false, error: "invalid_response", issues: validateScanRes.errors });
  }
  return res.status(200).json(envelope);
});

app.post("/api/v0/simulate", (req, res) => {
  if (!validateSimReq(req.body)) {
    return res.status(400).json({ success: false, error: "invalid_request", issues: validateSimReq.errors });
  }
  const { mint } = req.body;

  const score = simpleHash(mint);
  const grade = gradeFromScore(score);
  const warnings = [];
  if (!base58Re.test(mint)) warnings.push("invalid_base58_chars");
  if (mint.length < 32 || mint.length > 44) warnings.push("unexpected_mint_length");

  const response = {
    isSafe: score >= 70 && warnings.length === 0,
    shieldScore: score,
    grade,
    warnings,
    metadata: { mode: "mock", mintLength: mint.length, base: process.env.BAGS_API_BASE || null }
  };
  const envelope = { success: true, response, meta: { requestId: "req_devserver", mode: "mock" } };

  if (!validateSimRes(envelope)) {
    return res.status(500).json({ success: false, error: "invalid_response", issues: validateSimRes.errors });
  }
  return res.status(200).json(envelope);
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`[dev-server] listening on http://localhost:${port}`));