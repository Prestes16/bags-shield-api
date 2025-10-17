import type { VercelRequest, VercelResponse } from "@vercel/node";

function setCors(res: VercelResponse){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");res.setHeader("Access-Control-Allow-Headers","authorization,content-type,x-requested-with");res.setHeader("Access-Control-Max-Age","86400");}
function preflight(_req: VercelRequest,res: VercelResponse){setCors(res);res.status(204).end();}
function noStore(res: VercelResponse){res.setHeader("Cache-Control","no-store");}

export default async function handler(req: VercelRequest,res: VercelResponse){
  const m=(req.method||"GET").toUpperCase();
  if(m==="OPTIONS") return preflight(req,res);
  setCors(res);
  if(m!=="GET"){res.setHeader("Allow","GET, OPTIONS");return res.status(405).json({ok:false,error:{code:"METHOD_NOT_ALLOWED",message:"Use GET | OPTIONS"}});}
  noStore(res);
  const now=new Date().toISOString(); const env=process.env.VERCEL_ENV||"unknown";
  const up=(typeof process.uptime==="function")?Math.round(process.uptime()):undefined;
  return res.status(200).json({ok:true,status:"healthy",meta:{service:"bags-shield-api",version:"1.0.0",env,time:now},checks:{uptimeSeconds:up}});
}