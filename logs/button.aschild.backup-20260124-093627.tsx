import * as React from "react";

type ClassValue = string | undefined | null | false;

function cn(...v: ClassValue[]) {
  return v.filter(Boolean).join(" ");
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center rounded-xl font-medium transition " +
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 " +
      "disabled:opacity-50 disabled:pointer-events-none";

    const variants: Record<string, string> = {
      default:
        "bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-950 hover:opacity-95 shadow-sm",
      ghost:
        "bg-transparent text-slate-100 hover:bg-white/10",
      outline:
        "bg-transparent border border-white/15 text-slate-100 hover:bg-white/10",
      danger:
        "bg-red-600 text-white hover:bg-red-500",
    };

    const sizes: Record<string, string> = {
      sm: "h-9 px-3 text-sm",
      md: "h-10 px-4 text-sm",
      lg: "h-11 px-5 text-base",
    };

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
export default Button;