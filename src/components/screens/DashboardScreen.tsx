"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface BadgeStatus {
  id: string;
  label: string;
  severity: "low" | "medium" | "high";
  active: boolean;
}

interface ScoreData {
  grade: "A" | "B" | "C" | "D" | "E";
  value: number; // 0-100
  badges: BadgeStatus[];
}

export function DashboardScreen() {
  const router = useRouter();
  
  // Estado do Score com dados mockados
  const [scoreData, setScoreData] = useState<ScoreData>({
    grade: "B",
    value: 85,
    badges: [
      { id: "tx_format", label: "Transaction format OK", severity: "low", active: true },
      { id: "precheck", label: "Pre-check passed", severity: "low", active: true },
      { id: "liquidity", label: "Liquidity Locked", severity: "low", active: true },
      { id: "holders", label: "Top Holders 12%", severity: "medium", active: true },
    ],
  });

  const handleNewScan = () => {
    router.push("/scan");
  };

  const handleSimulate = () => {
    router.push("/simulate");
  };

  const handleLaunchpad = () => {
    router.push("/launchpad");
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "text-green-500";
      case "B":
        return "text-blue-500";
      case "C":
        return "text-yellow-500";
      case "D":
        return "text-orange-500";
      case "E":
        return "text-red-500";
      default:
        return "text-gray-500";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low":
        return "bg-green-100 text-green-800 border-green-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "high":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {/* Logo */}
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
                Bags Shield
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Security Gateway for Solana
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleNewScan} variant="default">
              New Scan
            </Button>
            <Button onClick={handleSimulate} variant="outline">
              Simulate
            </Button>
            <Button onClick={handleLaunchpad} variant="outline">
              Launchpad
            </Button>
          </div>
        </header>

        {/* Score Card */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Shield Score
            </h2>
            <div className={`text-4xl font-bold ${getGradeColor(scoreData.grade)}`}>
              {scoreData.grade} {scoreData.value}
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mb-4">
            <div
              className={`h-3 rounded-full transition-all ${
                scoreData.value >= 80
                  ? "bg-green-500"
                  : scoreData.value >= 60
                  ? "bg-blue-500"
                  : scoreData.value >= 40
                  ? "bg-yellow-500"
                  : "bg-red-500"
              }`}
              style={{ width: `${scoreData.value}%` }}
            />
          </div>

          {/* Badges */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            {scoreData.badges.map((badge) => (
              <div
                key={badge.id}
                className={`p-3 rounded-lg border ${
                  badge.active ? getSeverityColor(badge.severity) : "bg-gray-100 text-gray-500 border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{badge.label}</span>
                  {badge.active && (
                    <span className="text-xs">
                      {badge.severity === "low" ? "✓" : badge.severity === "medium" ? "⚠" : "✗"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Recent Activity
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Transaction Scan</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">2 minutes ago</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Safe
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Swap Simulation</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">15 minutes ago</p>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                Warning
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
