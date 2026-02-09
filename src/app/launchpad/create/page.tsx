"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { saveDraft, loadDraft } from "@/lib/launchpad/storage";
import { useLanguage } from "@/context/LanguageContext";
import type {
  LaunchConfigDraft,
  TokenDraft,
  SafetyConfig,
} from "@/lib/launchpad/types";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_DESC_CHARS = 200;

export default function CreatePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [token, setToken] = useState<TokenDraft>({
    name: "",
    symbol: "",
    decimals: 9,
    description: "",
    imageUrl: "",
    imagePreviewUrl: "",
    websiteUrl: "",
    twitterHandle: "",
    telegramHandle: "",
  });

  const [launchWallet, setLaunchWallet] = useState("");
  const [tipWallet, setTipWallet] = useState("");
  const [tipLamports, setTipLamports] = useState<number | undefined>(undefined);
  const [initialSupply, setInitialSupply] = useState<number>(1_000_000_000);
  const [safetyConfig, setSafetyConfig] = useState<SafetyConfig>({
    renounceMint: true,
    renounceFreeze: true,
    lpLockMonths: 12,
  });

  useEffect(() => {
    const saved = loadDraft();
    if (saved) {
      setToken(saved.token);
      setLaunchWallet(saved.launchWallet);
      setTipWallet(saved.tipWallet || "");
      setTipLamports(saved.tipLamports);
      setInitialSupply(saved.initialSupply ?? 1_000_000_000);
      setSafetyConfig(
        saved.safetyConfig ?? {
          renounceMint: true,
          renounceFreeze: true,
          lpLockMonths: 12,
        }
      );
    }
  }, []);

  useEffect(() => {
    const draft: LaunchConfigDraft = {
      launchWallet,
      tipWallet: tipWallet || undefined,
      tipLamports,
      initialSupply,
      safetyConfig,
      token,
    };
    const timeoutId = setTimeout(() => saveDraft(draft), 500);
    return () => clearTimeout(timeoutId);
  }, [token, launchWallet, tipWallet, tipLamports, initialSupply, safetyConfig]);

  const handleImageFile = useCallback((file: File | null) => {
    if (!file) {
      setToken((prev) => ({
        ...prev,
        imagePreviewUrl: "",
        imageUrl: "",
      }));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image must be max 2MB");
      return;
    }
    const accept = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
    if (!accept.includes(file.type)) {
      setError("Only PNG, JPG, GIF allowed");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // data: só em imagePreviewUrl (preview); imageUrl real será definido após upload IPFS/ar
      if (dataUrl.length > 200_000) {
        setError("Image too large (max ~200KB for preview)");
        return;
      }
      setToken((prev) => ({
        ...prev,
        imagePreviewUrl: dataUrl,
        imageUrl: undefined, // não persiste data: em imageUrl
      }));
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type?.startsWith("image/")) handleImageFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleImageFile(file ?? null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (step === 1) {
        if (!token.name || !token.symbol) {
          setError("Please fill in Name and Symbol");
          setLoading(false);
          return;
        }
        setStep(2);
      } else {
        if (!launchWallet) {
          setError("Launch Wallet is required");
          setLoading(false);
          return;
        }
        router.push("/launchpad/review");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const descLen = (token.description || "").length;

  return (
    <div className="min-h-screen bg-slate-950 p-6 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-100 font-[Inter,sans-serif]">
            {t("launchpad_step1_title")} {step === 2 && "→"} {step === 2 && t("launchpad_step2_title")}
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            {step === 1
              ? "Token metadata for Metaplex standards"
              : "Security parameters and wallet"}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-500/30 rounded-xl text-red-300 backdrop-blur-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Token Info */}
          {step === 1 && (
            <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-slate-700/50 shadow-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Image Upload */}
                <div>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      aspect-square min-h-32 rounded-xl cursor-pointer transition-all duration-200 flex flex-col items-center justify-center
                      border-2 border-dashed
                      ${token.imagePreviewUrl ? "border-slate-600" : isDragging ? "border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)]" : "border-slate-700"}
                      bg-slate-900/50 hover:border-cyan-500/60
                    `}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/gif"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {token.imagePreviewUrl ? (
                      <div className="relative w-full h-full rounded-xl overflow-hidden group">
                        <img
                          src={token.imagePreviewUrl}
                          alt="Token"
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageFile(null);
                          }}
                          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/90 text-white text-sm font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                        <span className="absolute bottom-2 left-2 text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
                          {t("launchpad_step1_replaceLabel")}
                        </span>
                      </div>
                    ) : (
                      <>
                        <svg
                          className="w-12 h-12 text-slate-500 mb-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <span className="text-slate-500 text-sm text-center px-4">
                          {t("launchpad_step1_uploadLabel")}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Right: Text Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2 font-[Inter,sans-serif]">
                      {t("launchpad_step1_nameLabel")} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={token.name}
                      onChange={(e) =>
                        setToken({ ...token, name: e.target.value.slice(0, 32) })
                      }
                      placeholder={t("launchpad_step1_namePlaceholder")}
                      maxLength={32}
                      required
                      className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 text-slate-100 placeholder-slate-500 font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      {token.name.length}/32
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2 font-[Inter,sans-serif]">
                      {t("launchpad_step1_symbolLabel")} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={token.symbol}
                      onChange={(e) =>
                        setToken({
                          ...token,
                          symbol: e.target.value.slice(0, 10).toUpperCase(),
                        })
                      }
                      placeholder={t("launchpad_step1_symbolPlaceholder")}
                      maxLength={10}
                      required
                      className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 text-slate-100 placeholder-slate-500 font-mono"
                    />
                    <p className="text-xs text-slate-500 mt-1 font-mono">
                      {token.symbol.length}/10
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2 font-[Inter,sans-serif]">
                      {t("launchpad_step1_descriptionLabel")}
                    </label>
                    <textarea
                      value={token.description || ""}
                      onChange={(e) =>
                        setToken({
                          ...token,
                          description: e.target.value.slice(0, MAX_DESC_CHARS),
                        })
                      }
                      placeholder={t("launchpad_step1_descriptionPlaceholder")}
                      maxLength={MAX_DESC_CHARS}
                      rows={4}
                      className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 text-slate-100 placeholder-slate-500 resize-none"
                    />
                    <p className="text-xs text-slate-500 mt-1 text-right font-mono">
                      {t("launchpad_step1_charCount", {
                        current: descLen,
                        max: MAX_DESC_CHARS,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Config + Safety Setup */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl p-6 md:p-8 border border-slate-700/50 shadow-xl">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2 font-[Inter,sans-serif]">
                    {t("launchpad_step2_initialSupply")}
                  </label>
                  <input
                    type="number"
                    value={initialSupply}
                    onChange={(e) =>
                      setInitialSupply(Math.max(0, parseInt(e.target.value) || 0))
                    }
                    min={0}
                    placeholder={t("launchpad_step2_initialSupplyPlaceholder")}
                    className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 text-slate-100 placeholder-slate-500 font-mono"
                  />
                </div>

                <div className="mt-8 pt-6 border-t border-slate-700">
                  <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4 font-[Inter,sans-serif]">
                    {t("launchpad_step2_securityParams")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div
                      className={`p-4 rounded-xl border transition-all ${
                        safetyConfig.renounceMint
                          ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.15)]"
                          : "bg-slate-900/50 border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">
                          {t("launchpad_step2_renounceMint")}
                        </span>
                        <Switch
                          checked={safetyConfig.renounceMint}
                          onCheckedChange={(v) =>
                            setSafetyConfig({ ...safetyConfig, renounceMint: v })
                          }
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("launchpad_step2_renounceMintDesc")}
                      </p>
                    </div>
                    <div
                      className={`p-4 rounded-xl border transition-all ${
                        safetyConfig.renounceFreeze
                          ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.15)]"
                          : "bg-slate-900/50 border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">
                          {t("launchpad_step2_renounceFreeze")}
                        </span>
                        <Switch
                          checked={safetyConfig.renounceFreeze}
                          onCheckedChange={(v) =>
                            setSafetyConfig({ ...safetyConfig, renounceFreeze: v })
                          }
                        />
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("launchpad_step2_renounceFreezeDesc")}
                      </p>
                    </div>
                    <div
                      className={`p-4 rounded-xl border transition-all md:col-span-2 lg:col-span-1 ${
                        safetyConfig.lpLockMonths > 0
                          ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.15)]"
                          : "bg-slate-900/50 border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-200">
                          {t("launchpad_step2_lpLock")}
                        </span>
                        <span className="text-xs font-mono text-emerald-400">
                          {safetyConfig.lpLockMonths} {t("launchpad_step2_lpLockMonths").split(" ")[1]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("launchpad_step2_lpLockDesc")}
                      </p>
                      <select
                        value={safetyConfig.lpLockMonths}
                        onChange={(e) =>
                          setSafetyConfig({
                            ...safetyConfig,
                            lpLockMonths: parseInt(e.target.value),
                          })
                        }
                        className="mt-2 w-full p-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-200 text-sm"
                      >
                        <option value={0}>No lock</option>
                        <option value={3}>3 months</option>
                        <option value={6}>6 months</option>
                        <option value={12}>12 months</option>
                        <option value={24}>24 months</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2 font-[Inter,sans-serif]">
                      {t("launchpad_step2_launchWallet")} <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={launchWallet}
                      onChange={(e) => setLaunchWallet(e.target.value)}
                      placeholder={t("launchpad_step2_launchWalletPlaceholder")}
                      required
                      className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-cyan-500/50 text-slate-100 placeholder-slate-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2 font-[Inter,sans-serif]">
                      {t("launchpad_step2_tipWallet")}
                    </label>
                    <input
                      type="text"
                      value={tipWallet}
                      onChange={(e) => setTipWallet(e.target.value)}
                      placeholder={t("launchpad_step2_launchWalletPlaceholder")}
                      className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 focus:border-cyan-500/50 text-slate-100 placeholder-slate-500 font-mono text-sm"
                    />
                  </div>
                  {tipWallet && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2 font-[Inter,sans-serif]">
                        {t("launchpad_step2_tipAmount")}
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
                        className="w-full p-3 rounded-xl bg-slate-900/50 border border-slate-700 text-slate-100 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4">
            {step === 2 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={loading}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                {t("launchpad_back")}
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                loading ||
                (step === 1 && (!token.name || !token.symbol)) ||
                (step === 2 && !launchWallet)
              }
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-semibold shadow-[0_0_20px_rgba(34,211,238,0.3)]"
            >
              {loading
                ? "…"
                : step === 1
                  ? t("launchpad_next")
                  : t("launchpad_continueReview")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
              className="border-slate-600 text-slate-400"
            >
              {t("launchpad_cancel")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


