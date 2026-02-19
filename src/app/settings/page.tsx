"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { ConnectWalletButton } from "@/components/solana/ConnectWalletButton";

function useIsDebug() {
  const searchParams = useSearchParams();
  return searchParams.get("debug") === "1";
}

function SettingsContent() {
  const isDebug = useIsDebug();
  const { wallets, connected, publicKey } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isDebug || !mounted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Settings
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Add <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">
              ?debug=1
            </code>{" "}
            to the URL to view wallet debug info.
          </p>
        </div>
      </div>
    );
  }

  const origin =
    typeof window !== "undefined" ? window.location.origin : "(SSR)";
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent : "(SSR)";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Wallet Debug
        </h1>
        <div className="flex items-center gap-4">
          <ConnectWalletButton />
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 font-mono text-xs text-slate-700 dark:text-slate-300 space-y-2">
          <p>
            <strong>origin:</strong> {origin}
          </p>
          <p>
            <strong>userAgent:</strong>{" "}
            <span className="break-all">{userAgent}</span>
          </p>
          <p>
            <strong>connected:</strong> {String(connected)}
          </p>
          <p>
            <strong>publicKey:</strong>{" "}
            {publicKey ? publicKey.toBase58() : "—"}
          </p>
          <div>
            <strong>wallets:</strong>
            <ul className="mt-1 ml-4 list-disc space-y-0.5">
              {wallets.map((w, i) => (
                <li key={i}>
                  {w.adapter.name} (ready: {w.readyState})
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">Loading…</div>}>
      <SettingsContent />
    </Suspense>
  );
}
