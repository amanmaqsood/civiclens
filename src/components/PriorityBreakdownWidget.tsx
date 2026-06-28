import React from "react";
import { Award } from "lucide-react";
import { IssueReport } from "../types";
import { getPriorityBreakdown } from "../services/issues";
import { humanizeUrgency } from "../utils/humanize";

interface PriorityBreakdownWidgetProps {
  issue: IssueReport;
}

export default function PriorityBreakdownWidget({ issue }: PriorityBreakdownWidgetProps) {
  const breakdown = getPriorityBreakdown(issue);

  const radius = 34;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.min(Math.max(breakdown.score / 100, 0), 1);
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div
      id="priority-breakdown"
      className="flex flex-col gap-4 rounded-2xl border border-hairline bg-white p-5 font-sans text-ink shadow-[0_4px_20px_-4px_rgba(14,26,43,0.06)]"
    >
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-marigold" />
          <span className="font-display text-base font-bold text-ink">Priority score</span>
        </div>
        <span className="rounded-full border border-hairline bg-paper px-2 py-1 font-mono text-sm text-slate">
          Calculated
        </span>
      </div>

      <div className="my-0.5 flex items-center gap-5">
        <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center">
          <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="fill-none stroke-hairline"
              strokeWidth={strokeWidth}
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              className="fill-none stroke-marigold transition-all duration-[600ms] ease-out"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex select-none flex-col items-center justify-center">
            <span className="font-display text-xl font-[800] leading-none text-ink">
              {Math.round(breakdown.score)}
            </span>
            <span className="mt-0.5 font-mono text-sm text-slate">points</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 text-sm">
          <p className="font-sans text-base font-semibold leading-tight text-ink">Case priority score</p>
          <p className="text-sm leading-snug text-slate">
            Calculated from stored severity, report age, community feedback, duplicate count, and disputes in this pilot dataset.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-hairline pt-3 text-sm">
        <div className="flex items-center justify-between text-ink/80">
          <span className="text-slate">Base severity weight</span>
          <span className="font-mono text-xs text-ink">
            +{breakdown.severityComponent} <span className="text-xs text-slate/60">({issue.severity || 1} x 12)</span>
          </span>
        </div>

        <div className="flex items-center justify-between text-ink/80">
          <span className="text-slate">Urgency bonus</span>
          <span className="font-mono text-xs text-ink">
            +{breakdown.urgencyComponent} <span className="text-xs text-slate/60">({humanizeUrgency(issue.urgency)})</span>
          </span>
        </div>

        <div className="flex items-center justify-between text-ink/80">
          <span className="text-slate">Age acceleration rate</span>
          <span className="font-mono text-xs text-ink">
            +{breakdown.timeComponent.toFixed(1)}{" "}
            <span className="text-xs text-slate/60">({breakdown.hoursSinceReported.toFixed(0)}h log)</span>
          </span>
        </div>

        <div className="flex items-center justify-between text-ink/80">
          <span className="text-slate">Community endorsement</span>
          <span className="font-mono text-xs font-semibold text-verify">
            +{breakdown.confirmComponent}{" "}
            <span className="text-xs font-normal text-slate/60">({issue.confirmCount || 0} votes)</span>
          </span>
        </div>

        <div className="flex items-center justify-between text-ink/80">
          <span className="text-slate">Multi-report duplications</span>
          <span className="font-mono text-ink">
            +{breakdown.reportComponent} <span className="text-xs text-slate/60">({issue.reportCount || 1} cases)</span>
          </span>
        </div>

        <div className="flex items-center justify-between text-ink/80">
          <span className="text-slate">Disputed report adjustment</span>
          <span className="font-mono font-semibold text-alert">
            -{breakdown.disputeComponent}{" "}
            <span className="text-xs font-normal text-slate/60">({issue.disputeCount || 0} flags)</span>
          </span>
        </div>
      </div>

      <div className="mt-1 rounded-xl border border-hairline bg-paper p-2.5">
        <span className="mb-0.5 block font-mono text-sm font-bold text-slate">Scoring formula</span>
        <code className="block overflow-x-auto whitespace-nowrap font-mono text-sm text-slate">
          Score = (Sev x 12) + Urg_Bonus + min(Age/12, 10) + min(Conf x 3, 15) + (Reps x 4) - (Disp x 5)
        </code>
      </div>
    </div>
  );
}
