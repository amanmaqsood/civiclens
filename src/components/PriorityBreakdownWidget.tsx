import React from "react";
import { Award, Clock, ThumbsUp, Layers, AlertTriangle } from "lucide-react";
import { IssueReport } from "../types";
import { getPriorityBreakdown } from "../services/issues";

interface PriorityBreakdownWidgetProps {
  issue: IssueReport;
}

export default function PriorityBreakdownWidget({ issue }: PriorityBreakdownWidgetProps) {
  const breakdown = getPriorityBreakdown(issue);

  return (
    <div id="priority-breakdown" className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-4 flex flex-col gap-4 shadow-md font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Award className="w-4.5 h-4.5 text-amber-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Deterministic Priority Score</span>
        </div>
        <div className="bg-amber-500/10 text-amber-400 font-mono font-bold text-sm px-2.5 py-0.5 rounded-full border border-amber-500/20">
          Scored: {breakdown.score} pts
        </div>
      </div>

      {/* Factor list */}
      <div className="flex flex-col gap-2.5 text-xs">
        {/* Severity */}
        <div className="flex justify-between items-center text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>AI Severity (Severity × 12)</span>
          </div>
          <span className="font-mono font-bold text-slate-200">
            +{breakdown.severityComponent} <span className="text-slate-500 font-normal">({issue.severity || 1} × 12)</span>
          </span>
        </div>

        {/* Urgency */}
        <div className="flex justify-between items-center text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Urgency Bonus</span>
          </div>
          <span className="font-mono font-bold text-slate-200">
            +{breakdown.urgencyComponent} <span className="text-slate-500 font-normal capitalize">({issue.urgency || "routine"})</span>
          </span>
        </div>

        {/* Age (Hours since reported) */}
        <div className="flex justify-between items-center text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Report Age (hours / 12, max 10)</span>
          </div>
          <span className="font-mono font-bold text-slate-200">
            +{breakdown.timeComponent.toFixed(1)} <span className="text-slate-500 font-normal">({breakdown.hoursSinceReported.toFixed(1)}h)</span>
          </span>
        </div>

        {/* Confirmations */}
        <div className="flex justify-between items-center text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Community Confirmations (Confirms × 3, max 15)</span>
          </div>
          <span className="font-mono font-bold text-emerald-400">
            +{breakdown.confirmComponent} <span className="text-slate-500 font-normal">({issue.confirmCount || 0} confirmations)</span>
          </span>
        </div>

        {/* Duplicate reports */}
        <div className="flex justify-between items-center text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-violet-400" />
            <span>Multi-Report Multiplier (Reports × 4)</span>
          </div>
          <span className="font-mono font-bold text-violet-400">
            +{breakdown.reportComponent} <span className="text-slate-500 font-normal">({issue.reportCount || 1} total reports)</span>
          </span>
        </div>

        {/* Disputes */}
        <div className="flex justify-between items-center text-slate-300">
          <div className="flex items-center gap-2 text-slate-400">
            <ThumbsUp className="w-3.5 h-3.5 rotate-180 text-rose-500" />
            <span>Community Disputes (Disputes × -5)</span>
          </div>
          <span className="font-mono font-bold text-rose-500">
            -{breakdown.disputeComponent} <span className="text-slate-500 font-normal">({issue.disputeCount || 0} disputes)</span>
          </span>
        </div>
      </div>

      {/* Formula visual footer */}
      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-850/50 mt-1">
        <span className="text-[10px] text-slate-500 font-bold block mb-1 uppercase tracking-wider">Formula Baseline</span>
        <code className="text-[9px] text-amber-300/85 block overflow-x-auto whitespace-nowrap font-mono">
          Score = (Sev × 12) + Urg_Bonus + min(Age/12, 10) + min(Conf × 3, 15) + (Reps × 4) - (Disp × 5)
        </code>
      </div>
    </div>
  );
}
