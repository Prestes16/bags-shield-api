"use client";

import React from "react"

import { forwardRef } from "react";
import { ChevronLeft, Home, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// BACK BUTTON - iOS Style
// ============================================
interface BackButtonProps {
  onClick?: () => void;
  className?: string;
}

export const BackButton = forwardRef<HTMLButtonElement, BackButtonProps>(
  ({ onClick, className }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          "w-10 h-10 rounded-xl bg-bg-card/80 backdrop-blur-sm border border-border-subtle",
          "flex items-center justify-center",
          "text-text-muted hover:text-text-primary",
          "hover:bg-bg-card-hover active:scale-95",
          "transition-all duration-200 ease-out",
          "touch-manipulation",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50",
          className
        )}
        aria-label="Go back"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
    );
  }
);
BackButton.displayName = "BackButton";

// ============================================
// HOME BUTTON - iOS Style
// ============================================
interface HomeButtonProps {
  onClick?: () => void;
  className?: string;
}

export const HomeButton = forwardRef<HTMLButtonElement, HomeButtonProps>(
  ({ onClick, className }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          "w-10 h-10 rounded-xl bg-bg-card/80 backdrop-blur-sm border border-border-subtle",
          "flex items-center justify-center",
          "text-text-muted hover:text-text-primary",
          "hover:bg-bg-card-hover active:scale-95",
          "transition-all duration-200 ease-out",
          "touch-manipulation",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50",
          className
        )}
        aria-label="Go home"
      >
        <Home className="w-5 h-5" />
      </button>
    );
  }
);
HomeButton.displayName = "HomeButton";

// ============================================
// TOGGLE SWITCH - iOS Style
// ============================================
interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: "sm" | "md";
}

export function ToggleSwitch({
  enabled,
  onChange,
  disabled = false,
  label,
  size = "md",
}: ToggleSwitchProps) {
  const sizeClasses = {
    sm: { track: "h-6 w-10", thumb: "h-4 w-4", translate: "translate-x-5" },
    md: { track: "h-7 w-12", thumb: "h-5 w-5", translate: "translate-x-6" },
  };
  const s = sizeClasses[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label || (enabled ? "Enabled" : "Disabled")}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!enabled);
      }}
      className={cn(
        "relative inline-flex flex-shrink-0 items-center rounded-full",
        "transition-colors duration-200 ease-in-out",
        "touch-manipulation cursor-pointer",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary",
        s.track,
        disabled && "opacity-50 cursor-not-allowed",
        enabled
          ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)]"
          : "bg-bg-input border border-border-subtle"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-block rounded-full bg-white shadow-md",
          "transition-transform duration-200 ease-in-out",
          s.thumb,
          enabled ? s.translate : "translate-x-0.5"
        )}
      />
    </button>
  );
}

// ============================================
// SEGMENTED CONTROL - iOS Style
// ============================================
interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  variant?: "default" | "accent";
  fullWidth?: boolean;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  variant = "default",
  fullWidth = true,
}: SegmentedControlProps<T>) {
  const sizeClasses = {
    sm: "h-9 text-xs",
    md: "h-11 text-sm",
  };

  return (
    <div
      className={cn(
        "inline-flex p-1 rounded-xl bg-bg-card border border-border-subtle",
        fullWidth && "w-full"
      )}
    >
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-lg font-medium transition-all duration-200",
              "touch-manipulation",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50",
              sizeClasses[size],
              isSelected
                ? variant === "accent"
                  ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white shadow-sm"
                  : "bg-bg-card-hover text-text-primary shadow-sm border border-border-subtle"
                : "text-text-muted hover:text-text-secondary"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================
// PRIMARY BUTTON - iOS Style with Gradient
// ============================================
interface PrimaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "danger" | "success" | "ghost";
  type?: "button" | "submit";
  className?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  (
    {
      children,
      onClick,
      disabled = false,
      loading = false,
      fullWidth = false,
      size = "md",
      variant = "primary",
      type = "button",
      className,
      icon,
      iconPosition = "left",
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-10 px-4 text-sm rounded-lg gap-1.5",
      md: "h-12 px-5 text-sm rounded-xl gap-2",
      lg: "h-14 px-6 text-base rounded-xl gap-2",
    };

    const variantClasses = {
      primary: cn(
        "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)]",
        "text-white font-semibold",
        "shadow-[0_4px_14px_var(--cyan-glow)]",
        "hover:shadow-[0_6px_20px_var(--cyan-glow)]",
        "active:scale-[0.98]"
      ),
      danger: cn(
        "bg-gradient-to-r from-red-500 to-rose-600",
        "text-white font-semibold",
        "shadow-[0_4px_14px_rgba(239,68,68,0.3)]",
        "hover:shadow-[0_6px_20px_rgba(239,68,68,0.4)]",
        "active:scale-[0.98]"
      ),
      success: cn(
        "bg-gradient-to-r from-emerald-500 to-green-600",
        "text-white font-semibold",
        "shadow-[0_4px_14px_rgba(52,211,153,0.3)]",
        "hover:shadow-[0_6px_20px_rgba(52,211,153,0.4)]",
        "active:scale-[0.98]"
      ),
      ghost: cn(
        "bg-bg-card border border-border-subtle",
        "text-text-primary font-medium",
        "hover:bg-bg-card-hover",
        "active:scale-[0.98]"
      ),
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        onClick={onClick}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center",
          "transition-all duration-200 ease-out",
          "touch-manipulation",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50 focus-visible:ring-offset-2",
          sizeClasses[size],
          variantClasses[variant],
          fullWidth && "w-full",
          isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            {icon && iconPosition === "left" && icon}
            {children}
            {icon && iconPosition === "right" && icon}
          </>
        )}
      </button>
    );
  }
);
PrimaryButton.displayName = "PrimaryButton";

