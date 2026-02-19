"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { toast } from "@/components/toast";

function shortPk(pk: string) {
  return pk.length > 10 ? pk.slice(0, 4) + "…" + pk.slice(-4) : pk;
}

function useIsDebug() {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("debug") === "1";
}

export function ConnectWalletButton() {
  const { connected, publicKey, disconnect, select, connect, wallets } =
    useWallet();
  const { setVisible } = useWalletModal();
  const [lastError, setLastError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const isDebug = useIsDebug();

  const isAndroid =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  const mobileWallet = useMemo(
    () => wallets.find((w) => /Mobile/i.test(w.adapter.name)),
    [wallets]
  );

  const label = useMemo(() => {
    try {
      return publicKey ? shortPk(publicKey.toBase58()) : "";
    } catch {
      return "";
    }
  }, [publicKey]);

  const handleConnect = async () => {
    setLastError(null);
    if (isAndroid && mobileWallet) {
      setConnecting(true);
      try {
        select(mobileWallet.adapter.name);
        await connect();
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Erro ao conectar carteira";
        setLastError(msg);
        toast({
          title: "Erro ao conectar",
          description: msg,
          variant: "destructive",
        });
      } finally {
        setConnecting(false);
      }
    } else {
      setVisible(true);
    }
  };

  if (connected) {
    return (
      <Button
        type="button"
        onClick={() => {
          void disconnect().catch(() => {});
        }}
        aria-label="Disconnect wallet"
      >
        Disconnect {label}
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        aria-label="Connect wallet"
      >
        {connecting ? "Conectando…" : "Connect Wallet"}
      </Button>
      {isDebug && lastError && (
        <span className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate">
          {lastError}
        </span>
      )}
    </span>
  );
}
