"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);

  // Check for existing connection on mount (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("wallet_public_key");
      if (savedKey) {
        setPublicKey(savedKey);
        setConnected(true);
      }
    }
  }, []);

  const connect = async () => {
    if (typeof window === "undefined") return;

    setConnecting(true);
    try {
      // Check if Phantom wallet is available
      const { solana } = window as any;
      
      if (solana?.isPhantom) {
        const response = await solana.connect();
        const pubKey = response.publicKey.toString();
        
        setPublicKey(pubKey);
        setConnected(true);
        localStorage.setItem("wallet_public_key", pubKey);
      } else {
        // Fallback: open Phantom website
        window.open("https://phantom.app/", "_blank");
        throw new Error("Phantom wallet not found");
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setPublicKey(null);
    setConnected(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem("wallet_public_key");
    }
  };

  return (
    <WalletContext.Provider
      value={{
        connected,
        connecting,
        publicKey,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}
