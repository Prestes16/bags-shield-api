"use client";

import { cn } from "@/lib/utils"

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  LogOut,
  Bell,
  ShieldCheck,
  Globe,
  Key,
  FileText,
  MessageCircle,
  ExternalLink,
  Sun,
  Moon,
  Monitor,
  Palette,
  X,
  Languages,
  Zap,
  Home,
  Search,
  History,
  Settings as SettingsIcon,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Language } from "@/lib/i18n/translations";
import { useTheme, type Theme } from "@/lib/theme/theme-context";
import { BottomNav } from "@/components/ui/bottom-nav";

// Custom Toggle Switch Component - iOS Style, Mobile Optimized
function ToggleSwitch({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label || (enabled ? "Enabled" : "Disabled")}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!enabled);
      }}
      className={cn(
        "relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out touch-manipulation",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
        enabled
          ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)]"
          : "bg-bg-input border border-border-subtle"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
          enabled ? "translate-x-6" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// Settings Row Component - Mobile Optimized
function SettingsRow({
  icon: Icon,
  label,
  sublabel,
  value,
  onClick,
  children,
}: {
  icon?: React.ElementType;
  label: string;
  sublabel?: string;
  value?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const isClickable = !!onClick;
  const Component = isClickable ? "button" : "div";

  return (
    <Component
      type={isClickable ? "button" : undefined}
      onClick={isClickable ? onClick : undefined}
      className={cn(
        "w-full flex items-center justify-between min-h-[56px] py-3 px-1 border-b border-border-subtle last:border-b-0",
        isClickable && "hover:bg-bg-card-hover active:scale-[0.99] -mx-1 px-2 rounded-lg transition-all touch-manipulation cursor-pointer"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {Icon && <Icon className="w-[18px] h-[18px] text-text-muted flex-shrink-0" />}
        <div className="text-left min-w-0">
          <span className="text-text-primary text-sm font-medium block truncate">{label}</span>
          {sublabel && (
            <p className="text-xs text-text-muted mt-0.5 truncate leading-snug">{sublabel}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        {value && <span className="text-text-muted text-xs truncate max-w-[100px]">{value}</span>}
        {children}
        {isClickable && !children && (
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
        )}
      </div>
    </Component>
  );
}

// Skeleton Loading State
function SettingsSkeleton() {
  return (
    <div className="min-h-screen bg-bg-page text-text-primary transition-colors duration-300">
      <div className="max-w-2xl mx-auto px-5 py-6 pb-32">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="h-8 w-32 bg-white/10 rounded-lg animate-pulse" />
        </div>

        {/* Identity Card Skeleton */}
        <div className="bg-white/5 rounded-2xl p-5 mb-6 border border-white/10">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 animate-pulse" />
            <div className="flex-1">
              <div className="h-5 w-40 bg-white/10 rounded animate-pulse mb-2" />
              <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
          <div className="h-12 bg-white/10 rounded-xl animate-pulse" />
        </div>

        {/* Settings Groups Skeleton */}
        {[1, 2, 3].map((group) => (
          <div key={group} className="mb-6">
            <div className="h-4 w-24 bg-white/10 rounded animate-pulse mb-3" />
            <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between py-4 border-b border-white/5 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-20 bg-white/10 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Theme Selector Modal
function ThemeModal({
  isOpen,
  onClose,
  currentTheme,
  onSelect,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: Theme;
  onSelect: (theme: Theme) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (!isOpen) return null;

  const themes: { code: Theme; label: string; icon: React.ElementType }[] = [
    { code: "light", label: t.settings.light, icon: Sun },
    { code: "dark", label: t.settings.dark, icon: Moon },
    { code: "neon", label: t.settings.neon, icon: Zap },
    { code: "system", label: t.settings.system, icon: Monitor },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full sm:max-w-sm mx-4 mb-4 sm:mb-0 bg-[var(--card)] border border-border-subtle rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 flex items-center justify-center">
              <Palette className="w-5 h-5 text-[var(--cyan-primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">{t.settings.selectTheme}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-bg-card flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Theme Options */}
        <div className="p-3">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            return (
              <button
                key={themeOption.code}
                type="button"
                onClick={() => {
                  onSelect(themeOption.code);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-xl transition-all mb-2 last:mb-0 ${
                  currentTheme === themeOption.code
                    ? "bg-gradient-to-r from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 border border-[var(--cyan-primary)]/30"
                    : "bg-bg-card border border-transparent hover:bg-bg-card-hover"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-bg-card-hover flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[var(--cyan-primary)]" />
                  </div>
                  <span className="text-text-primary font-medium">{themeOption.label}</span>
                </div>
                {currentTheme === themeOption.code && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Language Selector Modal
function LanguageModal({
  isOpen,
  onClose,
  currentLanguage,
  onSelect,
  t,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: Language;
  onSelect: (lang: Language) => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (!isOpen) return null;

  const languages: { code: Language; label: string; flag: string }[] = [
    { code: "en", label: t.settings.english, flag: "US" },
    { code: "pt-BR", label: t.settings.portuguese, flag: "BR" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full sm:max-w-sm mx-4 mb-4 sm:mb-0 bg-[var(--card)] border border-border-subtle rounded-2xl overflow-hidden animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 flex items-center justify-center">
<Languages className="w-5 h-5 text-[var(--cyan-primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary">{t.settings.selectLanguage}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-bg-card flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {/* Language Options */}
        <div className="p-3">
          {languages.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => {
                onSelect(lang.code);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-4 py-4 rounded-xl transition-all mb-2 last:mb-0 ${
                currentLanguage === lang.code
                  ? "bg-gradient-to-r from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 border border-[var(--cyan-primary)]/30"
                  : "bg-bg-card border border-transparent hover:bg-bg-card-hover"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Flag */}
                <div className="w-10 h-10 rounded-full bg-bg-card-hover flex items-center justify-center text-lg font-bold text-text-primary">
                  {lang.flag === "US" ? (
                    <span className="text-base">EN</span>
                  ) : (
                    <span className="text-base">PT</span>
                  )}
                </div>
                <span className="text-text-primary font-medium">{lang.label}</span>
              </div>
              {currentLanguage === lang.code && (
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);

  // Settings State
  const [settings, setSettings] = useState({
    telemetry: true,
    seedVault: true,
    notifications: true,
    strictMode: false,
    cluster: "Mainnet-Beta",
  });

  const walletAddress = "8xF4k...3Xtq";
  const fullAddress = "8xF4k9pN2wLm5JvH4cRn6sYa8dBt1eQu3Xtq";
  // Balance should come from real wallet connection
  const balance = null; // Will show "—" until wallet is connected

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(fullAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsSaving(false);
  };

  const handleDisconnect = () => {
    router.push("/");
  };

  if (isLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="min-h-screen bg-bg-page text-text-primary transition-colors duration-300">
      <div className="max-w-2xl mx-auto px-4 py-5 pb-24">
        {/* Theme Modal */}
        <ThemeModal
          isOpen={showThemeModal}
          onClose={() => setShowThemeModal(false)}
          currentTheme={theme}
          onSelect={setTheme}
          t={t}
        />

        {/* Language Modal */}
        <LanguageModal
          isOpen={showLanguageModal}
          onClose={() => setShowLanguageModal(false)}
          currentLanguage={language}
          onSelect={setLanguage}
          t={t}
        />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-bg-card/80 backdrop-blur-sm border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover active:scale-95 transition-all duration-200 ease-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50"
            aria-label="Go back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-text-primary">{t.settings.title}</h1>
        </div>

        {/* Identity Card */}
        <div className="bg-bg-card rounded-xl p-4 mb-5 border border-border-subtle">
          <div className="flex items-center gap-3 mb-4">
            {/* Shield Logo */}
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 border border-[var(--cyan-primary)]/30 flex items-center justify-center overflow-hidden flex-shrink-0">
              <Image
                src="/images/bags-shield-logo.png"
                alt="Bags Shield"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base font-semibold text-text-primary truncate">
                  Cleiton
                </span>
                <span className="text-text-muted text-xs">•</span>
                <span className="text-text-muted font-mono text-xs truncate">
                  {walletAddress}
                </span>
              </div>
<div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-[var(--cyan-primary)]/20 to-[var(--cyan-secondary)]/20 border border-[var(--cyan-primary)]/30">
<div className="w-1 h-1 rounded-full bg-[var(--cyan-primary)] animate-pulse" />
<span className="text-[10px] font-medium text-[var(--cyan-primary)]">
                  Beta Tester
                </span>
              </div>
            </div>
          </div>

          {/* Balance */}
          <div className="bg-bg-card rounded-lg px-3 py-2 mb-3 border border-border-subtle">
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">{t.settings.balance}</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-text-muted">{balance || "—"}</span>
              {balance && <span className="text-text-muted text-sm font-medium">SOL</span>}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyAddress}
              className="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-xl bg-bg-card border border-border-subtle text-text-secondary hover:bg-bg-card-hover hover:text-text-primary active:scale-[0.98] transition-all duration-200 ease-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">{t.common.copied}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span className="text-sm font-medium">{t.common.copyAddress}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 active:scale-[0.98] transition-all duration-200 ease-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
              aria-label="Disconnect wallet"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cluster Setting */}
        <div className="mb-5">
          <div className="bg-bg-card rounded-xl border border-border-subtle px-4">
            <SettingsRow
              icon={Globe}
              label="Cluster"
              value={settings.cluster}
              onClick={() => {
                setSettings((s) => ({
                  ...s,
                  cluster:
                    s.cluster === "Mainnet-Beta" ? "Devnet" : "Mainnet-Beta",
                }));
              }}
            />
          </div>
        </div>

        {/* Preferences */}
        <div className="mb-5">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">
            Preferences
          </h3>
          <div className="bg-bg-card rounded-xl border border-border-subtle px-4">
            <SettingsRow 
              icon={Languages} 
              label={t.settings.language} 
              value={language === "en" ? t.settings.english : t.settings.portuguese} 
              onClick={() => setShowLanguageModal(true)} 
            />
            <SettingsRow
              icon={Bell}
              label={t.settings.telemetry}
              sublabel={t.settings.telemetrySub}
            >
              <ToggleSwitch
                enabled={settings.telemetry}
                onChange={(v) => setSettings((s) => ({ ...s, telemetry: v }))}
              />
            </SettingsRow>
          </div>
        </div>

        {/* Security */}
        <div className="mb-5">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">
            Security
          </h3>
          <div className="bg-bg-card rounded-xl border border-border-subtle px-4">
            <SettingsRow
              icon={ShieldCheck}
              label={t.settings.wallets}
              value={t.settings.connectedPhantom}
              onClick={() => {}}
            />
            <SettingsRow icon={Key} label={t.settings.seedVault}>
              <ToggleSwitch
                enabled={settings.seedVault}
                onChange={(v) => setSettings((s) => ({ ...s, seedVault: v }))}
              />
            </SettingsRow>
          </div>
        </div>

        {/* Appearance */}
        <div className="mb-5">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">
            Appearance
          </h3>
          <div className="bg-bg-card rounded-xl border border-border-subtle px-4">
            <SettingsRow
              icon={theme === "light" ? Sun : theme === "dark" ? Moon : theme === "neon" ? Zap : Monitor}
              label={t.settings.theme}
              value={theme === "system" ? t.settings.system : theme === "light" ? t.settings.light : theme === "neon" ? t.settings.neon : t.settings.dark}
              onClick={() => setShowThemeModal(true)}
            />
          </div>
        </div>

        {/* About */}
        <div className="mb-5">
          <h3 className="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">
            About
          </h3>
          <div className="bg-bg-card rounded-xl border border-border-subtle px-4">
            <SettingsRow
              icon={FileText}
              label={t.settings.about}
              value={`${t.settings.version} 0.1.0 (1)`}
              onClick={() => {}}
            />
          </div>
          
          {/* Links */}
          <div className="flex items-center gap-4 mt-4 px-1">
            <button
              type="button"
              className="text-sm text-[var(--cyan-primary)] hover:opacity-80 transition-colors"
            >
              {t.settings.termsOfUse}
            </button>
            <button
              type="button"
              className="text-sm text-[var(--cyan-primary)] hover:opacity-80 transition-colors"
            >
              {t.settings.privacyPolicy}
            </button>
          </div>
          <button
            type="button"
            className="text-sm text-[var(--cyan-primary)] hover:opacity-80 transition-colors mt-2 px-1"
          >
            {t.settings.openSourceCredits}
          </button>
        </div>

        {/* Feedback */}
        <div className="mb-6">
          <div className="bg-bg-card rounded-xl border border-border-subtle px-4">
            <SettingsRow
              icon={MessageCircle}
              label={t.settings.feedback}
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Save Button (inline, not fixed) */}
        <div className="mt-6 mb-2">
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white text-sm font-semibold shadow-[0_0_16px_var(--cyan-glow)] hover:shadow-[0_0_24px_var(--cyan-glow)] hover:opacity-95 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav 
        items={[
          { icon: Home, label: t.nav.home, href: "/" },
          { icon: Search, label: t.nav.search, href: "/search" },
          { icon: History, label: t.nav.history, href: "/history" },
          { icon: SettingsIcon, label: t.nav.settings, href: "/settings" },
        ]}
      />
    </div>
  );
}
