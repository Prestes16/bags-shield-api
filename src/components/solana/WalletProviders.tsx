"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";

import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";

type Props = { children: React.ReactNode };

const FALLBACK_ORIGIN = "https://app.bagsshield.org";

export default function WalletProviders({ children }: Props) {
  const network = WalletAdapterNetwork.Mainnet;

  const endpoint =
    (process.env.NEXT_PUBLIC_SOLANA_RPC ?? "").trim() ||
    clusterApiUrl("mainnet-beta");

  const wallets = useMemo(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : FALLBACK_ORIGIN;
    const appIdentity = {
      name: "Bags Shield",
      uri: origin,
      icon: `${origin}/icons/icon-192.png`,
    };

    const mobile = new SolanaMobileWalletAdapter({
      appIdentity,
      cluster: network,
      addressSelector: createDefaultAddressSelector(),
      authorizationResultCache: createDefaultAuthorizationResultCache(),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    });

    return [
      mobile,
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network }),
      new BackpackWalletAdapter(),
    ];
  }, []);

  const isAndroid =
    typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={!isAndroid}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

