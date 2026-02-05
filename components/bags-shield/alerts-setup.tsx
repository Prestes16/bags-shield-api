"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Smartphone,
  Bot,
  MessageCircle,
  Shield,
  Waves,
  Droplets,
  Coins,
  Check,
  Bell,
  Filter,
  Save,
} from "lucide-react";

interface AlertsSetupProps {
  isLoading?: boolean;
  onSave?: (config: AlertConfig) => void;
}

interface AlertConfig {
  channels: {
    push: boolean;
    telegram: boolean;
    discord: boolean;
  };
  triggers: {
    shieldScoreThreshold: number;
    whaleActivity: boolean;
    liquidityDrain: boolean;
    newMintAuth: boolean;
  };
  frequency: "immediate" | "hourly" | "daily";
  watchlistOnly: boolean;
}

// Skeleton Loading Component
function AlertsSetupSkeleton() {
  return (
    <div className="min-h-screen bg-bg-page text-white">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4 mb-2">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="h-7 w-40 bg-white/10 rounded-lg animate-pulse" />
        </div>
        <div className="h-4 w-64 bg-white/5 rounded animate-pulse mb-8 ml-14" />

        {/* Channels Skeleton */}
        <div className="h-5 w-32 bg-white/10 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white/5 border border-white/10"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
                <div className="w-12 h-6 rounded-full bg-white/10 animate-pulse" />
              </div>
              <div className="h-4 w-20 bg-white/10 rounded animate-pulse mb-2" />
              <div className="h-8 w-full bg-white/10 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>

        {/* Triggers Skeleton */}
        <div className="h-5 w-40 bg-white/10 rounded animate-pulse mb-4" />
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 mb-8">
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
                  <div>
                    <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-2" />
                    <div className="h-3 w-48 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
                <div className="w-12 h-6 rounded-full bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Frequency Skeleton */}
        <div className="h-5 w-36 bg-white/10 rounded animate-pulse mb-4" />
        <div className="p-5 rounded-2xl bg-white/5 border border-white/10 mb-8">
          <div className="space-y-4">
            <div className="h-12 w-full bg-white/10 rounded-xl animate-pulse" />
            <div className="flex items-center justify-between">
              <div className="h-4 w-48 bg-white/10 rounded animate-pulse" />
              <div className="w-12 h-6 rounded-full bg-white/10 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Button Skeleton */}
        <div className="h-14 w-full bg-white/10 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

export function AlertsSetup({ isLoading = false, onSave }: AlertsSetupProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  // Alert Configuration State
  const [config, setConfig] = useState<AlertConfig>({
    channels: {
      push: true,
      telegram: false,
      discord: false,
    },
    triggers: {
      shieldScoreThreshold: 70,
      whaleActivity: true,
      liquidityDrain: true,
      newMintAuth: false,
    },
    frequency: "immediate",
    watchlistOnly: false,
  });

  const [telegramConnected, setTelegramConnected] = useState(false);
  const [discordConnected, setDiscordConnected] = useState(false);

  if (isLoading) {
    return <AlertsSetupSkeleton />;
  }

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (onSave) {
      onSave(config);
    }
    setIsSaving(false);
    router.push("/");
  };

  const updateChannel = (channel: keyof AlertConfig["channels"], value: boolean) => {
    setConfig((prev) => ({
      ...prev,
      channels: { ...prev.channels, [channel]: value },
    }));
  };

  const updateTrigger = (
    trigger: keyof AlertConfig["triggers"],
    value: boolean | number
  ) => {
    setConfig((prev) => ({
      ...prev,
      triggers: { ...prev.triggers, [trigger]: value },
    }));
  };

  // Custom Toggle Switch Component - iOS Style
  const ToggleSwitch = ({
    enabled,
    onChange,
    disabled = false,
    label,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
    disabled?: boolean;
    label?: string;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label || (enabled ? "Enabled" : "Disabled")}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!enabled);
      }}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary ${
        disabled
          ? "bg-bg-input cursor-not-allowed opacity-50"
          : enabled
            ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)]"
            : "bg-bg-input border border-border-subtle"
      }`}
    >
      <span
        aria-hidden="true"
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
          enabled ? "translate-x-6" : "translate-x-0.5"
        }`}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-bg-page text-text-primary">
      <div className="max-w-2xl mx-auto px-4 py-6 pb-32 sm:pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-10 h-10 rounded-xl bg-bg-card/80 backdrop-blur-sm border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-card-hover active:scale-95 transition-all duration-200 ease-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-text-primary">Centro de Alertas</h1>
        </div>
        <p className="text-sm text-text-muted mb-8 ml-14">
          Configure seus gatilhos de seguranca on-chain
        </p>

        {/* Notification Channels */}
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Canais de Entrega
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {/* Push Notifications */}
          <div className="p-4 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-cyan-400" />
              </div>
              <ToggleSwitch
                enabled={config.channels.push}
                onChange={(v) => updateChannel("push", v)}
              />
            </div>
            <h3 className="font-medium text-white mb-1">Push</h3>
            <p className="text-xs text-slate-500">Notificacoes no navegador</p>
          </div>

          {/* Telegram */}
          <div className="p-4 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-400" />
              </div>
              <ToggleSwitch
                enabled={config.channels.telegram}
                onChange={(v) => updateChannel("telegram", v)}
                disabled={!telegramConnected}
              />
            </div>
            <h3 className="font-medium text-white mb-1">Telegram</h3>
            {telegramConnected ? (
              <div className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="w-3 h-3" />
                Conectado
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setTelegramConnected(true)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                Conectar Bot
              </button>
            )}
          </div>

          {/* Discord */}
          <div className="p-4 rounded-xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-cyan-500/30 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-indigo-400" />
              </div>
              <ToggleSwitch
                enabled={config.channels.discord}
                onChange={(v) => updateChannel("discord", v)}
                disabled={!discordConnected}
              />
            </div>
            <h3 className="font-medium text-white mb-1">Discord</h3>
            {discordConnected ? (
              <div className="flex items-center gap-1 text-xs text-emerald-400">
                <Check className="w-3 h-3" />
                Conectado
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setDiscordConnected(true)}
                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
              >
                Conectar Webhook
              </button>
            )}
          </div>
        </div>

        {/* Risk Triggers */}
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" />
          Gatilhos de Risco
        </h2>
        <div className="p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 mb-8">
          <div className="space-y-6">
            {/* ShieldScore Drop */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-white">ShieldScore Drop</h3>
                    <p className="text-xs text-slate-500">
                      Notificar se Score cair abaixo do limite
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Modern Slider Container */}
              <div className="px-2">
                {/* Value Display - Shield Shape */}
                <div className="flex flex-col items-center justify-center mb-4 gap-2">
                  {/* Shield SVG Container */}
                  <div className="relative w-20 h-24 flex items-center justify-center">
                    {/* Shield Background */}
                    <svg
                      viewBox="0 0 100 120"
                      className="absolute inset-0 w-full h-full"
                      fill="none"
                    >
                      <defs>
                        <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(6, 182, 212, 0.15)" />
                          <stop offset="100%" stopColor="rgba(59, 130, 246, 0.15)" />
                        </linearGradient>
                        <linearGradient id="shieldBorder" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="rgba(6, 182, 212, 0.5)" />
                          <stop offset="100%" stopColor="rgba(59, 130, 246, 0.5)" />
                        </linearGradient>
                        <filter id="shieldGlow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      {/* Shield Path */}
                      <path
                        d="M50 5 L95 20 L95 55 C95 80 75 100 50 115 C25 100 5 80 5 55 L5 20 Z"
                        fill="url(#shieldGradient)"
                        stroke="url(#shieldBorder)"
                        strokeWidth="2"
                        filter="url(#shieldGlow)"
                      />
                    </svg>
                    {/* Value Text */}
                    <span className="relative text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent z-10">
                      {config.triggers.shieldScoreThreshold}
                    </span>
                  </div>
                  {/* Label - Clean text below shield */}
                  <span className="text-xs text-slate-500 font-medium">
                    Limite minimo
                  </span>
                </div>
                
                {/* Slider Track */}
                <div className="relative h-12 flex items-center">
                  {/* Background Track */}
                  <div className="absolute inset-x-0 h-2 bg-white/5 rounded-full" />
                  
                  {/* Filled Track */}
                  <div
                    className="absolute left-0 h-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.4)] transition-all duration-150"
                    style={{ width: `${config.triggers.shieldScoreThreshold}%` }}
                  />
                  
                  {/* Thumb Button */}
                  <button
                    type="button"
                    className="absolute w-6 h-6 -ml-3 rounded-full bg-white shadow-lg shadow-cyan-500/30 border-2 border-cyan-400 cursor-grab active:cursor-grabbing hover:scale-110 transition-transform z-10 flex items-center justify-center"
                    style={{ left: `${config.triggers.shieldScoreThreshold}%` }}
                  >
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" />
                  </button>
                  
                  {/* Hidden Range Input for Accessibility */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={config.triggers.shieldScoreThreshold}
                    onChange={(e) =>
                      updateTrigger("shieldScoreThreshold", Number(e.target.value))
                    }
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                </div>
                
                {/* Scale Labels */}
                <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
                  <span>0</span>
                  <span className="text-slate-600">25</span>
                  <span className="text-slate-600">50</span>
                  <span className="text-slate-600">75</span>
                  <span>100</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Whale Activity */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                  <Waves className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Whale Activity</h3>
                  <p className="text-xs text-slate-500">
                    Alertas de grandes movimentacoes
                  </p>
                </div>
              </div>
              <ToggleSwitch
                enabled={config.triggers.whaleActivity}
                onChange={(v) => updateTrigger("whaleActivity", v)}
              />
            </div>

            <div className="h-px bg-white/5" />

            {/* Liquidity Drain */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Droplets className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">Liquidity Drain</h3>
                  <p className="text-xs text-slate-500">
                    Remocao repentina de liquidez
                  </p>
                </div>
              </div>
              <ToggleSwitch
                enabled={config.triggers.liquidityDrain}
                onChange={(v) => updateTrigger("liquidityDrain", v)}
              />
            </div>

            <div className="h-px bg-white/5" />

            {/* New Mint Authority */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500/20 to-pink-500/20 flex items-center justify-center">
                  <Coins className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-medium text-white">New Mint Auth</h3>
                  <p className="text-xs text-slate-500">
                    Deteccao de criacao de novos tokens
                  </p>
                </div>
              </div>
              <ToggleSwitch
                enabled={config.triggers.newMintAuth}
                onChange={(v) => updateTrigger("newMintAuth", v)}
              />
            </div>
          </div>
        </div>

        {/* Frequency & Filters */}
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Frequencia e Filtros
        </h2>
        <div className="p-5 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 mb-8">
          <div className="space-y-4">
            {/* Frequency Select */}
            <div>
              <label className="text-sm text-slate-400 mb-2 block">
                Frequencia de Notificacao
              </label>
              <div className="relative">
                <select
                  value={config.frequency}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      frequency: e.target.value as AlertConfig["frequency"],
                    }))
                  }
                  className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white appearance-none cursor-pointer hover:border-cyan-500/30 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all"
                >
                  <option value="immediate" className="bg-slate-900">
                    Imediato
                  </option>
                  <option value="hourly" className="bg-slate-900">
                    Resumo Horario
                  </option>
                  <option value="daily" className="bg-slate-900">
                    Resumo Diario
                  </option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    className="w-4 h-4 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Watchlist Only Filter */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-white">Apenas Watchlist</h3>
                <p className="text-xs text-slate-500">
                  Notificar apenas tokens na minha lista
                </p>
              </div>
              <ToggleSwitch
                enabled={config.watchlistOnly}
                onChange={(v) =>
                  setConfig((prev) => ({ ...prev, watchlistOnly: v }))
                }
              />
            </div>
          </div>
        </div>

        {/* Save Button - Desktop */}
        <div className="hidden sm:block">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="w-full h-14 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-lg shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Salvar Configuracoes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Save Button - Mobile Fixed */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[var(--bg-page)] via-[var(--bg-page)] to-transparent">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="w-full h-14 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-lg shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Salvar Configuracoes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
