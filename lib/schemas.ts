import { z } from "zod";

const Network = z.enum(["mainnet", "devnet"], { required_error: "network obrigatório" });

const Mint = z.string({ required_error: "mint obrigatória" })
  .min(1, "mint obrigatória");

const toNumber = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return v;
};

export const ScanSchema = z.object({
  mint: Mint,
  network: Network,
});

export const TxParamsSchema = z.object({
  network: Network,
  mint: Mint,
  amount: z.preprocess(toNumber, z.number().positive("amount deve ser > 0")).optional(),
  slippageBps: z.preprocess(toNumber, z.number().int().min(0).max(10_000).describe("0..10000")).optional(),
});
