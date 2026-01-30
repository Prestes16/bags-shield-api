"use client"

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { Home, Search, History, Settings, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface NavItem {
  icon: LucideIcon
  label: string
  href: string
}

export interface BottomNavProps {
  items?: NavItem[]
  onSearchClick?: () => void
  className?: string
}

const defaultItems: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Search", href: "/search" },
  { icon: History, label: "History", href: "/history" },
  { icon: Settings, label: "Settings", href: "/settings" },
]

export function BottomNav({ 
  items = defaultItems, 
  onSearchClick,
  className 
}: BottomNavProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleClick = (item: NavItem) => {
    if (item.href === "/search" && onSearchClick) {
      onSearchClick()
    } else {
      router.push(item.href)
    }
  }

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-bg-page/95 backdrop-blur-lg border-t border-border-subtle z-40 pb-safe",
        className
      )}
    >
      <div className="flex items-center justify-around py-3 px-2 max-w-md mx-auto">
        {items.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => handleClick(item)}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2 px-4 active:scale-95 transition-all min-h-[44px]",
                active
                  ? "text-[var(--cyan-primary)]"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
