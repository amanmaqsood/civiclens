import React from "react";
import { IssueReport } from "../types";
import { ArrowLeft, CheckCircle, Copy, Clock, Layers } from "lucide-react";

interface ImpactDashboardProps {
  issues: IssueReport[];
  onBack: () => void;
}

export default function ImpactDashboard({ issues, onBack }: ImpactDashboardProps) {
  const totalReported = issues.length;
  const totalResolved = issues.filter((i) => i.status === "Resolved").length;
  const percentResolved = totalReported > 0 ? Math.round((totalResolved / totalReported) * 100) : 0;

  // Compute average resolution time based on persisted report age.
  const resolvedIssues = issues.filter((i) => i.status === "Resolved");
  const avgResTime = resolvedIssues.length > 0
    ? (resolvedIssues.reduce((acc, curr) => {
        const sla = curr.resolutionPlan?.slaDays || 5;
        const diffDays = (Date.now() - Date.parse(curr.timestamp)) / (1000 * 60 * 60 * 24);
        return acc + Math.min(sla, Math.max(0.5, Math.round(diffDays * 10) / 10));
      }, 0) / resolvedIssues.length).toFixed(1)
    : "—";

  // Total duplicates consolidated
  const totalDuplicates = issues.reduce((acc, curr) => {
    const count = curr.reportCount || 1;
    return acc + Math.max(0, count - 1);
  }, 0);

  const categories = ["pothole", "water_leak", "streetlight", "waste", "drainage", "road_damage", "other"];
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = issues.filter((i) => i.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  const statuses = ["Submitted", "Verified", "In Progress", "Resolved"];
  const statusCounts = statuses.reduce((acc, stat) => {
    acc[stat] = issues.filter((i) => i.status === stat).length;
    return acc;
  }, {} as Record<string, number>);

  const maxCategoryCount = Math.max(...Object.values(categoryCounts), 1);
  const maxStatusCount = Math.max(...Object.values(statusCounts), 1);

  return (
    <div id="impact-dashboard" className="flex flex-col gap-4 p-4 bg-paper min-h-screen font-sans pb-16 text-ink">
      {/* Back Header */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onBack} 
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-hairline shadow-2xs cursor-pointer hover:bg-paper transition-all"
          title="Back to Landing"
        >
          <ArrowLeft className="w-4 h-4 text-ink" />
        </button>
        <div>
          <span className="text-[9px] font-mono uppercase text-slate tracking-wider block">Prototype impact dashboard</span>
          <h2 className="text-xs font-display font-bold uppercase tracking-wider text-ink">Incident Impact Ledger</h2>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="bg-white p-3.5 rounded-2xl border border-hairline flex flex-col gap-1 shadow-[0_2px_8px_-2px_rgba(14,26,43,0.04)]">
          <div className="flex items-center gap-1 text-slate">
            <Layers className="w-3.5 h-3.5 text-slate shrink-0" />
            <span className="text-[9px] font-mono uppercase tracking-tight">Reported Cases</span>
          </div>
          <span className="text-xl font-mono font-bold text-ink leading-tight mt-0.5">{totalReported}</span>
          <span className="text-[9.5px] text-slate font-medium leading-none">Registered records</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-hairline flex flex-col gap-1 shadow-[0_2px_8px_-2px_rgba(14,26,43,0.04)]">
          <div className="flex items-center gap-1 text-verify">
            <CheckCircle className="w-3.5 h-3.5 text-verify shrink-0" />
            <span className="text-[9px] font-mono uppercase tracking-tight">Resolved cases</span>
          </div>
          <span className="text-xl font-mono font-bold text-verify leading-tight mt-0.5">{totalResolved}</span>
          <span className="text-[9.5px] text-slate font-medium leading-none">{percentResolved}% fixed</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-hairline flex flex-col gap-1 shadow-[0_2px_8px_-2px_rgba(14,26,43,0.04)]">
          <div className="flex items-center gap-1 text-slate">
            <Clock className="w-3.5 h-3.5 text-slate shrink-0" />
            <span className="text-[9px] font-mono uppercase tracking-tight">Est. resolution time</span>
          </div>
          <span className="text-xl font-mono font-bold text-ink leading-tight mt-0.5">{avgResTime === "—" ? "—" : `${avgResTime}d`}</span>
          <span className="text-[9.5px] text-slate font-medium leading-none">estimated · not official</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-hairline flex flex-col gap-1 shadow-[0_2px_8px_-2px_rgba(14,26,43,0.04)]">
          <div className="flex items-center gap-1 text-marigold">
            <Copy className="w-3.5 h-3.5 text-marigold shrink-0" />
            <span className="text-[9px] font-mono uppercase tracking-tight">Consolidated</span>
          </div>
          <span className="text-xl font-mono font-bold text-ink leading-tight mt-0.5">{totalDuplicates}</span>
          <span className="text-[9.5px] text-slate font-medium leading-none">Merged duplicates</span>
        </div>
      </div>

      {/* Category breakdown bar visualizer */}
      <div className="bg-white border border-hairline rounded-2xl p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] flex flex-col gap-3">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate border-b border-hairline pb-2">Grievance Distribution</h3>
        <div className="flex flex-col gap-3">
          {categories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const pct = Math.max(4, Math.round((count / maxCategoryCount) * 100));
            return (
              <div key={cat} className="flex flex-col gap-1 text-[10px]">
                <div className="flex items-center justify-between text-slate font-semibold uppercase tracking-tight">
                  <span className="text-[9.5px] font-medium text-ink">{cat.replace("_", " ")}</span>
                  <span className="font-mono text-ink text-[10px]">{count}</span>
                </div>
                <div className="w-full bg-paper h-1.5 rounded-full overflow-hidden border border-hairline">
                  <div className="bg-marigold h-full rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status segments matches exact theme specs: Submitted = slate, Verified = marigold, In Progress = #3B82F6, Resolved = verify */}
      <div className="bg-white border border-hairline rounded-2xl p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] flex flex-col gap-3">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate border-b border-hairline pb-2">Status Lifecycles</h3>
        <div className="flex flex-col gap-3">
          {statuses.map((stat) => {
            const count = statusCounts[stat] || 0;
            const pct = Math.max(4, Math.round((count / maxStatusCount) * 100));
            const statusBarColors: Record<string, string> = {
              Submitted: "bg-slate",
              Verified: "bg-marigold",
              "In Progress": "bg-[#3B82F6]",
              Resolved: "bg-verify",
            };

            return (
              <div key={stat} className="flex flex-col gap-1 text-[10px]">
                <div className="flex items-center justify-between text-slate font-semibold uppercase tracking-tight">
                  <span className="text-[9.5px] font-medium text-ink">{stat}</span>
                  <span className="font-mono text-ink text-[10px]">{count}</span>
                </div>
                <div className="w-full bg-paper h-1.5 rounded-full overflow-hidden border border-hairline">
                  <div className={`${statusBarColors[stat] || "bg-slate"} h-full rounded-full transition-all duration-300`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
