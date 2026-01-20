"use client";

import { useEffect, useState } from "react";

interface ShieldScoreProps {
  score: number;
  grade: string;
  maxScore?: number;
}

export function ShieldScore({
  score,
  grade,
  maxScore = 100,
}: ShieldScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  const radius = 80;
  const strokeWidth = 6;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate arc - only fills ~270 degrees (3/4 of circle)
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
    <div className="relative flex items-center justify-center w-[200px] h-[200px]">
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        className="transform rotate-[135deg]"
      >
        {/* Background arc */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="#1e3a5f"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference}`}
        />
        {/* Progress arc */}
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="url(#scoreGradient)"
          strokeWidth={strokeWidth}
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
        <span className="text-slate-400 text-xs tracking-wider mb-1">
          ShieldScore
        </span>
        <span className="text-5xl font-bold text-white">
          {animatedScore}
        </span>
        <span className="text-slate-400 text-lg">
          ({grade})
        </span>
      </div>
    </div>
  );
}
