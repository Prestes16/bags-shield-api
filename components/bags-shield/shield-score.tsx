"use client";

import { useEffect, useState } from "react";

interface ShieldScoreProps {
  score: number;
  grade: string;
  maxScore?: number;
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: { container: 140, radius: 56, stroke: 4, score: "text-3xl", label: "text-[10px]", grade: "text-sm" },
  md: { container: 180, radius: 72, stroke: 5, score: "text-4xl", label: "text-xs", grade: "text-base" },
  lg: { container: 200, radius: 80, stroke: 6, score: "text-5xl", label: "text-xs", grade: "text-lg" },
};

export function ShieldScore({
  score,
  grade,
  maxScore = 100,
  size = "md",
}: ShieldScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const config = sizeConfig[size];

  const circumference = 2 * Math.PI * config.radius;
  const arcLength = circumference * 0.75;
  const progress = (animatedScore / maxScore) * arcLength;

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    const increment = score / steps;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setAnimatedScore(score);
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(increment * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [score]);

  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ width: config.container, height: config.container }}
    >
      <svg
        width={config.container}
        height={config.container}
        viewBox={`0 0 ${config.container} ${config.container}`}
        className="transform rotate-[135deg]"
      >
        {/* Background arc */}
        <circle
          cx={config.container / 2}
          cy={config.container / 2}
          r={config.radius}
          fill="none"
          stroke="#1e3a5f"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        {/* Progress arc */}
        <circle
          cx={config.container / 2}
          cy={config.container / 2}
          r={config.radius}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          className="transition-all duration-1000 ease-out"
          style={{
            filter: "drop-shadow(0 0 8px rgba(34, 211, 238, 0.5))",
          }}
        />
        <defs>
          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-slate-400 ${config.label} tracking-wider mb-0.5`}>
          ShieldScore
        </span>
        <span className={`${config.score} font-bold text-white`}>
          {animatedScore}
        </span>
        <span className={`text-slate-400 ${config.grade}`}>
          ({grade})
        </span>
      </div>
    </div>
  );
}
