"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { ScanLoadingRadar } from "@/components/scan/ScanLoadingRadar";

function ScanLoadingPageInner() {
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

export default function ScanLoadingPage(props: any) {
  return (
    <Suspense fallback={null}>
      <ScanLoadingPageInner {...props} />
    </Suspense>
  );
}
