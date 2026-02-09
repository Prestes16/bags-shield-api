"use client";

import { ReactNode } from "react";
import { LanguageProvider } from "@/context/LanguageContext";

export function LaunchpadProviders({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>;
}
