"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ScanLoadingRadar } from "@/components/scan/ScanLoadingRadar";

function ScanLoadingContent() {
  const searchParams = useSearchParams();
  const mintAddress = searchParams.get("mint") ?? undefined;
  return <ScanLoadingRadar mintAddress={mintAddress} />;
}

export default function ScanLoadingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">Carregando…</div>}>
      <ScanLoadingContent />
    </Suspense>
  );
}
