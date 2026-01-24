"use client";

export function WatchlistSkeleton() {
  return (
    <div className="min-h-screen bg-[#020617] text-white p-4 md:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="skeleton-glass h-8 w-32 mb-2"></div>
            <div className="skeleton-glass h-4 w-24"></div>
          </div>
          <div className="skeleton-glass w-12 h-12 rounded-full"></div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="skeleton-glass w-12 h-12 rounded-full"></div>
                  <div>
                    <div className="skeleton-glass h-5 w-20 mb-2"></div>
                    <div className="skeleton-glass h-3 w-16"></div>
                  </div>
                </div>
                <div className="skeleton-glass w-12 h-12 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
