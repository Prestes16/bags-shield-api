"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, RotateCw } from "lucide-react";

interface RateLimitedCardProps {
  initialSeconds?: number;
  onRetry?: () => void;
}

export function RateLimitedCard({
  initialSeconds = 45,
  onRetry,
}: RateLimitedCardProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (seconds <= 0) {
      setIsExpired(true);
      return;
    }

    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  const handleRetry = useCallback(() => {
    if (isExpired && onRetry) {
      onRetry();
    }
  }, [isExpired, onRetry]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        {/* Glassmorphism Card */}
        <div className="relative bg-white/5 backdrop-blur-xl rounded-2xl border border-orange-500/30 p-6 overflow-hidden">
          {/* Glow effect */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Icon */}
            <div className="relative mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/30 to-amber-500/30 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-orange-400" strokeWidth={1.5} />
                </div>
              </div>
              {/* Pulsing ring */}
              <div className="absolute inset-0 rounded-full border-2 border-orange-500/40 animate-ping" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-1">
              Muita calma nessa hora!
            </h2>
            <p className="text-orange-400/80 text-sm font-medium mb-4">
              Traffic Limit (429)
            </p>

            {/* Message */}
            <p className="text-slate-400 text-sm mb-6">
              Estamos com alta demanda. Tente novamente em:
            </p>

            {/* Countdown */}
            <div className="relative mb-6">
              <div className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400 tabular-nums">
                {formatTime(seconds)}
                <span className="text-2xl text-slate-500">s</span>
              </div>
              {/* Progress bar */}
              <div className="mt-3 w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-1000 ease-linear"
                  style={{
                    width: `${(seconds / initialSeconds) * 100}%`,
                  }}
                />
              </div>
            </div>

            {/* Retry Button */}
            <button
              type="button"
              onClick={handleRetry}
              disabled={!isExpired}
              className={`
                w-full py-3.5 px-6 rounded-xl font-semibold text-sm
                flex items-center justify-center gap-2
                transition-all duration-300
                ${
                  isExpired
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 cursor-pointer shadow-lg shadow-orange-500/25"
                    : "bg-white/10 text-slate-500 cursor-not-allowed"
                }
              `}
            >
              <RotateCw
                className={`w-4 h-4 ${isExpired ? "animate-none" : ""}`}
              />
              Tentar Novamente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
