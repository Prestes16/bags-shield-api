"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const PlusIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

export function EmptyWatchlist() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center">
          <svg
            className="w-12 h-12 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Sua Watchlist está vazia</h2>
        <p className="text-slate-400 mb-6">
          Adicione tokens para monitorar seus scores e receber alertas de mudanças de risco.
        </p>
        <Button
          onClick={() => router.push("/scan")}
          className="bg-cyan-500 hover:bg-cyan-600 text-black shadow-[0_0_15px_rgba(6,182,212,0.5)]"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Adicionar Token
        </Button>
      </div>
    </div>
  );
}
