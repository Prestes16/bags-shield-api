"use client";

import React from "react"

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
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";
import type { Language } from "@/lib/i18n/translations";
import { useTheme, type Theme } from "@/lib/theme/theme-context";

// Custom Toggle Switch Component
function ToggleSwitch({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-7 rounded-full transition-all duration-300 ${
        enabled
          ? "bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]"
          : "bg-white/10"
      }`}
    >
      <div
        className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${
          enabled ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

// Settings Row Component
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

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isClickable && !children}
      className={`w-full flex items-center justify-between py-4 px-1 border-b border-white/5 last:border-b-0 ${
        isClickable ? "hover:bg-white/5 -mx-1 px-2 rounded-lg transition-colors" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {Icon && <Icon className="w-5 h-5 text-slate-400" />}
        <div className="text-left">
          <span className="text-text-primary font-medium">{label}</span>
          {sublabel && (
            <p className="text-xs text-slate-500 mt-0.5">{sublabel}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-slate-400 text-sm">{value}</span>}
        {children}
        {isClickable && !children && (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </div>
    </button>
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Palette className="w-5 h-5 text-cyan-400" />
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
                    ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30"
                    : "bg-bg-card border border-transparent hover:bg-bg-card-hover"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-bg-card-hover flex items-center justify-center">
                    <Icon className="w-5 h-5 text-cyan-400" />
                  </div>
                  <span className="text-text-primary font-medium">{themeOption.label}</span>
                </div>
                {currentTheme === themeOption.code && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Languages className="w-5 h-5 text-cyan-400" />
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
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30"
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
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
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
  const balance = "12.45";

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
      <div className="max-w-2xl mx-auto px-5 py-6 pb-32">
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
        <div className="flex items-center gap-3 mb-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-bg-card border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-text-primary">{t.settings.title}</h1>
        </div>

        {/* Identity Card */}
        <div className="bg-bg-card backdrop-blur-xl rounded-2xl p-5 mb-6 border border-border-subtle">
          <div className="flex items-center gap-4 mb-5">
            {/* Shield Logo */}
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center overflow-hidden">
              <Image
                src="/images/bags-shield-logo.png"
                alt="Bags Shield"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-semibold text-text-primary">
                  Cleiton
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400 font-mono text-sm">
                  {walletAddress}
                </span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-xs font-medium text-cyan-400">
                  Beta Tester
                </span>
              </div>
            </div>
          </div>

          {/* Balance Card */}
          <div className="bg-bg-card rounded-xl p-4 mb-4 border border-border-subtle">
            <p className="text-xs text-slate-500 mb-1">{t.settings.balance}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-text-primary">{balance}</span>
              <span className="text-slate-400 font-medium">SOL</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCopyAddress}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-bg-card border border-border-subtle text-text-secondary hover:bg-bg-card-hover hover:text-text-primary transition-all"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-green-400">{t.common.copied}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>{t.common.copyAddress}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cluster Setting */}
        <div className="mb-6">
          <div className="bg-bg-card backdrop-blur-xl rounded-2xl border border-border-subtle px-4">
            <SettingsRow
              icon={Globe}
              label={t.settings.cluster}
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
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            {t.settings.preferences}
          </h3>
          <div className="bg-bg-card backdrop-blur-xl rounded-2xl border border-border-subtle px-4">
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
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            {t.settings.security}
          </h3>
          <div className="bg-bg-card backdrop-blur-xl rounded-2xl border border-border-subtle px-4">
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
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            {t.settings.appearance}
          </h3>
          <div className="bg-bg-card backdrop-blur-xl rounded-2xl border border-border-subtle px-4">
            <SettingsRow
              icon={theme === "light" ? Sun : theme === "dark" ? Moon : Monitor}
              label={t.settings.theme}
              value={theme === "system" ? t.settings.system : theme === "light" ? t.settings.light : t.settings.dark}
              onClick={() => setShowThemeModal(true)}
            />
          </div>
        </div>

        {/* About */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
            {t.settings.about}
          </h3>
          <div className="bg-bg-card backdrop-blur-xl rounded-2xl border border-border-subtle px-4">
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
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {t.settings.termsOfUse}
            </button>
            <button
              type="button"
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              {t.settings.privacyPolicy}
            </button>
          </div>
          <button
            type="button"
            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors mt-2 px-1"
          >
            {t.settings.openSourceCredits}
          </button>
        </div>

        {/* Feedback */}
        <div className="mb-8">
          <div className="bg-bg-card backdrop-blur-xl rounded-2xl border border-border-subtle px-4">
            <SettingsRow
              icon={MessageCircle}
              label={t.settings.feedback}
              onClick={() => {}}
            />
          </div>
        </div>

        {/* Save Button - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[var(--bg-page)] via-[var(--bg-page)] to-transparent md:relative md:p-0 md:bg-none">
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t.common.saving}
                </span>
              ) : (
                t.common.save
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
