"use client";

import { useState } from "react";
import { AlertTriangle, Info, Lock, Unlock, X } from "lucide-react";
import { useLanguage } from "@/lib/i18n/language-context";

type AuthorityType = "mint" | "freeze";
type AuthorityValue = "renounce" | "keep";

interface AuthorityToggleProps {
  type: AuthorityType;
  value: AuthorityValue;
  onChange: (value: AuthorityValue) => void;
  showAdvanced?: boolean;
}

// Confirmation Bottom Sheet
function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-bg-page border-t border-border-subtle rounded-t-2xl p-5 pb-8 animate-slide-up">
        {/* Handle */}
        <div className="w-12 h-1 rounded-full bg-border-subtle mx-auto mb-4" />

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {t.authority.irreversibleTitle}
            </h3>
            <p className="text-sm text-text-muted mt-1">
              {t.authority.irreversibleBody}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-xl font-semibold text-text-primary bg-bg-card border border-border-subtle hover:bg-bg-card-hover transition-all"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="h-12 rounded-xl font-semibold text-white bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 transition-all"
          >
            {t.authority.iUnderstand}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

export function AuthorityToggle({
  type,
  value,
  onChange,
  showAdvanced = false,
}: AuthorityToggleProps) {
  const { t } = useLanguage();
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingValue, setPendingValue] = useState<AuthorityValue | null>(null);

  const Icon = type === "mint" ? Lock : Unlock;
  const title =
    type === "mint" ? t.createToken.mintAuthority : t.createToken.freezeAuthority;
  const description =
    type === "mint"
      ? t.createToken.mintAuthorityDesc
      : t.createToken.freezeAuthorityDesc;

  // Advanced mode risk notes
  const riskNote =
    type === "mint" ? t.authority.mintRiskNote : t.authority.freezeRiskNote;

  const handleSelect = (newValue: AuthorityValue) => {
    if (newValue === "renounce" && value !== "renounce") {
      // Show confirmation before renouncing
      setPendingValue(newValue);
      setShowConfirm(true);
    } else {
      onChange(newValue);
    }
  };

  const handleConfirm = () => {
    if (pendingValue) {
      onChange(pendingValue);
    }
    setShowConfirm(false);
    setPendingValue(null);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setPendingValue(null);
  };

  return (
    <>
      <div className="bg-bg-card rounded-xl p-4 border border-border-subtle">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Icon className="w-5 h-5 text-[var(--cyan-primary)] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-text-primary">{title}</h3>
            <p className="text-xs text-text-muted mt-0.5">{description}</p>
          </div>
        </div>

        {/* Segmented Control */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleSelect("renounce")}
            className={`relative h-11 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              value === "renounce"
                ? "bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500/50 shadow-[0_0_12px_rgba(52,211,153,0.2)]"
                : "bg-bg-input text-text-muted border border-border-subtle hover:border-emerald-500/30"
            }`}
          >
            {value === "renounce" && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">✓</span>
              </div>
            )}
            <span>{t.authority.renounce}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSelect("keep")}
            className={`relative h-11 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              value === "keep"
                ? "bg-amber-500/20 text-amber-400 border-2 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
                : "bg-bg-input text-text-muted border border-border-subtle hover:border-amber-500/30"
            }`}
          >
            {value === "keep" && (
              <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">✓</span>
              </div>
            )}
            <span>{t.authority.keep}</span>
          </button>
        </div>

        {/* Recommended Badge */}
        {value === "renounce" && (
          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {t.authority.recommended}
          </div>
        )}

        {/* Advanced Mode: Risk Note */}
        {showAdvanced && value === "keep" && (
          <div className="mt-3 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300 leading-relaxed">{riskNote}</p>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Sheet */}
      <ConfirmSheet
        open={showConfirm}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        t={t}
      />
    </>
  );
}

// Advanced Mode Toggle Component - iOS Style
export function AdvancedModeToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { t } = useLanguage();

  return (
    <div className="flex items-center justify-between p-3 bg-bg-card/50 rounded-xl border border-border-subtle">
      <div className="flex items-center gap-2">
        <Info className="w-4 h-4 text-text-muted" />
        <span className="text-sm text-text-secondary">
          {t.authority.advancedMode}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t.authority.advancedMode}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out touch-manipulation focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--cyan-primary)]/50 ${
          enabled 
            ? "bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)]" 
            : "bg-bg-input border border-border-subtle"
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
            enabled ? "translate-x-6" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
