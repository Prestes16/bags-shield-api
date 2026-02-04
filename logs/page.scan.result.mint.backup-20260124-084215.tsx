"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import Image from "next/image";
import { SkeletonResult } from "@/components/states/SkeletonResult";

// Interface TypeScript para o mock de dados da API
interface ScanResultData {
  mint: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  summary: string;
  badges: Array<{
    label: string;
    status: "ok" | "warning" | "error";
    severity?: "low" | "medium" | "high" | "critical";
  }>;
  findings: Array<{
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    description: string;
  }>;
}

interface ApiError {
  status: number;
  message: string;
}

// Mock de dados estruturado (simula resposta da API)
const mockResult: ScanResultData = {
  mint: "8xF...k3a",
  score: 65,
  grade: "C",
  summary: "Risco Moderado devido à concentração de holders.",
  badges: [
    { label: "Liquidity Locked", status: "ok", severity: "low" },
    { label: "Mintable", status: "warning", severity: "medium" },
    { label: "Verified Creator", status: "ok", severity: "low" },
    { label: "High Holder Concentration", status: "warning", severity: "high" },
  ],
  findings: [
    {
      title: "Baleias Concentradas",
      severity: "high",
      description: "Top 10 holders possuem 45% do supply. Isso pode indicar risco de manipulação de preço.",
    },
    {
      title: "Liquidez Moderada",
      severity: "medium",
      description: "Liquidez atual é suficiente para trades pequenos, mas pode ser insuficiente para grandes volumes.",
    },
    {
      title: "Token Mintável",
      severity: "medium",
      description: "O token ainda permite minting, o que pode diluir o valor existente.",
    },
  ],
};

