"use client";

import * as React from "react";

export type LoadingOverlayProps = {
  show?: boolean;
  label?: string;
};

export function LoadingOverlay({ show = true, label = "Loading..." }: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur">
      <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-5 py-4 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
          <div className="text-sm text-slate-100">{label}</div>
        </div>
      </div>
    </div>
  );
}

export default LoadingOverlay;