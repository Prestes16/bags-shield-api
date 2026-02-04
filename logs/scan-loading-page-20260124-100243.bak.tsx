"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { ScanLoadingRadar } from "@/components/scan/ScanLoadingRadar";

export default function ScanLoadingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mint = searchParams.get("mint");

  // Se não tiver mint, redirecionar para /scan
  if (!mint) {
    router.push("/scan");
    return null;
  }

  return <ScanLoadingRadar mintAddress={mint} />;
}
