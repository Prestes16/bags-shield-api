"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ScanLoadingRadarProps {
  mintAddress?: string;
}

const steps = [
  { id: 0, label: "Initializing scan..." },
  { id: 1, label: "Analyzing transaction..." },
  { id: 2, label: "Checking token metadata..." },
  { id: 3, label: "Calculating risk score..." },
  { id: 4, label: "Finalizing results..." },
];

export function ScanLoadingRadar({ mintAddress }: ScanLoadingRadarProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);

  // Simular progresso dos steps a cada 1.5s
  useEffect(() => {
    if (currentStep >= steps.length - 1) {
      // Quando chegar no último passo, redirecionar para Tela 8
      if (mintAddress) {
        router.push(`/scan/result/${mintAddress}`);
      }
      return;
    }

    const timer = setTimeout(() => {
      setCurrentStep((prev) => prev + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [currentStep, mintAddress, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto w-full">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
          {/* Radar/Icon Central */}
          <div className="relative w-48 h-48 mx-auto mb-8">
            {/* Círculos concêntricos (radar effect) */}
            <div className="absolute inset-0 rounded-full border-2 border-blue-200 dark:border-blue-800 animate-pulse"></div>
            <div className="absolute inset-4 rounded-full border-2 border-blue-300 dark:border-blue-700 animate-pulse" style={{ animationDelay: "0.5s" }}></div>
            <div className="absolute inset-8 rounded-full border-2 border-blue-400 dark:border-blue-600 animate-pulse" style={{ animationDelay: "1s" }}></div>
            
            {/* Ícone central */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                {/* Fallback emoji enquanto não tem imagem */}
                <span className="text-4xl">🛡️</span>
                {/* Quando tiver /images/bags-shield-icon.png, descomente:
                <Image
                  src="/images/bags-shield-icon.png"
                  alt="Bags Shield"
                  width={96}
                  height={96}
                  className="rounded-full object-contain"
                  priority
                />
                */}
              </div>
            </div>
          </div>

          {/* Steps Progress */}
          <div className="space-y-3 mb-6">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                  index === currentStep
                    ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500"
                    : index < currentStep
                    ? "bg-green-50 dark:bg-green-900/20 border-2 border-green-500"
                    : "bg-slate-50 dark:bg-slate-700 border-2 border-transparent"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
                    index === currentStep
                      ? "bg-blue-500 text-white animate-pulse"
                      : index < currentStep
                      ? "bg-green-500 text-white"
                      : "bg-slate-300 dark:bg-slate-600 text-slate-500"
                  }`}
                >
                  {index < currentStep ? "✓" : index === currentStep ? "⟳" : step.id + 1}
                </div>
                <span
                  className={`text-sm font-medium ${
                    index === currentStep
                      ? "text-blue-700 dark:text-blue-300"
                      : index < currentStep
                      ? "text-green-700 dark:text-green-300"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Mint Address Display */}
          {mintAddress && (
            <div className="mt-6 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Scanning</p>
              <p className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">
                {mintAddress}
              </p>
            </div>
          )}

          {/* Progress Indicator */}
          <div className="mt-6">
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
