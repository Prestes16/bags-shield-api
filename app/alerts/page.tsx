"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import Image from "next/image";
import { Toast } from "@/components/toast";

interface AlertSettings {
  push: boolean;
  telegram: boolean;
  discord: boolean;
  scoreThreshold: number;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alertSettings, setAlertSettings] = useState<AlertSettings>({
    push: false,
    telegram: false,
    discord: false,
    scoreThreshold: 70,
  });

  const [telegramStatus, setTelegramStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [discordStatus, setDiscordStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [showToast, setShowToast] = useState(false);

  // Handler para switches
  const handleSwitchChange = (key: keyof AlertSettings, value: boolean) => {
    setAlertSettings((prev) => ({ ...prev, [key]: value }));

    // Simular conexão para Telegram e Discord
    if (key === "telegram" && value) {
      setTelegramStatus("connecting");
      setTimeout(() => {
        setTelegramStatus("connected");
      }, 1500);
    } else if (key === "telegram" && !value) {
      setTelegramStatus("disconnected");
    }

    if (key === "discord" && value) {
      setDiscordStatus("connecting");
      setTimeout(() => {
        setDiscordStatus("connected");
      }, 1500);
    } else if (key === "discord" && !value) {
      setDiscordStatus("disconnected");
    }
  };

  // Handler para slider
  const handleSliderChange = (value: number) => {
    setAlertSettings((prev) => ({ ...prev, scoreThreshold: value }));
  };

  // Handler para salvar
  const handleSave = () => {
    // Simular persistência
    setShowToast(true);
    
    // Redirecionar após 1.5s
    setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-8">
      <Toast
        message="Configurações sincronizadas com a rede Solana"
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />

      <div className="max-w-2xl mx-auto">
        <Button onClick={() => router.push("/dashboard")} variant="ghost" className="mb-6">
          ← Voltar ao Dashboard
        </Button>

        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          {/* Header com logo */}
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-200 dark:border-slate-700">
            <div className="relative w-12 h-12">
              <Image
                src="/images/bags-shield-icon.png"
                alt="Bags Shield"
                fill
                className="object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  if (target.parentElement) {
                    target.parentElement.innerHTML = "🛡️";
                  }
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Configurações de Alertas
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Configure como você deseja receber notificações
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Push Notifications */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  Notificações Push
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Receba alertas diretamente no navegador
                </p>
              </div>
              <Switch
                checked={alertSettings.push}
                onCheckedChange={(checked) => handleSwitchChange("push", checked)}
              />
            </div>

            {/* Telegram */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Telegram
                  </h3>
                  {telegramStatus === "connecting" && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                      Conectando...
                    </span>
                  )}
                  {telegramStatus === "connected" && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Conectado
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Receba alertas no Telegram
                </p>
              </div>
              <Switch
                checked={alertSettings.telegram}
                onCheckedChange={(checked) => handleSwitchChange("telegram", checked)}
                disabled={telegramStatus === "connecting"}
              />
            </div>

            {/* Discord */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                    Discord
                  </h3>
                  {discordStatus === "connecting" && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">
                      Conectando...
                    </span>
                  )}
                  {discordStatus === "connected" && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Conectado
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Receba alertas no Discord
                </p>
              </div>
              <Switch
                checked={alertSettings.discord}
                onCheckedChange={(checked) => handleSwitchChange("discord", checked)}
                disabled={discordStatus === "connecting"}
              />
            </div>

            {/* Score Threshold Slider */}
            <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div className="mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Threshold de Score
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Alertar quando o score for &lt; {alertSettings.scoreThreshold}
                </p>
              </div>
              <div className="space-y-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={alertSettings.scoreThreshold}
                  onChange={(e) => handleSliderChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>0</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {alertSettings.scoreThreshold}
                  </span>
                  <span>100</span>
                </div>
              </div>
            </div>

            {/* Botão Salvar */}
            <Button onClick={handleSave} className="w-full" size="lg">
              Salvar Configurações
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
