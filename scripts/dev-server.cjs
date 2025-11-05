#!/usr/bin/env node
/* Dev server para validar schemas v0 com AJV (sem depender do upstream) */
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

const reqSchema = loadSchema("schemas/v0/scan.request.json");
const resSchema = loadSchema("schemas/v0/scan.response.json");
const validateReq = ajv.compile(reqSchema);
const validateRes = ajv.compile(resSchema);

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/api/v0/scan", (req, res) => {
  if (!validateReq(req.body)) {
    return res.status(400).json({ success: false, error: "invalid_request", issues: validateReq.errors });
  }
  const { rawTransaction } = req.body;

  const response = deterministicScan(rawTransaction);
  const envelope = { success: true, response, meta: { requestId: "req_devserver", mode: "mock" } };

  if (!validateRes(envelope)) {
    return res.status(500).json({ success: false, error: "invalid_response", issues: validateRes.errors });
  }
  return res.status(200).json(envelope);
});

// === Mesmo stub do /api/scan ===
function deterministicScan(raw) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const score = (h >>> 0) % 101;
  const grade = score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "E";
  const warnings = [];
  if (raw.length < 40) warnings.push("short_base64_input");
  if (raw.includes("==")) warnings.push("padded_base64");
  if (/[^A-Za-z0-9+/=]/.test(raw)) warnings.push("non_base64_chars");

  return {
    isSafe: score >= 70 && warnings.length === 0,
    shieldScore: score,
    grade,
    warnings,
    metadata: { mode: "mock", rawLength: raw.length, base: process.env.BAGS_API_BASE || null }
  };
}

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`[dev-server] listening on http://localhost:${port}`));