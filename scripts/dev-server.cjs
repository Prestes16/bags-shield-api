const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const bodyParser = require("body-parser");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

function newRequestId(){ try { return crypto.randomUUID(); } catch { return Math.random().toString(36).slice(2); } }
function ok(response, requestId, started){ return { success:true, response, meta:{ requestId, version:"v0", timestamp:new Date().toISOString(), processingMs: Date.now()-started } }; }
function err(code, message, details, requestId, started){ return { success:false, error:{ code, message, details }, meta:{ requestId, version:"v0", timestamp:new Date().toISOString(), processingMs: Date.now()-started } }; }

function abs(rel){ return path.resolve(process.cwd(), rel); }
function loadSchema(rel){
  const p = abs(rel);
  if (!fs.existsSync(p)){ const e=new Error("SchemaNotFound: "+p); e.code="SCHEMA_NOT_FOUND"; throw e; }
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e){ e.code="SCHEMA_PARSE"; e.path=p; throw e; }
}

const ajv = new Ajv({ allErrors:true, strict:false });
addFormats(ajv);

function validate(schema, data){
  try{
    const clone = JSON.parse(JSON.stringify(schema));
    if (clone && typeof clone === "object"){ delete clone.$id; delete clone.$schema; }
    const v = ajv.compile(clone);
    const valid = v(data);
    return { valid, errors: v.errors || [] };
  }catch(e){
    return { valid:false, errors:[{ message:"SCHEMA_COMPILE: " + (e && e.message || "unknown") }] };
  }
}

const app = express();
app.use((req,_res,next)=>{ console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`); next(); });
app.use(bodyParser.json({ limit: "1mb" }));
app.get("/api/health", (_req,res) => res.json({ ok:true, ts:new Date().toISOString(), cwd:process.cwd() }));

function withEnvelope(handler){
  return async (req,res)=>{
    const started = Date.now(); const requestId = newRequestId();
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("Cache-Control", "no-store");
    try{ await handler(req,res,{ started, requestId }); }
    catch(e){ console.error("HANDLER_ERROR:", e?.stack || e); try{ res.status(500).type("application/json").send(JSON.stringify(err("INTERNAL_ERROR", e?.message||"Erro interno", { code:e?.code, path:e?.path }, requestId, started))); }catch{} }
  };
}

app.post("/api/v0/scan", withEnvelope((req,res,ctx)=>{
  const body = req.body ?? {};
  const schema = loadSchema("schemas/v0/scan.request.schema.json");
  const { valid, errors } = validate(schema, body);
  if (!valid) return res.status(400).json(err("BAD_REQUEST","Payload inválido",{ issues: errors }, ctx.requestId, ctx.started));
  const resp = {
    token: { mint: body.tokenMint, name:"Unknown", symbol:"UNK", decimals:9 },
    badges: [{ key:"POOL_AGE_LOW", title:"Pool Age Low", severity:"low", impact:"neutral", tags:["pool"] }],
    shieldScore: { grade:"B", score:80, rationale:"Baseline v0", rulesTriggered:["baseline"] },
    summary: "Contrato v0 ativo (dev JS CJS)."
  };
  return res.status(200).json(ok(resp, ctx.requestId, ctx.started));
}));

app.post("/api/v0/simulate", withEnvelope((req,res,ctx)=>{
  const body = req.body ?? {};
  const schema = loadSchema("schemas/v0/simulate.request.schema.json");
  const { valid, errors } = validate(schema, body);
  if (!valid) return res.status(400).json(err("BAD_REQUEST","Payload inválido",{ issues: errors }, ctx.requestId, ctx.started));
  const resp = {
    actionEcho: body.action, mint: body.mint,
    tx: { estimatedFeesLamports: 5000, canExecute: true, blockers: [] },
    outcomeRisk: {
      badges: [{ key:"LOW_LIQUIDITY", title:"Low Liquidity", severity:"high", impact:"negative", tags:["liquidity"] }],
      shieldScore: { grade:"C", score:68, rationale:"Slippage potencial", rulesTriggered:["liquidity.depth<input"] }
    },
    notes: "Dev server v0."
  };
  return res.status(200).json(ok(resp, ctx.requestId, ctx.started));
}));

app.use((errObj,_req,res,_next)=>{
  console.error("UNCAUGHT_MW:", errObj?.stack || errObj);
  const rid = newRequestId();
  res.status(500).json(err("UNCAUGHT", errObj?.message || "Erro", null, rid, Date.now()));
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, ()=> console.log(`>> Dev server JS v0 ouvindo em http://localhost:${PORT}`));
