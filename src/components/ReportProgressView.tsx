import React from "react";
import { Check, Sparkles } from "lucide-react";

interface ReportProgressViewProps {
  stages: Array<{ label: string; detail: string }>;
  currentStageIndex: number;
}

export default function ReportProgressView({ stages, currentStageIndex }: ReportProgressViewProps) {
  return (
    <div className="flex min-h-[440px] flex-col items-center justify-center gap-6 px-5 py-8 font-sans text-ink">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="relative flex items-center justify-center">
          <span className="absolute inline-flex h-12 w-12 animate-ping rounded-full bg-marigold opacity-20" />
          <div className="relative flex h-16 w-16 select-none items-center justify-center rounded-full border border-hairline bg-paper text-marigold shadow-sm">
            <Sparkles className="h-7 w-7 animate-pulse text-marigold" />
          </div>
        </div>
        <p className="mt-2 text-xl font-black text-ink">Gemini triage in progress</p>
        <p className="text-sm font-semibold text-slate">Preparing a draft report...</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3.5 rounded-2xl border border-hairline bg-white p-4 shadow-2xs">
        {stages.map((stage, idx) => {
          const isCompleted = idx < currentStageIndex;
          const isActive = idx === currentStageIndex;
          return (
            <div
              key={idx}
              className={`flex items-start gap-3 transition-opacity duration-200 ${isCompleted || isActive ? "opacity-100" : "opacity-35"}`}
            >
              <div className="mt-0.5 shrink-0">
                {isCompleted ? (
                  <div className="flex h-5 w-5 select-none items-center justify-center rounded-full bg-verify text-white">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                ) : isActive ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-marigold border-t-transparent" />
                ) : (
                  <div className="h-5 w-5 rounded-full border border-hairline bg-paper" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-base font-bold leading-normal ${isActive ? "text-marigold" : "text-ink"}`}>
                  {stage.label}
                </p>
                <p className="mt-0.5 text-sm font-medium leading-snug text-slate">
                  {stage.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="max-w-sm text-center text-sm italic text-slate">
        Analyzing report details to categorize and assess.
      </p>
    </div>
  );
}
