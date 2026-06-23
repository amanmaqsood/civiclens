import React from "react";
import { Award } from "lucide-react";
import { IssueReport } from "../types";
import { getPriorityBreakdown } from "../services/issues";

interface PriorityBreakdownWidgetProps {
  issue: IssueReport;
}

export default function PriorityBreakdownWidget({ issue }: PriorityBreakdownWidgetProps) {
  const breakdown = getPriorityBreakdown(issue);

  // SVG parameters for circular lens motif gauge
  const radius = 34;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.min(Math.max((breakdown.score) / 100, 0), 1);
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div 
      id="priority-breakdown" 
      className="bg-white border border-hairline text-ink rounded-2xl p-5 flex flex-col gap-4 shadow-[0_4px_20px_-4px_rgba(14,26,43,0.06)] font-sans"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-marigold" />
          <span className="font-display text-xs font-bold uppercase tracking-tight text-ink">
            Priority Score Gauge
          </span>
        </div>
        <span className="font-mono text-[9px] uppercase text-slate bg-paper px-2 py-0.5 rounded-full border border-hairline">
          Deterministic Math
        </span>
      </div>

      {/* Lens Circular Ring + Side Overview */}
      <div className="flex items-center gap-5 my-0.5">
        <div className="relative flex items-center justify-center w-20 h-20 flex-shrink-0">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            {/* Background ring */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="stroke-hairline fill-none"
              strokeWidth={strokeWidth}
            />
            {/* Real-time active gauge progress */}
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="stroke-marigold fill-none transition-all duration-[600ms] ease-out"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
            <span className="font-display font-[800] text-xl text-ink leading-none">
              {breakdown.score}
            </span>
            <span className="font-mono text-[7px] text-slate uppercase tracking-wider mt-0.5">
              points
            </span>
          </div>
        </div>

        {/* Short, sentence-case summary context */}
        <div className="flex-1 flex flex-col gap-1.5 text-xs">
          <p className="font-sans font-semibold text-ink text-[11.5px] leading-tight">
            Consolidated Case Priority
          </p>
          <p className="text-slate text-[10.5px] leading-snug">
            Calculated autonomously from citizen feedback, proximity deduplication, and regulatory urgency.
          </p>
        </div>
      </div>

      {/* Simplified, low density list with sentence-case labels */}
      <div className="flex flex-col gap-2 text-[11px] border-t border-hairline pt-3">
        {/* Severity */}
        <div className="flex justify-between items-center text-ink/80">
          <span className="text-slate">Base severity weight</span>
          <span className="font-mono text-ink">
            +{breakdown.severityComponent} <span className="text-slate/60 text-[9.5px]">({issue.severity || 1} × 12)</span>
          </span>
        </div>

        {/* Urgency */}
        <div className="flex justify-between items-center text-ink/80">
          <span className="text-slate">Urgent dispatch bonus</span>
          <span className="font-mono text-ink">
            +{breakdown.urgencyComponent} <span className="text-slate/60 text-[9.5px] capitalize">({issue.urgency || "routine"})</span>
          </span>
        </div>

        {/* Age */}
        <div className="flex justify-between items-center text-ink/80">
          <span className="text-slate">Age acceleration rate</span>
          <span className="font-mono text-ink">
            +{breakdown.timeComponent.toFixed(1)} <span className="text-slate/60 text-[9.5px]">({breakdown.hoursSinceReported.toFixed(0)}h log)</span>
          </span>
        </div>

        {/* Confirmations */}
        <div className="flex justify-between items-center text-ink/80">
          <span className="text-slate">Community endorsement</span>
          <span className="font-mono text-verify font-semibold">
            +{breakdown.confirmComponent} <span className="text-slate/60 text-[9.5px] font-normal">({issue.confirmCount || 0} votes)</span>
          </span>
        </div>

        {/* Duplicate reports */}
        <div className="flex justify-between items-center text-ink/80">
          <span className="text-slate">Multi-report duplications</span>
          <span className="font-mono text-ink">
            +{breakdown.reportComponent} <span className="text-slate/60 text-[9.5px]">({issue.reportCount || 1} cases)</span>
          </span>
        </div>

        {/* Disputes */}
        <div className="flex justify-between items-center text-ink/80">
          <span className="text-slate">Disputed report adjustment</span>
          <span className="font-mono text-alert font-semibold">
            -{breakdown.disputeComponent} <span className="text-slate/60 text-[9.5px] font-normal">({issue.disputeCount || 0} flags)</span>
          </span>
        </div>
      </div>

      {/* Formula visual footer */}
      <div className="bg-paper p-2.5 rounded-xl border border-hairline mt-1">
        <span className="text-[8px] text-slate font-bold block mb-0.5 uppercase tracking-wider font-mono">
          Formula Base Configuration
        </span>
        <code className="text-[9px] text-slate font-mono block overflow-x-auto whitespace-nowrap">
          Score = (Sev × 12) + Urg_Bonus + min(Age/12, 10) + min(Conf × 3, 15) + (Reps × 4) - (Disp × 5)
        </code>
      </div>
    </div>
  );
}
