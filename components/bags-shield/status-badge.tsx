"use client";

export type BadgeStatus = "ok" | "attention" | "high" | "info";

interface StatusBadgeProps {
  label: string;
  status: BadgeStatus;
  details?: string;
  onDetailsClick?: () => void;
}

function getStatusConfig(status: BadgeStatus) {
  switch (status) {
    case "ok":
      return {
        bgColor: "bg-emerald-500",
        label: "OK",
      };
    case "attention":
      return {
        bgColor: "bg-amber-500",
        label: "Attention",
      };
    case "high":
      return {
        bgColor: "bg-red-500",
        label: "High",
      };
    case "info":
      return {
        bgColor: "bg-blue-500",
        label: "Info",
      };
    default:
      return {
        bgColor: "bg-slate-500",
        label: "Unknown",
      };
  }
}

export function StatusBadge({
  label,
  status,
  details,
  onDetailsClick,
}: StatusBadgeProps) {
  const config = getStatusConfig(status);

  return (
    <div className="bg-bg-card border border-border-subtle rounded-xl p-3">
      <p className="text-text-primary text-xs font-medium leading-tight mb-2 line-clamp-2 min-h-[2rem]">
        {label}
      </p>
      <div className="flex items-center justify-between gap-1">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold text-white ${config.bgColor}`}
        >
          {config.label}
        </span>
        {details !== undefined && (
          <button
            type="button"
            onClick={onDetailsClick}
            className="text-text-muted text-[10px] hover:text-cyan-400 transition-colors flex-shrink-0"
          >
            {details}
          </button>
        )}
      </div>
    </div>
  );
}
