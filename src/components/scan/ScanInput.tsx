"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function ScanInput() {
  const router = useRouter();
  
  // Estados de gerenciamento
  const [mintAddress, setMintAddress] = useState<string>("");
  const [isStrict, setIsStrict] = useState<boolean>(false);
  const [isAutoDetect, setIsAutoDetect] = useState<boolean>(false);
  
  // Estado para validação visual
  const [isValid, setIsValid] = useState<boolean | null>(null);

  // Validação básica: Solana mint addresses têm entre 32 e 44 caracteres
  useEffect(() => {
    if (mintAddress.length === 0) {
      setIsValid(null);
    } else if (mintAddress.length >= 32 && mintAddress.length <= 44) {
      setIsValid(true);
    } else {
      setIsValid(false);
    }
  }, [mintAddress]);

  // Ação do botão SCAN NOW
  const handleScanNow = () => {
    // Verificar se o input não está vazio
    if (!mintAddress.trim()) {
      return;
    }

    // Verificar se é válido (opcional - pode permitir mesmo se inválido)
    // if (!isValid) {
    //   return;
    // }

    // Redirecionar para /scan/loading com o mint como parâmetro na URL
    const params = new URLSearchParams({ mint: mintAddress.trim() });
    router.push(`/scan/loading?${params.toString()}`);
  };

  // Classes para borda do input baseado na validação
  const getInputBorderClass = () => {
    if (isValid === null) {
      return "border-slate-300 dark:border-slate-600";
    }
    return isValid
      ? "border-green-500 dark:border-green-400"
      : "border-red-500 dark:border-red-400";
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white dark:bg-slate-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-slate-900 dark:text-slate-100">
        Scan Token
      </h2>

      {/* Input de Mint Address */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Token Mint Address
        </label>
        <input
          type="text"
          value={mintAddress}
          onChange={(e) => setMintAddress(e.target.value)}
          placeholder="Enter Solana token mint address..."
          className={`w-full p-3 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 border-2 transition-colors ${getInputBorderClass()}`}
        />
        {isValid !== null && (
          <p
            className={`mt-2 text-sm ${
              isValid
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {isValid
              ? "✓ Valid mint address format"
              : "⚠ Mint address should be 32-44 characters"}
          </p>
        )}
      </div>

      {/* Toggles */}
      <div className="space-y-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Strict Mode
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enable stricter validation rules
            </p>
          </div>
          <Switch checked={isStrict} onCheckedChange={setIsStrict} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Auto Detect
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automatically detect token information
            </p>
          </div>
          <Switch checked={isAutoDetect} onCheckedChange={setIsAutoDetect} />
        </div>
      </div>

      {/* Botão SCAN NOW */}
      <Button
        onClick={handleScanNow}
        disabled={!mintAddress.trim()}
        className="w-full"
        size="lg"
      >
        SCAN NOW
      </Button>
    </div>
  );
}
