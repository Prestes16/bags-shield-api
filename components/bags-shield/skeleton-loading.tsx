"use client";

export function SkeletonLoading() {
  return (
    <div className="min-h-screen bg-bg-page flex flex-col">
      {/* Mobile Status Bar */}
      <div className="flex items-center justify-between px-6 py-2">
        <div className="h-4 w-10 bg-white/10 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
          <div className="h-4 w-4 bg-white/10 rounded animate-pulse" />
          <div className="h-3 w-6 bg-white/10 rounded animate-pulse" />
        </div>
      </div>

      {/* Header Skeleton */}
      <header className="px-5 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/10 animate-pulse" />
        <div className="h-5 w-28 bg-white/10 rounded animate-pulse" />
      </header>

      {/* Main Content */}
      <main className="flex-1 px-5 pb-6 flex flex-col">
        {/* Token Info Skeleton */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full bg-white/10 animate-pulse" />
          <div className="space-y-2">
            <div className="h-7 w-24 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
          </div>
        </div>

        {/* Shield Score Skeleton */}
        <div className="flex justify-center mb-8">
          <div className="relative w-44 h-44">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-4 border-white/5 animate-pulse" />
            {/* Inner content */}
            <div className="absolute inset-4 rounded-full bg-white/5 animate-pulse flex flex-col items-center justify-center">
              <div className="h-3 w-16 bg-white/10 rounded mb-2 animate-pulse" />
              <div className="h-12 w-16 bg-white/10 rounded mb-1 animate-pulse" />
              <div className="h-5 w-8 bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* Status Grid Skeleton */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/5 animate-pulse"
            >
              <div className="h-4 w-3/4 bg-white/10 rounded mb-3" />
              <div className="flex items-center justify-between">
                <div className="h-6 w-12 bg-white/10 rounded-full" />
                <div className="h-4 w-10 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Liquidity Route Skeleton */}
        <div className="bg-white/5 backdrop-blur-sm rounded-xl px-4 py-4 mb-6 border border-white/5 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 bg-white/10 rounded" />
            <div className="h-4 w-12 bg-white/10 rounded" />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Action Buttons Skeleton */}
        <div className="space-y-3">
          <div className="w-full h-14 rounded-xl bg-white/10 animate-pulse" />
          <div className="w-full h-12 rounded-xl bg-white/5 animate-pulse" />
        </div>

        {/* Footer Skeleton */}
        <div className="flex justify-center mt-4">
          <div className="h-3 w-56 bg-white/10 rounded animate-pulse" />
        </div>

        {/* Home Indicator */}
        <div className="flex justify-center mt-4">
          <div className="w-32 h-1 bg-slate-700 rounded-full" />
        </div>
      </main>
    </div>
  );
}