// ============================================
// SECONDARY BUTTON - iOS Style
// ============================================
interface SecondaryButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

export const SecondaryButton = forwardRef<HTMLButtonElement, SecondaryButtonProps>(
  (
    {
      children,
      onClick,
      disabled = false,
      loading = false,
      fullWidth = false,
      size = "md",
      className,
      icon,
      iconPosition = "left",
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "h-10 px-4 text-sm rounded-lg gap-1.5",
      md: "h-12 px-5 text-sm rounded-xl gap-2",
      lg: "h-14 px-6 text-base rounded-xl gap-2",
    };

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center",
          "bg-bg-card border border-border-subtle",
          "text-text-primary font-medium",
          "hover:bg-bg-card-hover hover:border-[var(--cyan-primary)]/30",
          "active:scale-[0.98]",
          "transition-all duration-200 ease-out",
          "touch-manipulation",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50 focus-visible:ring-offset-2",
          sizeClasses[size],
          fullWidth && "w-full",
          isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            {icon && iconPosition === "left" && icon}
            {children}
            {icon && iconPosition === "right" && icon}
          </>
        )}
      </button>
    );
  }
);
SecondaryButton.displayName = "SecondaryButton";

// ============================================
// ICON BUTTON - iOS Style
// ============================================
interface IconButtonProps {
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "solid" | "outline";
  className?: string;
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      onClick,
      disabled = false,
      size = "md",
      variant = "ghost",
      className,
      label,
    },
    ref
  ) => {
    const sizeClasses = {
      sm: "w-8 h-8 rounded-lg",
      md: "w-10 h-10 rounded-xl",
      lg: "w-12 h-12 rounded-xl",
    };

    const variantClasses = {
      ghost: "bg-transparent hover:bg-bg-card text-text-muted hover:text-text-primary",
      solid: "bg-bg-card text-text-primary hover:bg-bg-card-hover",
      outline: "bg-transparent border border-border-subtle text-text-muted hover:text-text-primary hover:bg-bg-card",
    };

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center",
          "transition-all duration-200 ease-out",
          "touch-manipulation",
          "active:scale-95",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50",
          sizeClasses[size],
          variantClasses[variant],
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
      >
        {icon}
      </button>
    );
  }
);
IconButton.displayName = "IconButton";

// ============================================
// QUICK ACTION CHIP - iOS Style
// ============================================
interface QuickChipProps {
  children: React.ReactNode;
  onClick?: () => void;
  selected?: boolean;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function QuickChip({
  children,
  onClick,
  selected = false,
  disabled = false,
  size = "md",
}: QuickChipProps) {
  const sizeClasses = {
    sm: "h-8 px-3 text-xs rounded-lg",
    md: "h-10 px-4 text-sm rounded-xl",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center font-medium",
        "transition-all duration-200 ease-out",
        "touch-manipulation",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50",
        sizeClasses[size],
        selected
          ? "bg-[var(--cyan-primary)]/20 text-[var(--cyan-primary)] border border-[var(--cyan-primary)]/40"
          : "bg-bg-card border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-bg-card-hover",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}
