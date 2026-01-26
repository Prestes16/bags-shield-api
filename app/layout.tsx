import React from "react"
import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/lib/i18n/language-context";
import { ThemeProvider } from "@/lib/theme/theme-context";
import { WalletProvider } from "@/lib/wallet/wallet-context";
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
      <head>
        {/* Suppress wallet extension errors - must run first */}
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(){window.addEventListener("unhandledrejection",function(e){try{var t=e.reason;if(t&&t.message){var n=String(t.message).toLowerCase();if(n.includes("metamask")||n.includes("wallet")||n.includes("ethereum")||n.includes("connect")||n.includes("provider"))return e.preventDefault(),void(e.stopImmediatePropagation&&e.stopImmediatePropagation())}}catch(e){}},!0)}();`,
          }}
        />
      </head>
      <body className="font-sans antialiased bg-bg-page min-h-screen transition-colors duration-300">
        <ThemeProvider>
          <LanguageProvider>
            <WalletProvider>
              {children}
            </WalletProvider>
          </LanguageProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
