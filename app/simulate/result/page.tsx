"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { SimulationResult, type SimulationData } from "@/components/bags-shield/simulation-result";
import Loading from "./loading";

// Example placeholder data - will be replaced with real API data
// TODO: Replace with backendClient.simulate() call
const exampleApproved: SimulationData = {
  status: "approved",
  riskLevel: "low",
  input: { amount: 1.0, token: "SOL" },
  output: { amount: 950000, token: "BONK" },
  priceImpact: 0.08,
  networkFee: 0.00005,
  securityChecks: [
    { id: "honeypot", label: "Honeypot Check", passed: true },
    { id: "tax", label: "Transfer Tax", passed: true, detail: "0%" },
    { id: "liquidity", label: "Liquidity Depth", passed: true, detail: "Sufficient" },
    { id: "ownership", label: "Ownership Renounced", passed: true },
  ],
  reason: "No critical issues detected",
};

const exampleWarning: SimulationData = {
  status: "warning",
  riskLevel: "medium",
  input: { amount: 2.5, token: "SOL" },
  output: { amount: 125000, token: "PEPE" },
  priceImpact: 2.4,
  networkFee: 0.00005,
  securityChecks: [
    { id: "honeypot", label: "Honeypot Check", passed: true },
    { id: "tax", label: "Transfer Tax", passed: true, detail: "1%" },
    { id: "liquidity", label: "Liquidity Depth", passed: false, detail: "Low" },
    { id: "ownership", label: "Ownership Renounced", passed: true },
  ],
  reason: "Low liquidity detected - proceed with caution",
};

const exampleFailed: SimulationData = {
  status: "failed",
  riskLevel: "critical",
  input: { amount: 1.0, token: "SOL" },
  output: { amount: 0, token: "SCAM" },
  priceImpact: 99.9,
  networkFee: 0.00005,
  securityChecks: [
    { id: "honeypot", label: "Honeypot Check", passed: false, detail: "DETECTED" },
    { id: "tax", label: "Transfer Tax", passed: false, detail: "99%" },
    { id: "liquidity", label: "Liquidity Lock", passed: false, detail: "None" },
    { id: "ownership", label: "Ownership Renounced", passed: false },
  ],
  errorMessage: "Token has transfer restrictions that prevent selling.",
  reason: "High transfer tax detected (99%)",
};

function SimulationResultContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") as "approved" | "warning" | "failed" | null;

  // Select data based on status param, default to approved
  let data: SimulationData;
  switch (status) {
    case "warning":
      data = exampleWarning;
      break;
    case "failed":
      data = exampleFailed;
      break;
    default:
      data = exampleApproved;
  }

  return (
    <SimulationResult 
      data={data}
      onRetry={() => {
        // TODO: Integrate with API to retry simulation
        window.location.reload();
      }}
    />
  );
}

export default function SimulationResultPage() {
  return (
    <Suspense fallback={<Loading />}>
      <SimulationResultContent />
    </Suspense>
  );
}
