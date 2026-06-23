import React from "react";
import { Sparkles } from "lucide-react";

interface ReportProgressViewProps {
  stages: Array<{ label: string; detail: string }>;
  currentStageIndex: number;
}

export default function ReportProgressView({ stages, currentStageIndex }: ReportProgressViewProps) {
  return (
    <div className="flex flex-col gap-6 px-5 py-8 font-sans items-center justify-center min-h-[440px] text-ink">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="relative flex items-center justify-center">
          <span className="absolute animate-ping inline-flex h-12 w-12 rounded-full bg-marigold opacity-20"></span>
          <div className="w-16 h-16 rounded-full bg-paper border border-hairline flex items-center justify-center text-marigold relative shadow-sm select-none">
            <Sparkles className="w-7 h-7 animate-pulse text-marigold" />
          </div>
        </div>
        <p className="text-xs font-display font-bold uppercase tracking-wider text-ink mt-2">AI Diagnostic Core Active</p>
        <p className="text-[9px] text-slate font-mono uppercase tracking-widest font-semibold">Running telemetry scan...</p>
      </div>

      {/* Progress Timeline Checklist */}
      <div className="w-full max-w-sm flex flex-col gap-3.5 bg-white border border-hairline p-4 rounded-2xl shadow-2xs">
        {stages.map((stage, idx) => {
          const isCompleted = idx < currentStageIndex;
          const isActive = idx === currentStageIndex;
          return (
            <div 
              key={idx} 
              className={`flex gap-3 items-start transition-opacity duration-200 ${isCompleted || isActive ? "opacity-100" : "opacity-35"}`}
            >
              <div className="mt-0.5 shrink-0">
                {isCompleted ? (
                  <div className="w-4 h-4 rounded-full bg-verify text-white flex items-center justify-center text-[9px] font-mono select-none">
                    ✓
                  </div>
                ) : isActive ? (
                  <div className="w-4 h-4 rounded-full border-2 border-marigold border-t-transparent animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-hairline bg-paper" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[11px] font-bold leading-normal uppercase tracking-tight ${isActive ? "text-marigold" : "text-ink"}`}>
                  {stage.label}
                </p>
                <p className="text-[10px] text-slate mt-0.5 leading-snug font-medium font-sans">
                  {stage.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[9.5px] text-slate font-mono text-center max-w-[240px] italic">
        "Processing offline telemetry securely to protect citizens."
      </p>
    </div>
  );
}
