"use client";

export type ToastInput =
  | string
  | { title?: string; description?: string; variant?: "default" | "destructive" };

export function toast(input: ToastInput) {
  if (typeof window === "undefined") return;

  if (typeof input === "string") {
    console.log("[toast]", input);
    return;
  }

  console.log(
    "[toast]",
    input.title ?? "Toast",
    input.description ?? "",
    input.variant ?? "default"
  );
}

export type ToastProps = {
  message: string;
  isVisible: boolean;
  onClose: () => void;
};

export function Toast({ message, isVisible, onClose }: ToastProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-xl backdrop-blur">
        <div className="text-sm text-slate-100">{message}</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
          aria-label="Close toast"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  return null;
}

export default Toaster;