export default function ScanResultPage() {
  const params = useParams();
  const router = useRouter();
  const mint = params.mint as string;
  const [result, setResult] = useState<ScanResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [cooldown]);

  // Toast message auto-hide
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (!mint) {
      router.push("/scan");
      return;
    }

    // Buscar resultado do scan
    const fetchResult = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/scan?mint=${encodeURIComponent(mint)}`);
        
        if (!response.ok) {
          if (response.status === 429) {
            setError({ status: 429, message: "Rate limit excedido" });
            setCooldown(60);
            setIsLoading(false);
            return;
          }
          
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Verificar se a resposta é de sucesso
        if (!data.success) {
          throw new Error(data.error || data.message || "Falha ao processar scan");
        }
        
        // Mapear resposta da API para ScanResultData
        const apiResponse = data.response || data;
        
        // Se a API retornar no formato esperado, usar diretamente
        if (apiResponse.shieldScore !== undefined && apiResponse.grade) {
          setResult({
            mint: mint,
            score: apiResponse.shieldScore,
            grade: apiResponse.grade,
            summary: apiResponse.summary || `Score ${apiResponse.shieldScore} (${apiResponse.grade})`,
            badges: (apiResponse.badges || []).map((badge: any) => ({
              label: badge.label || badge.title || badge.id,
              status: badge.severity === "low" ? "ok" : badge.severity === "high" || badge.severity === "critical" ? "error" : "warning",
              severity: badge.severity || "medium",
            })),
            findings: (apiResponse.findings || apiResponse.warnings || []).map((finding: any) => ({
              title: finding.title || finding.label || "Aviso",
              severity: finding.severity || "medium",
              description: finding.description || finding.message || "",
            })),
          });
        } else {
          // Fallback para mock se a estrutura for diferente
          setResult({
            ...mockResult,
            mint: mint,
          });
        }
      } catch (err: any) {
        console.error("Error fetching scan result:", err);
        setError({
          status: err.status || 500,
          message: err.message || "Falha ao carregar resultado do scan",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchResult();
  }, [mint, router]);

  // Copy to clipboard
  const copyToClipboard = async () => {
    if (!mint) return;
    
    try {
      await navigator.clipboard.writeText(mint);
      setHasCopied(true);
      setToastMessage("Mint copiado!");
      setTimeout(() => {
        setHasCopied(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setToastMessage("Erro ao copiar");
    }
  };

  // Share functionality
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";

    try {
      // precisa ser chamado dentro do onClick
      if (typeof navigator === "undefined") return;

      // Se não tem Web Share, cai pro copy
      if (!("share" in navigator)) {
        await navigator.clipboard.writeText(url);
        setToastMessage("Link copiado!");
        return;
      }

      // Alguns browsers exigem canShare
      const data = { title: "Bags Shield", text: "Scan result", url };
      // @ts-ignore
      if (navigator.canShare && !navigator.canShare(data)) {
        await navigator.clipboard.writeText(url);
        setToastMessage("Link copiado!");
        return;
      }

      // @ts-ignore
      await navigator.share(data);
      setToastMessage("Compartilhado com sucesso!");
    } catch (e: any) {
      // AbortError = usuário cancelou o share; não é "erro"
      if (e?.name === "AbortError") return;

      // NotAllowedError / Permission denied => fallback copy
      try {
        await navigator.clipboard.writeText(url);
        setToastMessage("Share bloqueado, link copiado");
      } catch {
        setToastMessage("Não foi possível compartilhar");
      }
    }
  };

  // Scan Again handler
  const handleScanAgain = () => {
    setResult(null);
    setError(null);
    setCooldown(0);
    router.push("/scan");
  };

  // Loading state com Skeleton
  if (isLoading) {
    return <SkeletonResult />;
  }

  // Rate limit error (429)
  if (error?.status === 429) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 pb-24 md:pb-8">
        {/* Navbar */}
        <nav className="sticky top-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
            <Button
              onClick={() => router.back()}
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
            <div className="flex items-center gap-2 flex-1">
              <div className="relative w-6 h-6">
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
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Rate Limit
              </h1>
            </div>
          </div>
        </nav>

        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Rate Limit Card */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 border-2 border-orange-300 dark:border-orange-700">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-orange-600 dark:text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                Rate Limit Excedido
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Você excedeu o limite de requisições. Por favor, aguarde antes de tentar novamente.
              </p>
              
              {/* Cooldown Timer */}
              {cooldown > 0 && (
                <div className="mb-6">
                  <div className="text-4xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                    {cooldown}s
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Tempo restante até poder escanear novamente
                  </p>
                </div>
              )}
            </div>

            {/* Scan Again Button (desabilitado durante cooldown) */}
            <div className="flex gap-3">
              <Button
                onClick={handleScanAgain}
                disabled={cooldown > 0}
                className="flex-1"
                variant={cooldown > 0 ? "outline" : "default"}
              >
                {cooldown > 0 ? `Aguardar ${cooldown}s` : "Escanear Novamente"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generic error
  if (error || !result) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 max-w-md w-full text-center">
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-4">Erro</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            {error?.message || "Falha ao carregar resultado do scan"}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => router.back()} variant="outline" className="flex-1">
              Voltar
            </Button>
            <Button onClick={handleScanAgain} className="flex-1">
              Escanear Novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-green-50 dark:bg-green-900/20 border-green-300 text-green-800 dark:text-green-200";
      case "medium":
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 text-yellow-800 dark:text-yellow-200";
      case "high":
        return "bg-orange-50 dark:bg-orange-900/20 border-orange-300 text-orange-800 dark:text-orange-200";
      case "critical":
        return "bg-red-50 dark:bg-red-900/20 border-red-300 text-red-800 dark:text-red-200";
      default:
        return "bg-slate-50 dark:bg-slate-700 border-slate-300";
    }
  };

  const getBadgeStatusColor = (status: string) => {
    switch (status) {
      case "ok":
        return "bg-green-50 dark:bg-green-900/20 border-green-300";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300";
      case "error":
        return "bg-red-50 dark:bg-red-900/20 border-red-300";
      default:
        return "bg-slate-50 dark:bg-slate-700 border-slate-300";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 pb-24 md:pb-8">
      {/* Toast Message */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-5">
          {toastMessage}
        </div>
      )}

      {/* Navbar com botão voltar */}
      <nav className="sticky top-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button
            onClick={() => router.back()}
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
          <div className="flex items-center gap-2 flex-1">
            <div className="relative w-6 h-6">
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
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Resultado do Scan
            </h1>
          </div>
          <Button
            onClick={handleShare}
            variant="ghost"
            size="sm"
            className="flex items-center gap-2"
            title="Compartilhar resultado"
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
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span className="hidden sm:inline">Compartilhar</span>
          </Button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          {/* Score Display */}
          <div className="text-center mb-6">
            <div className="text-6xl font-bold text-blue-500 mb-2">
              {result.grade} {result.score}
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-lg">Shield Score</p>
          </div>

          {/* Summary */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {result.summary}
            </p>
          </div>

          {/* Mint Address com Copy Button */}
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Mint Address</p>
              <Button
                onClick={copyToClipboard}
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
              >
                {hasCopied ? (
                  <>
                    <svg
                      className="w-4 h-4 mr-1 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Copiado
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copiar
                  </>
                )}
              </Button>
            </div>
            <p className="font-mono text-sm text-slate-900 dark:text-slate-100 break-all">
              {result.mint}
            </p>
          </div>

          {/* Badges */}
          {result.badges && result.badges.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Indicadores de Risco
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {result.badges.map((badge, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${getBadgeStatusColor(badge.status)}`}
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {badge.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Findings */}
          {result.findings && result.findings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Achados Importantes
              </h3>
              <div className="space-y-3">
                {result.findings.map((finding, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${getSeverityColor(finding.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {finding.severity === "critical" || finding.severity === "high" ? (
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">{finding.title}</h4>
                        <p className="text-xs opacity-90 leading-relaxed">{finding.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barra de botões - fixa no mobile, normal no desktop */}
      <div className="fixed bottom-0 left-0 right-0 md:static md:max-w-2xl md:mx-auto md:px-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 md:border-t-0 md:bg-transparent md:dark:bg-transparent md:backdrop-blur-none">
        <div className="max-w-2xl mx-auto px-4 py-4 md:py-0 md:px-0">
          <div className="flex gap-3 md:flex-row">
            <Button
              onClick={() => router.push(`/simulate/${mint}`)}
              className="flex-1 md:flex-none"
            >
              Simular Trade
            </Button>
            <Button
              onClick={handleShare}
              variant="outline"
              className="flex-1 md:flex-none"
            >
              Share
            </Button>
            <Button
              onClick={handleScanAgain}
              variant="outline"
              className="flex-1 md:flex-none"
            >
              Escanear Novamente
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
