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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">Carregando…</div>}>
      <ScanLoadingContent />
    </Suspense>
  );
}
