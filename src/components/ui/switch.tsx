"use client";

import * as React from "react";

type SwitchProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
};

type ClassValue = string | undefined | null | false;
function cn(...v: ClassValue[]) { return v.filter(Boolean).join(" "); }

export function Switch({
  checked,
  defaultChecked,
  disabled,
  onCheckedChange,
  className,
}: SwitchProps) {
  const [inner, setInner] = React.useState<boolean>(defaultChecked ?? false);
  const isControlled = typeof checked === "boolean";
  const value = isControlled ? checked! : inner;

  function set(v: boolean) {
    if (!isControlled) setInner(v);
    onCheckedChange?.(v);
  }

  return (
    <button
      type="button"
      aria-pressed={value}
      disabled={disabled}
      onClick={() => set(!value)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition",
        value ? "bg-cyan-400/90" : "bg-white/15",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow transition",
          value ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}

export default Switch;