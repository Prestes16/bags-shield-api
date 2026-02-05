"use client";

import React from "react"

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Home,
  Coins,
  Shield,
  CheckCircle,
  AlertTriangle,
  Lock,
  Unlock,
  Users,
  Link2,
  FileSearch,
  Sparkles,
  Info,
  Check,
  X,
  Upload,
  ImageIcon,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import { AuthorityToggle, AdvancedModeToggle } from "./authority-toggle";

// Form data types
interface TokenBasics {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  initialSupply: string;
  decimals: string;
}

interface SafetySettings {
  mintAuthority: "renounce" | "keep";
  freezeAuthority: "renounce" | "keep";
  lockLiquidity: boolean;
  lockDuration: string;
  publicTeam: boolean;
  verifiedSocials: boolean;
  auditPlanned: boolean;
}

// Step indicator component
function StepIndicator({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div key={i} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              i + 1 === currentStep
                ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white shadow-[0_0_12px_var(--cyan-glow)]"
                : i + 1 < currentStep
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-bg-card text-text-muted border border-border-subtle"
            }`}
          >
            {i + 1 < currentStep ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          {i < totalSteps - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 transition-all ${
                i + 1 < currentStep ? "bg-emerald-500/50" : "bg-border-subtle"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Readiness score component
function ReadinessScore({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const getLabel = () => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Needs Work";
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-border-subtle"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${score * 2.51} 251`}
            className={getColor()}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-bold ${getColor()}`}>{score}</span>
        </div>
      </div>
      <span className={`text-sm font-medium mt-2 ${getColor()}`}>
        {getLabel()}
      </span>
    </div>
  );
}

export function CreateToken() {
  const router = useRouter();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [showLaunchModal, setShowLaunchModal] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form state
  const [tokenBasics, setTokenBasics] = useState<TokenBasics>({
    name: "",
    symbol: "",
    description: "",
    imageUrl: "",
    initialSupply: "1000000000",
    decimals: "9",
  });

  const [safetySettings, setSafetySettings] = useState<SafetySettings>({
    mintAuthority: "renounce",
    freezeAuthority: "renounce",
    lockLiquidity: true,
    lockDuration: "6",
    publicTeam: false,
    verifiedSocials: false,
    auditPlanned: false,
  });

  // Calculate readiness score
  const calculateReadinessScore = () => {
    let score = 0;

    // Token basics (30 points)
    if (tokenBasics.name.length >= 3) score += 10;
    if (tokenBasics.symbol.length >= 2) score += 10;
    if (tokenBasics.description.length >= 20) score += 10;

    // Safety settings (50 points)
    if (safetySettings.mintAuthority === "renounce") score += 15;
    if (safetySettings.freezeAuthority === "renounce") score += 15;
    if (safetySettings.lockLiquidity) score += 10;
    if (safetySettings.lockLiquidity && Number(safetySettings.lockDuration) >= 6)
      score += 10;

    // Transparency (20 points)
    if (safetySettings.publicTeam) score += 7;
    if (safetySettings.verifiedSocials) score += 7;
    if (safetySettings.auditPlanned) score += 6;

    return score;
  };

  const readinessScore = calculateReadinessScore();

  const handleNext = () => {
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleImageUpload = (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setTokenBasics({ ...tokenBasics, imageUrl: result });
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeImage = () => {
    setImagePreview("");
    setTokenBasics({ ...tokenBasics, imageUrl: "" });
  };

  // Step 1: Token Basics
  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 flex items-center justify-center border border-[var(--cyan-primary)]/30">
          <Coins className="w-5 h-5 text-[var(--cyan-primary)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {t.createToken.step1Title}
          </h2>
          <p className="text-xs text-text-muted">{t.createToken.step1Desc}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {t.createToken.tokenName}
          </label>
          <input
            type="text"
            value={tokenBasics.name}
            onChange={(e) =>
              setTokenBasics({ ...tokenBasics, name: e.target.value })
            }
            placeholder={t.createToken.tokenNamePlaceholder}
            className="w-full h-12 px-4 rounded-xl bg-bg-input border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[var(--cyan-primary)]/50 focus:ring-1 focus:ring-[var(--cyan-primary)]/20 transition-all"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {t.createToken.tokenSymbol}
          </label>
          <input
            type="text"
            value={tokenBasics.symbol}
            onChange={(e) =>
              setTokenBasics({
                ...tokenBasics,
                symbol: e.target.value.toUpperCase(),
              })
            }
            placeholder={t.createToken.tokenSymbolPlaceholder}
            maxLength={10}
            className="w-full h-12 px-4 rounded-xl bg-bg-input border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[var(--cyan-primary)]/50 focus:ring-1 focus:ring-[var(--cyan-primary)]/20 transition-all uppercase"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {t.createToken.tokenDescription}
          </label>
          <textarea
            value={tokenBasics.description}
            onChange={(e) =>
              setTokenBasics({ ...tokenBasics, description: e.target.value })
            }
            placeholder={t.createToken.tokenDescriptionPlaceholder}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-bg-input border border-border-subtle text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[var(--cyan-primary)]/50 focus:ring-1 focus:ring-[var(--cyan-primary)]/20 transition-all resize-none"
          />
        </div>

        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">
            {t.createToken.tokenImage}
          </label>
          
          {imagePreview ? (
            // Image Preview
            <div className="relative w-full h-40 rounded-xl overflow-hidden bg-bg-card border-2 border-[var(--cyan-primary)]/30">
              <Image
                src={imagePreview || "/placeholder.svg"}
                alt="Token preview"
                fill
                className="object-contain"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/90 hover:bg-red-500 flex items-center justify-center text-white transition-colors"
                title="Remove image"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            // Upload Area
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`relative w-full h-40 rounded-xl border-2 border-dashed transition-all cursor-pointer active:scale-[0.98] ${
                isDragging
                  ? "border-[var(--cyan-primary)] bg-[var(--cyan-primary)]/10"
                  : "border-border-subtle bg-bg-input hover:border-[var(--cyan-primary)]/50 hover:bg-[var(--cyan-primary)]/5"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-[var(--cyan-primary)]/10 flex items-center justify-center">
                  {isDragging ? (
                    <Upload className="w-6 h-6 text-[var(--cyan-primary)] animate-bounce" />
                  ) : (
                    <ImageIcon className="w-6 h-6 text-[var(--cyan-primary)]" />
                  )}
                </div>
                <div className="text-center px-4">
                  <p className="text-sm font-medium text-text-primary">
                    {isDragging ? "Drop image here" : "Tap to upload"}
                  </p>
                  <p className="text-xs text-text-muted mt-1">
                    Choose from gallery or take photo
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-text-secondary mb-1.5 min-h-[20px]">
              {t.createToken.initialSupply}
            </label>
            <input
              type="text"
              value={tokenBasics.initialSupply}
              onChange={(e) =>
                setTokenBasics({ ...tokenBasics, initialSupply: e.target.value })
              }
              className="w-full h-12 px-4 rounded-xl bg-bg-input border border-border-subtle text-text-primary focus:outline-none focus:border-[var(--cyan-primary)]/50 focus:ring-1 focus:ring-[var(--cyan-primary)]/20 transition-all"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-text-secondary mb-1.5 min-h-[20px]">
              {t.createToken.decimals}
            </label>
            <input
              type="number"
              value={tokenBasics.decimals}
              onChange={(e) =>
                setTokenBasics({ ...tokenBasics, decimals: e.target.value })
              }
              min="0"
              max="18"
              className="w-full h-12 px-4 rounded-xl bg-bg-input border border-border-subtle text-text-primary focus:outline-none focus:border-[var(--cyan-primary)]/50 focus:ring-1 focus:ring-[var(--cyan-primary)]/20 transition-all [appearance:none] [-moz-appearance:none] [-webkit-appearance:none]"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Step 2: Safety Settings
  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center border border-emerald-500/30">
          <Shield className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            {t.createToken.step2Title}
          </h2>
          <p className="text-xs text-text-muted">{t.createToken.step2Desc}</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Advanced Mode Toggle */}
        <AdvancedModeToggle enabled={advancedMode} onChange={setAdvancedMode} />

        {/* Mint Authority */}
        <AuthorityToggle
          type="mint"
          value={safetySettings.mintAuthority}
          onChange={(value) =>
            setSafetySettings({ ...safetySettings, mintAuthority: value })
          }
          showAdvanced={advancedMode}
        />

        {/* Freeze Authority */}
        <AuthorityToggle
          type="freeze"
          value={safetySettings.freezeAuthority}
          onChange={(value) =>
            setSafetySettings({ ...safetySettings, freezeAuthority: value })
          }
          showAdvanced={advancedMode}
        />

        {/* Lock Liquidity */}
        <div className="bg-bg-card rounded-xl p-4 border border-border-subtle">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[var(--cyan-primary)] mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-text-primary">
                    {t.createToken.lockLiquidity}
                  </h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    {t.createToken.lockLiquidityDesc}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={safetySettings.lockLiquidity}
                  aria-label={t.createToken.lockLiquidity}
                  onClick={() =>
                    setSafetySettings({
                      ...safetySettings,
                      lockLiquidity: !safetySettings.lockLiquidity,
                    })
                  }
                  className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
                    safetySettings.lockLiquidity
                      ? "bg-emerald-500"
                      : "bg-bg-input border border-border-subtle"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                      safetySettings.lockLiquidity
                        ? "translate-x-6"
                        : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              {safetySettings.lockLiquidity && (
                <div className="mt-3">
                  <label className="block text-xs text-text-muted mb-1.5">
                    {t.createToken.lockDuration} (months)
                  </label>
                  <input
                    type="number"
                    value={safetySettings.lockDuration}
                    onChange={(e) =>
                      setSafetySettings({
                        ...safetySettings,
                        lockDuration: e.target.value,
                      })
                    }
                    min="1"
                    max="120"
                    className="w-full h-10 px-3 rounded-lg bg-bg-input border border-border-subtle text-text-primary text-sm focus:outline-none focus:border-cyan-500/50 transition-all"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transparency Checklist */}
        <div className="bg-bg-card rounded-xl p-4 border border-border-subtle">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-[var(--cyan-primary)]" />
            {t.createToken.transparencyChecklist}
          </h3>
          <div className="space-y-3">
            {[
              { key: "publicTeam", label: t.createToken.publicTeam, icon: Users },
              {
                key: "verifiedSocials",
                label: t.createToken.verifiedSocials,
                icon: Link2,
              },
              {
                key: "auditPlanned",
                label: t.createToken.auditPlanned,
                icon: Shield,
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  setSafetySettings({
                    ...safetySettings,
                    [item.key]:
                      !safetySettings[item.key as keyof SafetySettings],
                  })
                }
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-bg-card-hover transition-all"
              >
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center transition-all ${
                    safetySettings[item.key as keyof SafetySettings]
                      ? "bg-emerald-500"
                      : "bg-bg-input border border-border-subtle"
                  }`}
                >
                  {safetySettings[item.key as keyof SafetySettings] && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
                <item.icon className="w-4 h-4 text-text-muted" />
                <span className="text-sm text-text-secondary">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Step 3: Review
  const renderStep3 = () => {
    const securityItems = [
      {
        label: t.createToken.mintAuthority,
        status: safetySettings.mintAuthority === "renounce",
        value:
          safetySettings.mintAuthority === "renounce"
            ? "Renounced"
            : "Retained",
      },
      {
        label: t.createToken.freezeAuthority,
        status: safetySettings.freezeAuthority === "renounce",
        value:
          safetySettings.freezeAuthority === "renounce"
            ? "Renounced"
            : "Retained",
      },
      {
        label: t.createToken.lockLiquidity,
        status: safetySettings.lockLiquidity,
        value: safetySettings.lockLiquidity
          ? `${safetySettings.lockDuration} months`
          : "Not locked",
      },
    ];

    const recommendations = [];
    if (safetySettings.mintAuthority === "keep") {
      recommendations.push("Consider renouncing mint authority for investor trust");
    }
    if (safetySettings.freezeAuthority === "keep") {
      recommendations.push("Consider renouncing freeze authority");
    }
    if (!safetySettings.lockLiquidity) {
      recommendations.push("Lock liquidity to prevent rug pulls");
    }
    if (!safetySettings.publicTeam) {
      recommendations.push("Make team identity public for transparency");
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center border border-purple-500/30">
            <Sparkles className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {t.createToken.step3Title}
            </h2>
            <p className="text-xs text-text-muted">{t.createToken.step3Desc}</p>
          </div>
        </div>

        {/* Readiness Score */}
        <div className="bg-bg-card rounded-xl p-5 border border-border-subtle">
          <h3 className="text-sm font-medium text-text-primary mb-4 text-center">
            {t.createToken.launchReadiness}
          </h3>
          <div className="flex justify-center">
            <ReadinessScore score={readinessScore} />
          </div>
        </div>

        {/* Token Summary */}
        <div className="bg-bg-card rounded-xl p-4 border border-border-subtle">
          <h3 className="text-sm font-medium text-text-primary mb-3">
            Token Summary
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Name</span>
              <span className="text-text-primary font-medium">
                {tokenBasics.name || "-"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Symbol</span>
              <span className="text-text-primary font-medium">
                {tokenBasics.symbol || "-"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Supply</span>
              <span className="text-text-primary font-medium">
                {Number(tokenBasics.initialSupply).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-muted">Decimals</span>
              <span className="text-text-primary font-medium">
                {tokenBasics.decimals}
              </span>
            </div>
          </div>
        </div>

        {/* Security Status */}
        <div className="bg-bg-card rounded-xl p-4 border border-border-subtle">
          <h3 className="text-sm font-medium text-text-primary mb-3">
            {t.createToken.securityStatus}
          </h3>
          <div className="space-y-2">
            {securityItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm text-text-muted">{item.label}</span>
                <div className="flex items-center gap-2">
                  {item.status ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  )}
                  <span
                    className={`text-sm font-medium ${item.status ? "text-emerald-400" : "text-amber-400"}`}
                  >
                    {item.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
            <h3 className="text-sm font-medium text-amber-400 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              {t.createToken.recommendations}
            </h3>
            <ul className="space-y-1.5">
              {recommendations.map((rec, i) => (
                <li key={i} className="text-xs text-amber-300/80 flex items-start gap-2">
                  <span className="text-amber-400 mt-0.5">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-page/95 backdrop-blur-lg border-b border-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (currentStep > 1 ? handlePrevious() : router.back())}
              className="w-10 h-10 rounded-xl bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-text-primary">
                {t.createToken.title}
              </h1>
              <p className="text-[10px] text-text-muted">
                {t.createToken.subtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-10 h-10 rounded-xl bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-[var(--cyan-primary)] hover:bg-bg-card-hover active:scale-95 transition-all"
          >
            <Home className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex justify-center pb-3">
          <StepIndicator currentStep={currentStep} totalSteps={3} />
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-5 pb-36 max-w-lg mx-auto">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </main>

      {/* Bottom Actions - Safe Area Aware */}
      <div className="fixed bottom-0 left-0 right-0 bg-[var(--bg-page)] border-t border-border-subtle/50 z-10 pb-safe">
        <div className="px-4 py-3">
          <div className="max-w-lg mx-auto flex gap-3">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={handlePrevious}
                className="flex-1 h-12 rounded-xl font-medium text-text-secondary bg-bg-card border border-border-subtle hover:bg-bg-card-hover active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t.createToken.previous}
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] shadow-[0_0_16px_var(--cyan-glow)] hover:shadow-[0_0_24px_var(--cyan-glow)] hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                {t.createToken.next}
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowLaunchModal(true)}
                className="flex-1 h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-[var(--cyan-primary)] shadow-[0_0_16px_var(--cyan-glow)] hover:shadow-[0_0_24px_var(--cyan-glow)] hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Launch
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Coming Soon Modal */}
      {showLaunchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-bg-card rounded-2xl border border-border-subtle p-6 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 flex items-center justify-center mb-4 border border-[var(--cyan-primary)]/30">
                <Sparkles className="w-8 h-8 text-[var(--cyan-primary)]" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                {t.createToken.comingSoon}
              </h2>
              <p className="text-sm text-text-muted mb-6">
                {t.createToken.launchNotAvailable}
              </p>
              <button
                type="button"
                onClick={() => setShowLaunchModal(false)}
                className="w-full h-12 rounded-xl font-medium text-white bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] hover:shadow-[0_0_20px_var(--cyan-glow)] hover:opacity-95 active:scale-98 transition-all"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
