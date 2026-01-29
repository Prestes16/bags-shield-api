"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/lib/i18n/language-context";

export interface ShareData {
  title: string;
  text: string;
  url: string;
}

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  shareData: ShareData;
}

export function ShareSheet({ isOpen, onClose, shareData }: ShareSheetProps) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareData.title,
          text: shareData.text,
          url: shareData.url,
        });
        onClose();
      } catch {
        // User cancelled or share failed, ignore silently
      }
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1500);
    } catch {
      // Copy failed, ignore silently
    }
  };

  const shareViaTwitter = () => {
    const text = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
    onClose();
  };

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
    onClose();
  };

  const shareViaTelegram = () => {
    const text = encodeURIComponent(shareData.text);
    const url = encodeURIComponent(shareData.url);
    window.open(`https://t.me/share/url?url=${url}&text=${text}`, "_blank");
    onClose();
  };

  const shareViaDiscord = () => {
    // Discord doesn't have direct share URL, so copy link with message
    const fullText = `${shareData.text}\n\n${shareData.url}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      onClose();
    }, 2000);
  };

  const shareOptions = [
    {
      id: "twitter",
      label: "X (Twitter)",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
      onClick: shareViaTwitter,
      color: "hover:bg-[#1DA1F2]/10 hover:text-[#1DA1F2]",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      ),
      onClick: shareViaWhatsApp,
      color: "hover:bg-[#25D366]/10 hover:text-[#25D366]",
    },
    {
      id: "telegram",
      label: "Telegram",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
      onClick: shareViaTelegram,
      color: "hover:bg-[#0088CC]/10 hover:text-[#0088CC]",
    },
    {
      id: "discord",
      label: "Discord",
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418Z" />
        </svg>
      ),
      onClick: shareViaDiscord,
      color: "hover:bg-[#5865F2]/10 hover:text-[#5865F2]",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-300">
        <div className="bg-bg-card border-t border-border-subtle rounded-t-3xl shadow-2xl max-w-2xl mx-auto">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-border-subtle rounded-full" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pb-3">
            <h3 className="text-lg font-semibold text-text-primary">
              {t.share?.title || "Share Report"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-bg-card-hover flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Native Share Button (if available) */}
          {navigator.share && (
            <div className="px-5 pb-3">
              <button
                type="button"
                onClick={handleNativeShare}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-[var(--cyan-primary)] to-[var(--cyan-secondary)] text-white text-sm font-semibold shadow-[0_0_16px_var(--cyan-glow)] hover:shadow-[0_0_24px_var(--cyan-glow)] hover:opacity-95 active:scale-98 transition-all"
              >
                {t.share?.shareVia || "Share via..."}
              </button>
            </div>
          )}

          {/* Share Options Grid */}
          <div className="px-5 pb-3">
            <div className="grid grid-cols-4 gap-3">
              {shareOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={option.onClick}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl bg-bg-card border border-border-subtle text-text-muted transition-all ${option.color}`}
                >
                  <div className="w-10 h-10 flex items-center justify-center">
                    {option.icon}
                  </div>
                  <span className="text-xs font-medium text-center line-clamp-1">
                    {option.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Copy Link Button */}
          <div className="px-5 pb-6">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={copied}
              className="w-full h-12 rounded-xl bg-bg-card border border-border-subtle text-text-primary font-medium hover:bg-bg-card-hover active:scale-98 transition-all disabled:opacity-50"
            >
              {copied
                ? t.common?.copied || "Copied!"
                : t.share?.copyLink || "Copy Link"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
