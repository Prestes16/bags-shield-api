const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());
app.use((req,res,next)=>{
  res.set('Access-Control-Allow-Origin','*');
  res.set('Access-Control-Expose-Headers','X-Request-Id');
  res.set('Cache-Control','no-store');
  res.set('X-Request-Id', req.headers['x-request-id'] || `req_${Math.random().toString(36).slice(2)}`);
  next();
});

app.options('/api/scan',(req,res)=>{
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type,Authorization,x-api-key');
  res.status(204).end();
});
app.options('/api/simulate',(req,res)=>{
  res.set('Access-Control-Allow-Methods','POST,OPTIONS');
  res.set('Access-Control-Allow-Headers','Content-Type,Authorization,x-api-key');
  res.status(204).end();
});

app.get('/api/health',(req,res)=>{
  const meta = {
    service: 'bags-shield-api',
    version: process.env.npm_package_version || '1.0.0',
    env: 'local',
    time: new Date().toISOString(),
    requestId: res.get('X-Request-Id')
  };
  res.json({ ok:true, status:'healthy', meta, checks:{ uptimeSeconds: Math.floor(process.uptime()) }});
});

// base64-ish: charset válido + tamanho >= 64 e múltiplo de 4
function isB64ish(s){
  return typeof s === 'string'
    && /^[A-Za-z0-9+/=]+$/.test(s)
    && s.length >= 64
    && (s.length % 4 === 0);
}

// base58-ish (Solana): 32–44 chars no alfabeto base58 (sem 0 O I l)
function isBase58ish(s){
  return typeof s === 'string'
    && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

app.post('/api/scan',(req,res)=>{
  const raw = (req.body || {}).rawTransaction;
  if (!isB64ish(raw)) {
    return res.status(400).json({
      success:false,
      error:'rawTransaction field is missing or invalid.',
      meta:{ requestId: res.get('X-Request-Id'), mode:'mock' }
    });
  }
  const score = Math.max(0, 100 - raw.length);
  const grade = score>=80?'B':score>=60?'C':score>=40?'D':'E';
  res.json({
    success: true,
    response: {
      isSafe: score>=80,
      shieldScore: score,
      grade,
      warnings: [],
      metadata: { mode:'mock', rawLength: raw.length, base: null }
    },
    meta: { requestId: res.get('X-Request-Id'), mode:'mock' }
  });
});

app.post('/api/simulate',(req,res)=>{
  const mint = (req.body || {}).mint;
  if (!isBase58ish(mint)) {
    return res.status(400).json({
      success:false,
      error:'mint field is missing or invalid.',
      meta:{ requestId: res.get('X-Request-Id'), mode:'mock' }
    });
  }
  const score = 68; // mock estável
  const grade = score>=80?'B':score>=60?'C':score>=40?'D':'E';
  res.json({
    success:true,
    response:{
      isSafe: score>=80,
      shieldScore: score,
      grade,
      warnings: [],
      metadata:{ mode:'mock', mintLength: mint.length, base: null }
    },
    meta:{ requestId: res.get('X-Request-Id'), mode:'mock' }
  });
});

app.listen(port, ()=> console.log(`Bags Shield API (fallback) listening on :${port}`));