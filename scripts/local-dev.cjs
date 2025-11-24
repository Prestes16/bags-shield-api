const express = require("express");
const crypto  = require("crypto");
const app = express();
app.disable("x-powered-by");
app.use((req,res,next)=>{
  const requestId = crypto.randomUUID();
  const allowOrigin = req.headers.origin || "*";
  res.set({
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
    "Access-Control-Expose-Headers": "X-Request-Id",
    "Cache-Control": "no-store",
    "X-Request-Id": requestId
  });
  res.locals.requestId = requestId;
  next();
});
app.options("*", (req,res)=>res.status(204).end());
app.head("/api/health", (req,res)=>res.status(200).end());
app.get("/api/health", (req,res)=>{
  res.type("application/json; charset=utf-8")
     .status(200)
     .send(JSON.stringify({ success:true, response:{ status:"ok" }, meta:{ requestId: res.locals.requestId } }));
});
const port = process.env.PORT || 3000;
app.listen(port, ()=>console.log(`[local-dev] http://localhost:${port}`));