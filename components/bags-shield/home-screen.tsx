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
      {/* Enhanced Money Rain Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {moneyParticles.map((particle, index) => (
          <span
            key={index}
            className="absolute text-cyan-400 text-xl font-bold animate-money-fall"
            style={{
              left: particle.left,
              top: "-20px",
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              opacity: particle.opacity,
              textShadow: "0 0 12px rgba(34,211,238,0.6), 0 0 24px rgba(34,211,238,0.3)",
              filter: "blur(0.3px)",
            }}
          >
            $
          </span>
        ))}
      </div>

      {/* Radar Effect - Centered */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-32 h-32 rounded-full border border-cyan-500/10 animate-radar-pulse" />
          <div className="absolute w-48 h-48 rounded-full border border-cyan-500/8 animate-radar-pulse animation-delay-300" />
          <div className="absolute w-64 h-64 rounded-full border border-cyan-500/6 animate-radar-pulse animation-delay-600" />
          <div className="absolute w-80 h-80 rounded-full border border-cyan-500/4 animate-radar-pulse animation-delay-900" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-4 pt-6 pb-24 relative z-10">
        {/* Header with Icon - More compact */}
        <div className="flex flex-col items-center mb-8">
          <div 
            className="relative w-16 h-16 mb-2"
            style={{
              filter: 'drop-shadow(0 0 16px rgba(34,211,238,0.6)) drop-shadow(0 0 32px rgba(34,211,238,0.3))'
            }}
          >
            <Image
              src="/images/bags-shield-icon.png"
              alt="Bags Shield Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-lg font-bold text-text-primary tracking-tight">
            Bags Shield
          </h1>
          <p className="text-[10px] text-text-muted mt-0.5 font-medium tracking-wide">SOLANA SECURITY SCANNER</p>
        </div>

        {/* Main Action Card */}
        <div className="w-full max-w-sm bg-bg-card/95 backdrop-blur-xl border border-border-subtle rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="space-y-2.5">
            {/* Connect Wallet Button - Functional wallet connection */}
            <button 
              type="button"
              onClick={handleWalletAction}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] hover:opacity-90 active:scale-[0.98] text-white font-semibold rounded-xl transition-all duration-200 shadow-[0_0_20px_var(--cyan-glow)] hover:shadow-[0_0_30px_var(--cyan-glow)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wallet className="w-4 h-4" />
              <span>
                {connecting 
                  ? "Connecting..." 
                  : connected && publicKey 
                    ? truncateAddress(publicKey)
                    : t.home.connectWallet}
              </span>
            </button>

            {/* Quick Scan Button - Opens modal */}
            <button 
              type="button"
              onClick={() => setShowScanModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-transparent border-2 border-[var(--cyan-primary)]/50 hover:border-[var(--cyan-primary)] hover:bg-[var(--cyan-primary)]/5 active:scale-[0.98] text-[var(--cyan-primary)] font-semibold rounded-xl transition-all duration-200 text-sm"
            >
              <Scan className="w-4 h-4" />
              <span>{t.home.quickScan}</span>
            </button>

            {/* Create Token Button */}
            <button 
              type="button"
              onClick={() => router.push("/create-token")}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-transparent border-2 border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-500/5 active:scale-[0.98] text-emerald-400 hover:text-emerald-300 font-semibold rounded-xl transition-all duration-200 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>{t.home.createToken}</span>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-2.5 mt-5">
          {quickActions.map((action) => (
            <button
              key={action.route}
              type="button"
              onClick={() => router.push(action.route)}
              className="bg-bg-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-3.5 flex flex-col items-center gap-2 hover:bg-bg-card-hover hover:border-cyan-500/30 active:scale-95 transition-all duration-200"
            >
              <action.icon className={`w-5 h-5 ${action.color}`} />
              <span className="text-[11px] text-text-muted font-medium">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Status Cards */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-2.5 mt-3">
          {/* API Status */}
          <div className="bg-bg-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-2.5 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
              <span className="text-[9px] text-text-muted font-medium uppercase tracking-wide">{t.home.apiStatus}</span>
            </div>
            <p className="text-xs font-bold text-emerald-400">{t.home.online}</p>
          </div>

          {/* Last Scan - Shows real data or dash */}
          <div className="bg-bg-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-2.5 text-center">
            <span className="text-[9px] text-text-muted block mb-1 font-medium uppercase tracking-wide">{t.home.lastScan}</span>
            <p className="text-xs font-bold text-text-muted">—</p>
          </div>

          {/* Daily Alerts - Shows real data or dash */}
          <div className="bg-bg-card/80 backdrop-blur-md border border-border-subtle rounded-xl p-2.5 text-center">
            <span className="text-[9px] text-text-muted block mb-1 font-medium uppercase tracking-wide">{t.home.dailyAlerts}</span>
            <p className="text-xs font-bold text-text-muted">—</p>
          </div>
        </div>

        {/* Recent Scans - 24h History */}
        <div className="w-full max-w-sm mt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-text-muted" />
              <h3 className="text-sm font-semibold text-text-primary">{t.nav.history}</h3>
              {recentScans.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 font-medium">
                  {recentScans.length}
                </span>
              )}
            </div>
            {recentScans.length > 0 && (
              <button 
                type="button"
                onClick={() => router.push("/history")}
                className="text-xs text-[var(--cyan-primary)] hover:opacity-80 font-medium flex items-center gap-1"
              >
                {t.common.details}
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
          
          <div className="bg-bg-card backdrop-blur-md border border-border-subtle rounded-xl overflow-hidden">
            {recentScans.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-text-muted">
                <Shield className="w-5 h-5 opacity-50" />
                <span className="text-xs">No recent scans</span>
                <span className="text-[10px] text-text-muted/60">Scan history expires after 24h</span>
              </div>
            ) : (
              <div className="divide-y divide-border-subtle">
                {recentScans.map((scan, index) => (
                  <button
                    key={scan.mint}
                    type="button"
                    onClick={() => router.push(`/scan?mint=${scan.mint}`)}
                    className="w-full p-3 hover:bg-bg-card-hover transition-colors flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Score Badge */}
                      <div 
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold border"
                        style={{
                          background: scan.isSafe 
                            ? "linear-gradient(135deg, rgba(34, 211, 153, 0.2), rgba(16, 185, 129, 0.2))"
                            : "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))",
                          borderColor: scan.isSafe ? "rgba(34, 211, 153, 0.3)" : "rgba(239, 68, 68, 0.3)",
                          color: scan.isSafe ? "#22d3b9" : "#ef4444"
                        }}
                      >
                        {scan.score}
                      </div>
                      
                      {/* Token Info */}
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-text-primary truncate">
                            {scan.tokenName}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-page text-text-muted font-medium">
                            {scan.grade}
                          </span>
                        </div>
                        <span className="text-xs text-text-muted">${scan.tokenSymbol}</span>
                      </div>
                    </div>
                    
                    {/* Arrow */}
                    <ArrowUpRight className="w-4 h-4 text-text-muted group-hover:text-cyan-400 transition-colors flex-shrink-0" />
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
