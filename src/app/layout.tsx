import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import WalletProviders from '@/components/solana/WalletProviders';

export const metadata: Metadata = {
  title: 'Bags Shield',
  description: 'Solana Token Intelligence — Scan, Trust Score, Launchpad & Swap.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Bags Shield' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#080811',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <link rel="icon" href="/icons/icon-192.png" />
      </head>
      <body
        style={{
          margin: 0,
          background: '#080811',
          color: '#F0F0FF',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif",
          WebkitFontSmoothing: 'antialiased',
          overscrollBehavior: 'none',
          minHeight: '100dvh',
        }}
      >
        <WalletProviders>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background:
                'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(77,212,255,.07) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 90% 110%, rgba(153,69,255,.08) 0%, transparent 60%), #080811',
              zIndex: 0,
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', zIndex: 1, minHeight: '100dvh' }}>
            {children}
          </div>
        </WalletProviders>
      </body>
    </html>
  );
}
