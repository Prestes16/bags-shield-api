"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { Home, Search, History, Settings, Wallet, Scan } from "lucide-react"
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
  { left: "10%", delay: "5s", duration: "8s", opacity: 0.08 },
  { left: "30%", delay: "6s", duration: "10s", opacity: 0.12 },
  { left: "50%", delay: "4.5s", duration: "9s", opacity: 0.1 },
  { left: "70%", delay: "5.5s", duration: "7s", opacity: 0.15 },
  { left: "90%", delay: "3s", duration: "11s", opacity: 0.08 },
]

export function HomeScreen() {
  const router = useRouter()
  const { t } = useLanguage()

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
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-48 h-48 rounded-full border border-cyan-500/10 animate-radar-pulse" />
          <div className="absolute w-72 h-72 rounded-full border border-cyan-500/8 animate-radar-pulse animation-delay-300" />
          <div className="absolute w-96 h-96 rounded-full border border-cyan-500/6 animate-radar-pulse animation-delay-600" />
          <div className="absolute w-[28rem] h-[28rem] rounded-full border border-cyan-500/4 animate-radar-pulse animation-delay-900" />
          <div className="absolute w-[36rem] h-[36rem] rounded-full border border-cyan-500/3 animate-radar-pulse animation-delay-1200" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center px-6 pt-12 pb-24">
        {/* Header with Icon */}
        <div className="flex flex-col items-center mb-8">
          <div 
            className="relative w-24 h-24 sm:w-28 sm:h-28 mb-4"
            style={{
              filter: 'drop-shadow(0 0 15px rgba(34,211,238,0.5)) drop-shadow(0 0 30px rgba(34,211,238,0.25))'
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
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
            Bags Shield
          </h1>
        </div>

        {/* Glassmorphism Main Card */}
        <div className="w-full max-w-sm bg-bg-card backdrop-blur-xl border border-border-subtle rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="space-y-4">
            {/* Connect Wallet Button */}
            <button 
              type="button"
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl transition-all duration-300 shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:shadow-[0_0_30px_rgba(34,211,238,0.5)]"
            >
              <Wallet className="w-5 h-5" />
              <span>{t.home.connectWallet}</span>
            </button>

            {/* Quick Scan Button */}
            <button 
              type="button"
              onClick={() => router.push("/")}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-transparent border-2 border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 font-semibold rounded-xl transition-all duration-300 shadow-[0_0_15px_rgba(34,211,238,0.15)] hover:shadow-[0_0_25px_rgba(34,211,238,0.3)]"
            >
              <Scan className="w-5 h-5" />
              <span>{t.home.quickScan}</span>
            </button>
          </div>
        </div>

        {/* Mini Cards Grid */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-3 mt-6">
          {/* API Status Card */}
          <div className="bg-bg-card backdrop-blur-md border border-border-subtle rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              <span className="text-xs text-text-muted font-medium">{t.home.apiStatus}</span>
            </div>
            <p className="text-sm font-semibold text-emerald-400">{t.home.online}</p>
          </div>

          {/* Last Scan Card */}
          <div className="bg-bg-card backdrop-blur-md border border-border-subtle rounded-xl p-4 text-center">
            <span className="text-xs text-text-muted font-medium block mb-2">{t.home.lastScan}</span>
            <p className="text-sm font-semibold text-text-primary">5m ago</p>
          </div>

          {/* Daily Alerts Card */}
          <div className="bg-bg-card backdrop-blur-md border border-border-subtle rounded-xl p-4 text-center">
            <span className="text-xs text-text-muted font-medium block mb-2">{t.home.dailyAlerts}</span>
            <p className="text-sm font-semibold text-text-muted">0</p>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg-page)]/90 backdrop-blur-lg border-t border-border-subtle">
        <div className="max-w-md mx-auto flex items-center justify-around py-3 px-4">
          <button type="button" className="flex flex-col items-center gap-1 text-cyan-400">
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">{t.nav.home}</span>
          </button>
          <button 
            type="button" 
            onClick={() => router.push("/")}
            className="flex flex-col items-center gap-1 text-text-muted hover:text-text-secondary transition-colors"
          >
            <Search className="w-6 h-6" />
            <span className="text-xs font-medium">{t.nav.search}</span>
          </button>
          <button 
            type="button" 
            onClick={() => router.push("/history")}
            className="flex flex-col items-center gap-1 text-text-muted hover:text-text-secondary transition-colors"
          >
            <History className="w-6 h-6" />
            <span className="text-xs font-medium">{t.nav.history}</span>
          </button>
          <button 
            type="button" 
            onClick={() => router.push("/settings")}
            className="flex flex-col items-center gap-1 text-text-muted hover:text-text-secondary transition-colors"
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs font-medium">{t.nav.settings}</span>
          </button>
        </div>
      </nav>
    </div>
  )
}
