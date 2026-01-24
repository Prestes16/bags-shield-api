"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface NetworkMetrics {
  tps: number;
  slotHeight: number;
  ping: number;
  networkHealth: "Operational" | "Congested";
}

export default function NetworkStatusScreen() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<NetworkMetrics>({
    tps: 2500,
    slotHeight: 250000000,
    ping: 150,
    networkHealth: "Operational",
  });

  useEffect(() => {
    // Intervalo para atualizar TPS (variação realista entre 2000-3000)
    const tpsInterval = setInterval(() => {
      setMetrics((prev) => ({
        ...prev,
        tps: Math.floor(Math.random() * 1000) + 2000, // 2000-3000
      }));
    }, 1000); // Atualiza a cada 1 segundo

    // Intervalo para incrementar Slot Height (a cada 400ms)
    const slotInterval = setInterval(() => {
      setMetrics((prev) => ({
        ...prev,
        slotHeight: prev.slotHeight + 1,
      }));
    }, 400);

    // Intervalo para simular ping (variação realista)
    const pingInterval = setInterval(() => {
      setMetrics((prev) => {
        // Ping varia entre 50ms e 1200ms
        const newPing = Math.floor(Math.random() * 1150) + 50;
        
        // Determinar networkHealth baseado no ping
        const newHealth: "Operational" | "Congested" = newPing > 1000 ? "Congested" : "Operational";
        
        return {
          ...prev,
          ping: newPing,
          networkHealth: newHealth,
        };
      });
    }, 2000); // Atualiza ping a cada 2 segundos

    // Cleanup: limpar todos os intervalos quando o componente for desmontado
    return () => {
      clearInterval(tpsInterval);
      clearInterval(slotInterval);
      clearInterval(pingInterval);
    };
  }, []);

  const getHealthColor = (health: string) => {
    return health === "Operational"
      ? "text-green-500 dark:text-green-400"
      : "text-orange-500 dark:text-orange-400";
  };

  const getHealthBgColor = (health: string) => {
    return health === "Operational"
      ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700"
      : "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => router.push("/dashboard")}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Voltar
            </Button>
            <div className="flex items-center gap-4">
              <div className="relative w-12 h-12">
                <Image
                  src="/images/bags-shield-icon.png"
                  alt="Bags Shield Logo"
                  fill
                  className="rounded-lg object-contain"
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
                  Status da Rede
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Telemetria em tempo real da Solana
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Network Health Indicator */}
        <div className={`mb-6 p-6 rounded-lg border-2 ${getHealthBgColor(metrics.networkHealth)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Pulse Indicator com Logo */}
              <div className="relative w-16 h-16">
                {/* Círculos de pulso animados */}
                <div className="absolute inset-0 rounded-full border-2 border-blue-400 dark:border-blue-500 animate-ping opacity-75"></div>
                <div className="absolute inset-2 rounded-full border-2 border-blue-300 dark:border-blue-600 animate-pulse"></div>
                
                {/* Logo central */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-10 h-10">
                    <Image
                      src="/images/bags-shield-icon.png"
                      alt="Bags Shield"
                      fill
                      className="rounded-full object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        if (target.parentElement) {
                          target.parentElement.innerHTML = '<span class="text-2xl">🛡️</span>';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Saúde da Rede
                </h2>
                <p className={`text-lg font-bold ${getHealthColor(metrics.networkHealth)}`}>
                  {metrics.networkHealth}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm text-slate-500 dark:text-slate-400">Ping</p>
              <p className={`text-2xl font-bold ${metrics.ping > 1000 ? "text-orange-500" : "text-green-500"}`}>
                {metrics.ping}ms
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Grid - Responsivo: grid-cols-1 md:grid-cols-3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* TPS Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Transactions Per Second
              </h3>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {metrics.tps.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Atualizado em tempo real
            </p>
          </div>

          {/* Slot Height Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Slot Height
              </h3>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            </div>
            <div className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {metrics.slotHeight.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Incrementando a cada 400ms
            </p>
          </div>

          {/* Network Health Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Status da Rede
              </h3>
              <div
                className={`w-2 h-2 rounded-full ${
                  metrics.networkHealth === "Operational" ? "bg-green-500" : "bg-orange-500"
                } animate-pulse`}
              ></div>
            </div>
            <div className={`text-4xl font-bold mb-2 ${getHealthColor(metrics.networkHealth)}`}>
              {metrics.networkHealth === "Operational" ? "✓" : "⚠"}
            </div>
            <p className={`text-sm font-medium ${getHealthColor(metrics.networkHealth)}`}>
              {metrics.networkHealth === "Operational"
                ? "Rede operacional"
                : "Rede congestionada"}
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Informações da Telemetria
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400 mb-1">Atualização TPS:</p>
              <p className="text-slate-900 dark:text-slate-100 font-medium">A cada 1 segundo</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 mb-1">Atualização Slot:</p>
              <p className="text-slate-900 dark:text-slate-100 font-medium">A cada 400ms</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 mb-1">Atualização Ping:</p>
              <p className="text-slate-900 dark:text-slate-100 font-medium">A cada 2 segundos</p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400 mb-1">Threshold de Congestão:</p>
              <p className="text-slate-900 dark:text-slate-100 font-medium">&gt; 1000ms</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
