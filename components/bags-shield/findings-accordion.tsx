"use client";

import { useState } from "react";
import { ChevronDown, Shield, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type FindingSeverity = "high" | "medium" | "low" | "info";

export interface Finding {
  id: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  details?: string;
}

interface FindingsAccordionProps {
  findings: Finding[];
}

function getSeverityConfig(severity: FindingSeverity) {
  switch (severity) {
    case "high":
      return {
        icon: Shield,
        bgColor: "bg-red-500/20",
        textColor: "text-red-400",
        borderColor: "border-red-500/30",
        label: "HIGH",
      };
    case "medium":
      return {
        icon: AlertTriangle,
        bgColor: "bg-yellow-500/20",
        textColor: "text-yellow-400",
        borderColor: "border-yellow-500/30",
        label: "MEDIUM",
      };
    case "low":
      return {
        icon: Info,
        bgColor: "bg-blue-500/20",
        textColor: "text-blue-400",
        borderColor: "border-blue-500/30",
        label: "LOW",
      };
    case "info":
      return {
        icon: Info,
        bgColor: "bg-slate-500/20",
        textColor: "text-slate-400",
        borderColor: "border-slate-500/30",
        label: "INFO",
      };
  }
}

function FindingItem({ finding }: { finding: Finding }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = getSeverityConfig(finding.severity);
  const Icon = config.icon;

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
      >
        <div
          className={cn(
            "flex items-center justify-center w-16 h-8 rounded-md text-xs font-bold",
            config.bgColor,
            config.textColor,
            "border",
            config.borderColor
          )}
        >
          <Icon className="w-3 h-3 mr-1" />
          {config.label}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white truncate">
            {finding.title}
          </h4>
          <p className="text-xs text-slate-400 truncate">
            {finding.description}
          </p>
        </div>

        <ChevronDown
          className={cn(
            "w-5 h-5 text-slate-400 transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      {isExpanded && finding.details && (
        <div className="px-4 pb-4 border-t border-white/5">
          <div className="mt-3 p-3 bg-slate-900/50 rounded-lg">
            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap overflow-x-auto">
              {finding.details}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function FindingsAccordion({ findings }: FindingsAccordionProps) {
  if (findings.length === 0) {
    return (
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl p-6 text-center">
        <p className="text-slate-400">No critical findings detected</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {findings.map((finding) => (
        <FindingItem key={finding.id} finding={finding} />
      ))}
    </div>
  );
}
