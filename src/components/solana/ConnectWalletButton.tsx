"use client";

import { Button } from "@/components/ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useMemo } from "react";

function shortPk(pk: string) {
  return pk.length > 10 ? (pk.slice(0,4) + "…" + pk.slice(-4)) : pk;
}

export function ConnectWalletButton() {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const label = useMemo(() => {
    try { return publicKey ? shortPk(publicKey.toBase58()) : ""; }
    catch { return ""; }
  }, [publicKey]);

  if (connected) {
    return (
      <Button
        type="button"
        onClick={() => { void disconnect().catch(() => {}); }}
        aria-label="Disconnect wallet"
      >
        Disconnect {label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={() => setVisible(true)}
      aria-label="Connect wallet"
    >
      Connect Wallet
    </Button>
  );
}
