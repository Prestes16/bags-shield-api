"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveDraft, loadDraft } from "@/lib/launchpad/storage";
import type { LaunchConfigDraft, TokenDraft } from "@/lib/launchpad/types";

export default function CreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Token draft state
  const [token, setToken] = useState<TokenDraft>({
    name: "",
    symbol: "",
    decimals: 9,
    description: "",
    imageUrl: "",
    websiteUrl: "",
    twitterHandle: "",
    telegramHandle: "",
  });

  // Config state
  const [launchWallet, setLaunchWallet] = useState("");
  const [tipWallet, setTipWallet] = useState("");
  const [tipLamports, setTipLamports] = useState<number | undefined>(undefined);

  // Load draft from localStorage on mount
  useEffect(() => {
    const saved = loadDraft();
    if (saved) {
      setToken(saved.token);
      setLaunchWallet(saved.launchWallet);
      setTipWallet(saved.tipWallet || "");
      setTipLamports(saved.tipLamports);
    }
  }, []);

  // Auto-save draft on change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const draft: LaunchConfigDraft = {
        launchWallet,
        tipWallet: tipWallet || undefined,
        tipLamports: tipLamports,
        token,
      };
      saveDraft(draft);
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [token, launchWallet, tipWallet, tipLamports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const draft: LaunchConfigDraft = {
        launchWallet,
        tipWallet: tipWallet || undefined,
        tipLamports: tipLamports,
        token,
      };

      // Validate required fields
      if (!token.name || !token.symbol || !launchWallet) {
        setError("Please fill in all required fields");
        setLoading(false);
        return;
      }

      // Navigate to review page
      router.push("/launchpad/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
      <div className="max-w-2xl mx-auto">

        <h1 className="text-3xl font-bold mb-2 text-slate-900 dark:text-slate-100">
          Create Token Launch
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Fill in your token details and launch configuration
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Token Information */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
              Token Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={token.name}
                  onChange={(e) =>
                    setToken({ ...token, name: e.target.value.slice(0, 32) })
                  }
                  placeholder="My Awesome Token"
                  maxLength={32}
                  required
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {token.name.length}/32 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Symbol <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={token.symbol}
                  onChange={(e) =>
                    setToken({ ...token, symbol: e.target.value.slice(0, 10).toUpperCase() })
                  }
                  placeholder="MAT"
                  maxLength={10}
                  required
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {token.symbol.length}/10 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Decimals
                </label>
                <input
                  type="number"
                  value={token.decimals}
                  onChange={(e) =>
                    setToken({
                      ...token,
                      decimals: Math.max(0, Math.min(18, parseInt(e.target.value) || 0)),
                    })
                  }
                  min={0}
                  max={18}
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={token.description}
                  onChange={(e) =>
                    setToken({ ...token, description: e.target.value.slice(0, 500) })
                  }
                  placeholder="Describe your token..."
                  maxLength={500}
                  rows={3}
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {token.description?.length || 0}/500 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Image URL
                </label>
                <input
                  type="url"
                  value={token.imageUrl}
                  onChange={(e) => setToken({ ...token, imageUrl: e.target.value })}
                  placeholder="https://example.com/image.png"
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Website URL
                </label>
                <input
                  type="url"
                  value={token.websiteUrl}
                  onChange={(e) => setToken({ ...token, websiteUrl: e.target.value })}
                  placeholder="https://example.com"
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Twitter Handle
                  </label>
                  <input
                    type="text"
                    value={token.twitterHandle}
                    onChange={(e) =>
                      setToken({ ...token, twitterHandle: e.target.value })
                    }
                    placeholder="username"
                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Telegram Handle
                  </label>
                  <input
                    type="text"
                    value={token.telegramHandle}
                    onChange={(e) =>
                      setToken({ ...token, telegramHandle: e.target.value })
                    }
                    placeholder="username"
                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Launch Configuration */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
              Launch Configuration
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Launch Wallet <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={launchWallet}
                  onChange={(e) => setLaunchWallet(e.target.value)}
                  placeholder="Solana wallet address (base58)"
                  required
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Wallet that will perform the launch
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Tip Wallet (Optional)
                </label>
                <input
                  type="text"
                  value={tipWallet}
                  onChange={(e) => setTipWallet(e.target.value)}
                  placeholder="Solana wallet address (base58)"
                  className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono text-sm"
                />
              </div>

              {tipWallet && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Tip Amount (Lamports) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={tipLamports || ""}
                    onChange={(e) =>
                      setTipLamports(
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                    min={0}
                    placeholder="1000000"
                    required={!!tipWallet}
                    className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={loading || !token.name || !token.symbol || !launchWallet}
              className="flex-1"
            >
              {loading ? "Saving..." : "Continue to Review"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
