"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { 
  Home, 
  Search, 
  History, 
  Settings, 
  Wallet, 
  Scan, 
  Eye, 
  Bell, 
  Activity,
  Shield
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/language-context"

// Configuration for money rain particles
const moneyParticles = [
  { left: "5%", delay: "0s", duration: "8s", opacity: 0.15 },
  { left: "15%", delay: "1.5s", duration: "10s", opacity: 0.1 },
  { left: "25%", delay: "3s", duration: "7s", opacity: 0.12 },
  { left: "35%", delay: "0.5s", duration: "9s", opacity: 0.08 },
  { left: "45%", delay: "2s", duration: "11s", opacity: 0.15 },
  { left: "55%", delay: "4s", duration: "8s", opacity: 0.1 },
  { left: "65%", delay: "1s", duration: "10s", opacity: 0.12 },
  { left: "75%", delay: "3.5s", duration: "7s", opacity: 0.08 },
  { left: "85%", delay: "2.5s", duration: "9s", opacity: 0.15 },
  { left: "95%", delay: "0s", duration: "11s", opacity: 0.1 },
]

export function HomeScreen() {
  const router = useRouter()
  const { t } = useLanguage()

  const quickActions = [
    { icon: Eye, label: t.nav.watchlist, route: "/watchlist", color: "text-cyan-400" },
    { icon: Bell, label: t.nav.alerts, route: "/alerts", color: "text-amber-400" },
    { icon: Activity, label: t.nav.network, route: "/network", color: "text-emerald-400" },
  ]

  return (
    <div className="relative min-h-screen w-full flex flex-col overflow-hidden bg-bg-page">
      {/* Money Rain Effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {moneyParticles.map((particle, index) => (
          <span
            key={index}
            className="absolute text-cyan-400 text-lg font-bold animate-money-fall"
            style={{
              left: particle.left,
              top: "-20px",
              animationDelay: particle.delay,
              animationDuration: particle.duration,
              opacity: particle.opacity,
              textShadow: "0 0 8px rgba(34,211,238,0.5)",
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
      <main className="flex-1 flex flex-col items-center px-4 pt-8 pb-24 relative z-10">
        {/* Header with Icon */}
        <div className="flex flex-col items-center mb-6">
          <div 
            className="relative w-20 h-20 mb-3"
            style={{
              filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.5)) drop-shadow(0 0 24px rgba(34,211,238,0.25))'
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
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Bags Shield
          </h1>
          <p className="text-xs text-text-muted mt-1">Solana Security Scanner</p>
        </div>

        {/* Main Action Card */}
        <div className="w-full max-w-sm bg-bg-card backdrop-blur-xl border border-border-subtle rounded-2xl p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="space-y-3">
            {/* Connect Wallet Button */}
            <button 
              type="button"
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)] text-sm"
            >
              <Wallet className="w-4 h-4" />
              <span>{t.home.connectWallet}</span>
            </button>

            {/* Quick Scan Button */}
            <button 
              type="button"
              onClick={() => router.push("/scan")}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-transparent border-2 border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 font-semibold rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] hover:shadow-[0_0_25px_rgba(34,211,238,0.3)] text-sm"
            >
              <Scan className="w-4 h-4" />
              <span>{t.home.quickScan}</span>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-2 mt-4">
          {quickActions.map((action) => (
            <button
              key={action.route}
              type="button"
              onClick={() => router.push(action.route)}
              className="bg-bg-card backdrop-blur-md border border-border-subtle rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-bg-card-hover hover:border-cyan-500/30 transition-all"
            >
              <action.icon className={`w-5 h-5 ${action.color}`} />
              <span className="text-xs text-text-muted font-medium">{action.label}</span>
            </button>
          ))}
        </div>

        {/* Status Cards */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-2 mt-4">
          {/* API Status */}
          <div className="bg-bg-card backdrop-blur-md border border-border-subtle rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] text-text-muted">{t.home.apiStatus}</span>
            </div>
            <p className="text-xs font-semibold text-emerald-400">{t.home.online}</p>
          </div>

          {/* Last Scan */}
          <div className="bg-bg-card backdrop-blur-md border border-border-subtle rounded-xl p-3 text-center">
            <span className="text-[10px] text-text-muted block mb-1">{t.home.lastScan}</span>
            <p className="text-xs font-semibold text-text-primary">5m ago</p>
          </div>

          {/* Daily Alerts */}
          <div className="bg-bg-card backdrop-blur-md border border-border-subtle rounded-xl p-3 text-center">
            <span className="text-[10px] text-text-muted block mb-1">{t.home.dailyAlerts}</span>
            <p className="text-xs font-semibold text-text-muted">0</p>
          </div>
        </div>

        {/* Recent Scans Placeholder */}
        <div className="w-full max-w-sm mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text-primary">{t.nav.history}</h3>
            <button 
              type="button"
              onClick={() => router.push("/history")}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              {t.common.details}
            </button>
          </div>
          <div className="bg-bg-card backdrop-blur-md border border-border-subtle rounded-xl p-4">
            <div className="flex items-center justify-center gap-2 text-text-muted">
              <Shield className="w-4 h-4" />
              <span className="text-xs">No recent scans</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-bg-page/95 backdrop-blur-lg border-t border-border-subtle safe-area-inset-bottom">
        <div className="flex items-center justify-around py-2 px-2 max-w-md mx-auto">
          <button type="button" className="flex flex-col items-center gap-0.5 py-1 px-3 text-cyan-400">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t.nav.home}</span>
          </button>
          <button 
            type="button" 
            onClick={() => router.push("/scan")}
            className="flex flex-col items-center gap-0.5 py-1 px-3 text-text-muted hover:text-text-secondary transition-colors"
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t.nav.search}</span>
          </button>
          <button 
            type="button" 
            onClick={() => router.push("/history")}
            className="flex flex-col items-center gap-0.5 py-1 px-3 text-text-muted hover:text-text-secondary transition-colors"
          >
            <History className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t.nav.history}</span>
          </button>
          <button 
            type="button" 
            onClick={() => router.push("/settings")}
            className="flex flex-col items-center gap-0.5 py-1 px-3 text-text-muted hover:text-text-secondary transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t.nav.settings}</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
