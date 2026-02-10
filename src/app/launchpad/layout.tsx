/**
 * Layout for Launchpad pages — Server Component
 * Provides consistent structure and navigation
 */

import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ConnectWalletButton } from "@/components/solana/ConnectWalletButton";
import { SwapPanel } from "@/components/solana/SwapPanel";
import { SwapTestButton } from "@/components/solana/SwapTestButton";
import { LaunchpadProviders } from "./providers";

export default function LaunchpadLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Navigation Bar */}
      <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/launchpad">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  🚀 Launchpad
                </h1>
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <ConnectWalletButton />
              <SwapTestButton />
              <Link href="/launchpad">
                <Button variant="ghost" size="sm">
                  Home
                </Button>
              </Link>
              <Link href="/launchpad/create">
                <Button variant="ghost" size="sm">
                  Create
                </Button>
              </Link>
              <Link href="/launchpad/history">
                <Button variant="ghost" size="sm">
                  History
                </Button>
              </Link>
              <Link href="/">
                <Button variant="ghost" size="sm">
                  ← Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-end">
          <SwapPanel />
        </div>
      </div>

      {/* Main Content */}
      <main>
        <LaunchpadProviders>{children}</LaunchpadProviders>
      </main>
    </div>
  );
}


