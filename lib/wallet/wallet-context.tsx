"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  connectionError: string | null;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  clearError: () => void;
  signAndSendTransaction: (transaction: any) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

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

  const connect = async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;

    setConnecting(true);
    setConnectionError(null);
    
    try {
      // Check if Phantom wallet is available
      const { solana } = window as any;
      
      if (solana?.isPhantom) {
        const response = await solana.connect();
        const pubKey = response.publicKey.toString();
        
        setPublicKey(pubKey);
        setConnected(true);
        localStorage.setItem("wallet_public_key", pubKey);
        setConnectionError(null);
        return true;
      } else {
        const errorMsg = "Phantom wallet not installed. Opening Phantom website...";
        setConnectionError(errorMsg);
        // Open Phantom website to install
        window.open("https://phantom.app/", "_blank");
        return false;
      }
    } catch (error: any) {
      const errorMsg = error?.message === "User rejected the request." 
        ? "Wallet connection cancelled. Please try again."
        : `Connection failed: ${error?.message || "Unknown error"}`;
      
      setConnectionError(errorMsg);
      console.error("[v0] Wallet connection error:", error);
      return false;
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    setPublicKey(null);
    setConnected(false);
    setConnectionError(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("wallet_public_key");
    }
  };

  const clearError = () => {
    setConnectionError(null);
  };

  const signAndSendTransaction = async (transaction: any): Promise<string> => {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    const { solana } = window as any;
    
    if (!solana?.isPhantom) {
      throw new Error("Phantom wallet not found");
    }

    if (!connected) {
      throw new Error("Wallet not connected");
    }

    try {
      console.log("[v0] Sending transaction via Phantom...");
      
      // Import Solana web3 Connection for confirmation
      const { Connection } = await import("@solana/web3.js");
      const connection = new Connection("https://api.mainnet-beta.solana.com");
      
      // Get the latest blockhash and set it on the transaction
      const { blockhash } = await connection.getLatestBlockhash("finalized");
      transaction.message.recentBlockhash = blockhash;
      
      console.log("[v0] Signing and sending transaction...");
      
      // Use Phantom's signAndSendTransaction directly with the VersionedTransaction
      const { signature } = await solana.signAndSendTransaction(transaction);
      
      console.log("[v0] Transaction sent:", signature);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");
      
      console.log("[v0] Transaction confirmed");
      return signature;
    } catch (error: any) {
      console.error("[v0] Transaction error:", error.message || error);
      throw error;
    }
  };

  return (
    <WalletContext.Provider
      value={{
        connected,
        connecting,
        publicKey,
        connectionError,
        connect,
        disconnect,
        clearError,
        signAndSendTransaction,
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
