"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { 
  Wallet, 
  Scan, 
  Eye, 
  Bell, 
  Activity,
  Shield,
  Plus,
  Search,
  History,
  Settings,
  Home,
  ArrowUpRight,
  Clock
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"
import { useWallet } from "@/lib/wallet/wallet-context"
import { QuickScanModal } from "./quick-scan-modal"
import { BottomNav } from "@/components/ui/bottom-nav"
import { getScanHistory, type ScanHistoryItem } from "@/lib/scan-history"

// Configuration for money rain particles - enhanced visibility
const moneyParticles = [
  { left: "5%", delay: "0s", duration: "8s", opacity: 0.2 },
  { left: "15%", delay: "1.5s", duration: "10s", opacity: 0.15 },
  { left: "25%", delay: "3s", duration: "7s", opacity: 0.18 },
  { left: "35%", delay: "0.5s", duration: "9s", opacity: 0.12 },
  { left: "45%", delay: "2s", duration: "11s", opacity: 0.2 },
  { left: "55%", delay: "4s", duration: "8s", opacity: 0.15 },
  { left: "65%", delay: "1s", duration: "10s", opacity: 0.18 },
  { left: "75%", delay: "3.5s", duration: "7s", opacity: 0.12 },
  { left: "85%", delay: "2.5s", duration: "9s", opacity: 0.2 },
  { left: "95%", delay: "0s", duration: "11s", opacity: 0.15 },
]

