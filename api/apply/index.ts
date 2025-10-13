import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { applyCors, preflight } from "../../lib/cors.js";

type Issue = { path: string; message: string };
type BadRequest = { ok: false; code: "BAD_REQUEST"; issues: Issue[] };

function safeStartsWith(v: unknown, prefix: string): boolean {
  return typeof v === "string" && v.startsWith(prefix);
}

const toNumber = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return v;
};

const Network = z.enum(["mainnet", "devnet"], { required_error: "network obrigatório" });
const Mint = z.string({ required_error: "mint obrigatória" }).min(1, "mint obrigatória");

const TxParamsSchema = z.object({
  network: Network,
  mint: Mint,
  amount: z.preprocess(toNumber, z.number().positive("amount deve ser > 0")).optional(),
  slippageBps: z.preprocess(toNumber, z.number().int().min(0).max(10_000)).optional(),
});

function zodToIssues(err: z.ZodError): Issue[] {
  return err.issues.map(e => ({
    path: (Array.isArray(e.path) ? e.path.join(".") : "") || "<root>",
    message: e.message,
  }));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  (res as any).setHeader?.("x-bags-wrapper","apply-zod");
  // CORS + preflight
  const ended = preflight(req, res);
  if (ended) return ended as any;
  applyCors(req, res);

  // Authorization tolerante
  const auth = req.headers?.authorization;
  if (safeStartsWith(auth, "Bearer ")) {
    (req as any).authToken = (auth as string).slice(7).trim();
  }

  if (req.method === "POST") {
    if (!safeStartsWith(req.headers?.["content-type"], "application/json")) {
      const issues: Issue[] = [{ path: "headers.content-type", message: "expected application/json" }];
      return res.status(400).json({ ok: false, code: "BAD_REQUEST", issues } as BadRequest);
    }

    const parsed = TxParamsSchema.safeParse((req as any).body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ ok: false, code: "BAD_REQUEST", issues: zodToIssues(parsed.error) } as BadRequest);
    }

    return res.status(200).json({
      ok: true,
      probe: "apply-zod-ok",
      received: parsed.data,
      hasAuth: Boolean((req as any).authToken),
      ts: Date.now(),
    });
  }

  return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
}
