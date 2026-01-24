"use client";

export function SkeletonResult() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 pb-24 md:pb-8">
      {/* Navbar Skeleton */}
      <nav className="sticky top-0 z-10 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="skeleton-glass h-8 w-16"></div>
          <div className="skeleton-glass h-6 w-32"></div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-6">
          {/* Score Skeleton */}
          <div className="text-center mb-6">
            <div className="skeleton-glass h-20 w-32 mx-auto mb-2"></div>
            <div className="skeleton-glass h-4 w-24 mx-auto"></div>
          </div>

          {/* Summary Skeleton */}
          <div className="mb-6 p-4">
            <div className="skeleton-glass h-4 w-full mb-2"></div>
            <div className="skeleton-glass h-4 w-3/4"></div>
          </div>

          {/* Mint Address Skeleton */}
          <div className="mb-6 p-4">
            <div className="skeleton-glass h-3 w-24 mb-2"></div>
            <div className="skeleton-glass h-4 w-full"></div>
          </div>

          {/* Badges Skeleton */}
          <div className="mb-6">
            <div className="skeleton-glass h-5 w-40 mb-3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton-glass h-12 w-full"></div>
              ))}
            </div>
          </div>

          {/* Findings Skeleton */}
          <div className="mb-6">
            <div className="skeleton-glass h-5 w-40 mb-3"></div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-glass h-20 w-full"></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Buttons Skeleton */}
      <div className="fixed bottom-0 left-0 right-0 md:static md:max-w-2xl md:mx-auto md:px-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-700 md:border-t-0 md:bg-transparent md:dark:bg-transparent md:backdrop-blur-none">
        <div className="max-w-2xl mx-auto px-4 py-4 md:py-0 md:px-0">
          <div className="flex gap-3">
            <div className="skeleton-glass h-10 flex-1"></div>
            <div className="skeleton-glass h-10 flex-1"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
