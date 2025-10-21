export const config = { runtime: "nodejs" };
export default async function handler(req:any, res:any){
  const out = {
    ok:true,
    env:{
      BAGS_API_BASE: process.env.BAGS_API_BASE || null,
      BAGS_TIMEOUT_MS: process.env.BAGS_TIMEOUT_MS || null
    }
  };
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.status(200).send(JSON.stringify(out));
}
