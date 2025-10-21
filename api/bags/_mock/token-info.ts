export const config = { runtime: "edge" };

function hdr(id: string){
  return new Headers({
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store",
    "X-Request-Id": id,
  });
}

export default async function handler(req: Request) {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const rid = (globalThis.crypto && "randomUUID" in globalThis.crypto) ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2);
  const headers = hdr(rid);

  if (method === "HEAD") return new Response(null, { status: 200, headers });
  if (method !== "GET")  return new Response(JSON.stringify({ ok:false, error:{ code:"METHOD_NOT_ALLOWED" }, meta:{ time:new Date().toISOString(), requestId:rid } }), { status:405, headers });

  const mint = url.searchParams.get("mint")?.trim() || "";
  if (!mint) return new Response(JSON.stringify({ ok:false, error:{ code:"BAD_REQUEST", message:"mint é obrigatório" }, meta:{ time:new Date().toISOString(), requestId:rid } }), { status:400, headers });

  // Payload fake e estável
  const resp = {
    mint,
    symbol: "DEMO",
    name: "Demo Token",
    decimals: 9,
    supply: "1000000000000",
  };
  const body = JSON.stringify({ ok:true, response: resp, meta:{ time:new Date().toISOString(), requestId: rid } });
  return new Response(body, { status:200, headers });
}

