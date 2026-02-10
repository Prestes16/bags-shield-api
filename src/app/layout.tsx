import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';

import type { ReactNode } from "react";

export const metadata = {
  title: "Bags Shield",
  description: "Bags Shield — security & launchpad tools",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui" }}>
        {children}
      </body>
    </html>
  );
}
