"use client";

import { Button } from "@/components/ui/button";

export function SwapTestButton() {
  // Mantém o import existente sem afetar a UI em produção.
  if (process.env.NEXT_PUBLIC_SHOW_SWAP_TEST !== "1") return null;

  return (
    <Button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("bs:swap-test"))}
      aria-label="Swap test"
    >
      Swap Test
    </Button>
  );
}
