"use client";

export function SkeletonList() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="skeleton-glass h-5 w-32 mb-2"></div>
              <div className="skeleton-glass h-4 w-24 mb-2"></div>
              <div className="skeleton-glass h-3 w-16"></div>
            </div>
            <div className="skeleton-glass h-8 w-20 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