export function HomeScreen() {
  const router = useRouter()
  const { t } = useLanguage()
  const { connected, connecting, publicKey, connect, disconnect } = useWallet()
  const [showScanModal, setShowScanModal] = useState(false)
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([])

  // Load scan history on mount and when modal closes
  useEffect(() => {
    const loadHistory = () => {
      const history = getScanHistory()
      setRecentScans(history.slice(0, 3)) // Show top 3 most recent
    }
    
    loadHistory()
    
    // Refresh every 30 seconds to auto-remove expired scans
    const interval = setInterval(loadHistory, 30000)
    return () => clearInterval(interval)
  }, [])

  // Refresh history when scan modal closes
  useEffect(() => {
    if (!showScanModal) {
      const history = getScanHistory()
      setRecentScans(history.slice(0, 3))
    }
  }, [showScanModal])

  const handleQuickScan = (mint: string) => {
    router.push(`/scan?mint=${encodeURIComponent(mint)}`)
  }

  const handleWalletAction = () => {
    if (connected) {
      disconnect()
    } else {
      connect()
    }
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`
  }

  const quickActions = [
    { icon: Eye, label: t.nav.watchlist, route: "/watchlist", color: "text-[var(--cyan-primary)]" },
    { icon: Bell, label: t.nav.alerts, route: "/alerts", color: "text-amber-400" },
    { icon: Activity, label: t.nav.network, route: "/network", color: "text-emerald-400" },
  ]

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden bg-bg-page">
      {/* Simplified Background Effects - Optimized for mobile */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
        {moneyParticles.slice(0, 6).map((particle, index) => (
          <span
            key={index}
            className="absolute text-cyan-400 text-lg font-bold animate-money-fall will-change-transform"
            style={{
              left: particle.left,
              top: "-20px",
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              opacity: particle.opacity * 0.7,
              textShadow: "0 0 8px rgba(34,211,238,0.4)",
            }}
          >
            $
          </span>
        ))}
      </div>

      {/* Subtle Radar Effect - Optimized */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-30">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full border border-cyan-500/20 animate-radar-pulse will-change-transform" />
          <div className="absolute w-48 h-48 rounded-full border border-cyan-500/10 animate-radar-pulse animation-delay-600 will-change-transform" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 pt-4 pb-20 relative z-10 max-w-md mx-auto w-full">
        {/* Header - Compact Mobile-First */}
        <div className="flex flex-col items-center mb-6">
          <div 
            className="relative w-14 h-14 mb-2"
            style={{
              filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.5))'
            }}
          >
            <Image
              src="/images/bags-shield-icon.png"
              alt="Bags Shield"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-base font-bold text-text-primary tracking-tight">
            Bags Shield
          </h1>
          <p className="text-[9px] text-text-muted mt-0.5 font-medium tracking-widest uppercase">
            Solana Security
          </p>
        </div>

        {/* Main Action Card - Mobile Optimized */}
        <div className="w-full bg-bg-card/90 backdrop-blur-sm border border-border-subtle rounded-2xl p-3.5 shadow-lg mb-4">
          <div className="space-y-2">
            {/* Connect Wallet */}
            <button 
              type="button"
              onClick={handleWalletAction}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 h-11 px-4 bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] hover:opacity-90 active:scale-[0.97] text-white font-semibold rounded-xl transition-all shadow-md text-sm disabled:opacity-50 min-h-[44px] touch-manipulation"
            >
              <Wallet className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {connecting 
                  ? "Conectando..." 
                  : connected && publicKey 
                    ? truncateAddress(publicKey)
                    : t.home.connectWallet}
              </span>
            </button>

            {/* Quick Scan */}
            <button 
              type="button"
              onClick={() => setShowScanModal(true)}
              className="w-full flex items-center justify-center gap-2 h-11 px-4 bg-transparent border-2 border-[var(--cyan-primary)]/40 hover:border-[var(--cyan-primary)] hover:bg-[var(--cyan-primary)]/5 active:scale-[0.97] text-[var(--cyan-primary)] font-semibold rounded-xl transition-all text-sm min-h-[44px] touch-manipulation"
            >
              <Scan className="w-4 h-4 flex-shrink-0" />
              <span>{t.home.quickScan}</span>
            </button>

            {/* Create Token */}
            <button 
              type="button"
              onClick={() => router.push("/create-token")}
              className="w-full flex items-center justify-center gap-2 h-11 px-4 bg-transparent border-2 border-emerald-500/30 hover:border-emerald-400 hover:bg-emerald-500/5 active:scale-[0.97] text-emerald-400 font-semibold rounded-xl transition-all text-sm min-h-[44px] touch-manipulation"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span>{t.home.createToken}</span>
            </button>
          </div>
        </div>

        {/* Quick Actions - Mobile Grid */}
        <div className="w-full grid grid-cols-3 gap-2 mb-3">
          {quickActions.map((action) => (
            <button
              key={action.route}
              type="button"
              onClick={() => router.push(action.route)}
              className="bg-bg-card/70 backdrop-blur-sm border border-border-subtle rounded-xl p-3 flex flex-col items-center gap-1.5 hover:bg-bg-card-hover hover:border-cyan-500/20 active:scale-95 transition-all min-h-[72px] touch-manipulation"
            >
              <action.icon className={`w-5 h-5 flex-shrink-0 ${action.color}`} />
              <span className="text-[10px] text-text-muted font-medium text-center leading-tight">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Status Cards - Compact Mobile */}
        <div className="w-full grid grid-cols-3 gap-2 mb-4">
          {/* API Status */}
          <div className="bg-bg-card/70 backdrop-blur-sm border border-border-subtle rounded-xl p-2 text-center min-h-[60px] flex flex-col justify-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-sm" />
              <span className="text-[8px] text-text-muted font-medium uppercase tracking-wide">Status</span>
            </div>
            <p className="text-[11px] font-bold text-emerald-400">{t.home.online}</p>
          </div>

          {/* Last Scan */}
          <div className="bg-bg-card/70 backdrop-blur-sm border border-border-subtle rounded-xl p-2 text-center min-h-[60px] flex flex-col justify-center">
            <span className="text-[8px] text-text-muted block mb-0.5 font-medium uppercase tracking-wide">Último</span>
            <p className="text-[11px] font-bold text-text-muted">—</p>
          </div>

          {/* Daily Alerts */}
          <div className="bg-bg-card/70 backdrop-blur-sm border border-border-subtle rounded-xl p-2 text-center min-h-[60px] flex flex-col justify-center">
            <span className="text-[8px] text-text-muted block mb-0.5 font-medium uppercase tracking-wide">Alertas</span>
            <p className="text-[11px] font-bold text-text-muted">—</p>
          </div>
        </div>

        {/* Recent Scans - Mobile Optimized */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-text-muted" />
              <h3 className="text-xs font-semibold text-text-primary">Histórico Recente</h3>
              {recentScans.length > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">
                  {recentScans.length}
                </span>
              )}
            </div>
            {recentScans.length > 0 && (
              <button 
                type="button"
                onClick={() => router.push("/history")}
                className="text-[10px] text-[var(--cyan-primary)] hover:opacity-80 font-medium flex items-center gap-0.5 touch-manipulation min-h-[32px] px-2 -mr-2"
              >
                Ver tudo
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <div className="bg-bg-card/70 backdrop-blur-sm border border-border-subtle rounded-xl overflow-hidden">
            {recentScans.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1.5 py-6 text-text-muted">
                <Shield className="w-4 h-4 opacity-40" />
                <span className="text-[11px] font-medium">Nenhum scan recente</span>
                <span className="text-[9px] text-text-muted/50">Histórico expira após 24h</span>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {recentScans.map((scan) => (
                  <button
                    key={scan.mint}
                    type="button"
                    onClick={() => router.push(`/scan?mint=${scan.mint}`)}
                    className="w-full p-2.5 hover:bg-bg-card-hover transition-colors flex items-center justify-between group touch-manipulation min-h-[60px]"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      {/* Score Badge - Compact */}
                      <div 
                        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold border"
                        style={{
                          background: scan.isSafe 
                            ? "linear-gradient(135deg, rgba(34, 211, 153, 0.15), rgba(16, 185, 129, 0.15))"
                            : "linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.15))",
                          borderColor: scan.isSafe ? "rgba(34, 211, 153, 0.25)" : "rgba(239, 68, 68, 0.25)",
                          color: scan.isSafe ? "#22d3b9" : "#ef4444"
                        }}
                      >
                        {scan.score}
                      </div>
                      
                      {/* Token Info - Compact */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold text-text-primary truncate">
                            {scan.tokenName}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-bg-page text-text-muted font-medium flex-shrink-0">
                            {scan.grade}
                          </span>
                        </div>
                        <span className="text-[10px] text-text-muted">${scan.tokenSymbol}</span>
                      </div>
                    </div>
                    
                    {/* Arrow */}
                    <ArrowUpRight className="w-3.5 h-3.5 text-text-muted group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav 
        items={[
          { icon: Home, label: t.nav.home, href: "/" },
          { icon: Search, label: t.nav.search, href: "/search" },
          { icon: History, label: t.nav.history, href: "/history" },
          { icon: Settings, label: t.nav.settings, href: "/settings" },
        ]}
        onSearchClick={() => setShowScanModal(true)}
      />

      {/* Quick Scan Modal */}
      <QuickScanModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        onScan={handleQuickScan}
      />
    </div>
  )
}
