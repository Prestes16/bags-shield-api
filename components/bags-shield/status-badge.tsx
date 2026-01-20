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
    <div className="bg-[#0f2744] rounded-xl p-4">
      <p className="text-white text-sm font-medium leading-tight mb-3">
        {label}
      </p>
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold text-white ${config.bgColor}`}
        >
          {config.label}
        </span>
        {details !== undefined && (
          <button
            type="button"
            onClick={onDetailsClick}
            className="text-slate-500 text-xs hover:text-cyan-400 transition-colors"
          >
            Details
          </button>
        )}
      </div>
    </div>
  );
}
