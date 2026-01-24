"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function LaunchpadPage() {
  const router = useRouter();
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);
  const [mode, setMode] = useState<string>("");

  useEffect(() => {
    // Check if Launchpad is enabled
    fetch("/api/launchpad/preflight", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
      body: JSON.stringify({
        config: {
          launchWallet: "So11111111111111111111111111111111111111112",
          token: {
            name: "Test",
            symbol: "TEST",
            decimals: 9,
          },
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error?.code === "FEATURE_DISABLED") {
          setIsEnabled(false);
        } else {
          setIsEnabled(true);
          setMode(data.meta?.mode || "unknown");
        }
      })
      .catch(() => {
        setIsEnabled(null);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-slate-100">
            Bags Shield Launchpad
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Launch your token securely with Shield validation
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Create Token Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">
              Create Token
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Start a new token launch with Shield validation and security checks.
            </p>
            <Link href="/launchpad/create">
              <Button className="w-full">Get Started</Button>
            </Link>
          </div>

          {/* History Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">
              History
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              View your previous token launches and Shield proofs.
            </p>
            <Link href="/launchpad/history">
              <Button variant="outline" className="w-full">
                View History
              </Button>
            </Link>
          </div>

          {/* Docs Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700 md:col-span-2">
            <h2 className="text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">
              Documentation
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Learn about the Launchpad flow, security features, and best practices.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <a
                  href="/docs/launchpad/ARCHITECTURE.md"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Architecture
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a
                  href="/docs/launchpad/THREAT_MODEL.md"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Security
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Status Info */}
        {isEnabled !== null && (
          <div
            className={`mt-8 rounded-lg p-6 border ${
              isEnabled
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
            }`}
          >
            <h3 className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
              Status
            </h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {isEnabled ? (
                <>
                  ✅ Launchpad está habilitado
                  {mode && (
                    <span className="ml-2 px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                      Mode: {mode}
                    </span>
                  )}
                </>
              ) : (
                <>
                  ⚠️ Launchpad está desabilitado. Configure{" "}
                  <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">
                    LAUNCHPAD_ENABLED=true
                  </code>{" "}
                  para habilitar.
                </>
              )}
            </p>
          </div>
        )}

        {/* Quick Info */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
            How it works
          </h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <li>Create your token draft with metadata</li>
            <li>Configure launch settings (wallet, tip, etc.)</li>
            <li>Run preflight validation</li>
            <li>Generate Shield proof manifest</li>
            <li>Launch your token securely</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
