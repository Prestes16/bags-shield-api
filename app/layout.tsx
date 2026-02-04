import React from "react"
import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { ThemeProvider } from "@/lib/theme/theme-context";
import { WalletProvider } from "@/components/providers/wallet-provider";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./globals.css";

const _inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bags Shield - Token Risk Analysis",
  description:
    "Advanced token security scanner for Solana. Analyze liquidity, authority, holders and more.",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-bg-page min-h-screen transition-colors duration-300">
        <ThemeProvider>
          <WalletProvider>
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </WalletProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
