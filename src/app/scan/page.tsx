"use client";

import { ScanInput } from "@/components/scan/ScanInput";

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <ScanInput />
      </div>
    </div>
  );
}
