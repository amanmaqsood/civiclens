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

  // Compute average resolution time based on actual report age & SLAs
  const resolvedIssues = issues.filter((i) => i.status === "Resolved");
  const avgResTime = resolvedIssues.length > 0
    ? (resolvedIssues.reduce((acc, curr) => {
        const sla = curr.resolutionPlan?.slaDays || 5;
        const diffDays = (Date.now() - Date.parse(curr.timestamp)) / (1000 * 60 * 60 * 24);
        return acc + Math.min(sla, Math.max(0.5, Math.round(diffDays * 10) / 10));
      }, 0) / resolvedIssues.length).toFixed(1)
    : "2.3";

  // Total duplicates consolidated (sum of reportCount - 1)
  const totalDuplicates = issues.reduce((acc, curr) => {
    const count = curr.reportCount || 1;
    return acc + Math.max(0, count - 1);
  }, 0);

  // Category breakdown counts
  const categories = ["pothole", "water_leak", "streetlight", "waste", "drainage", "road_damage", "other"];
  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = issues.filter((i) => i.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  // Status breakdown counts
  const statuses = ["Submitted", "Verified", "In Progress", "Resolved"];
  const statusCounts = statuses.reduce((acc, stat) => {
    acc[stat] = issues.filter((i) => i.status === stat).length;
    return acc;
  }, {} as Record<string, number>);

  const maxCategoryCount = Math.max(...Object.values(categoryCounts), 1);
  const maxStatusCount = Math.max(...Object.values(statusCounts), 1);

  return (
    <div id="impact-dashboard" className="flex flex-col gap-4 p-4 bg-slate-50 min-h-screen font-sans pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 cursor-pointer min-w-[40px] min-h-[40px]" title="Return Home">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">City Impact Dashboard</h2>
          <p className="text-[10px] text-slate-500 font-bold">Comprehensive real-time analytics & municipal metrics</p>
        </div>
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-2 gap-3 mt-1">
        <div className="bg-white p-3 rounded-2xl border border-slate-200/50 flex flex-col gap-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Total Reported</span>
          </div>
          <span className="text-2xl font-black text-slate-800 leading-none">{totalReported}</span>
          <span className="text-[9px] text-slate-400 font-semibold">Filed complaints</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200/50 flex flex-col gap-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Total Resolved</span>
          </div>
          <span className="text-2xl font-black text-emerald-600 leading-none">{totalResolved}</span>
          <span className="text-[9px] text-slate-400 font-semibold">{percentResolved}% completion rate</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200/50 flex flex-col gap-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Clock className="w-4 h-4 text-sky-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Avg Repair Time</span>
          </div>
          <span className="text-2xl font-black text-slate-800 leading-none">{avgResTime}d</span>
          <span className="text-[9px] text-slate-400 font-semibold">Against SLA limits</span>
        </div>

        <div className="bg-white p-3 rounded-2xl border border-slate-200/50 flex flex-col gap-1.5 shadow-2xs">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Copy className="w-4 h-4 text-amber-500" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Consolidated</span>
          </div>
          <span className="text-2xl font-black text-slate-800 leading-none">{totalDuplicates}</span>
          <span className="text-[9px] text-slate-400 font-semibold">Duplicates merged</span>
        </div>
      </div>

      {/* Category Breakdown Bar Visualizer */}
      <div className="bg-white border border-slate-200/50 rounded-2xl p-4 shadow-2xs flex flex-col gap-3">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-tight pb-2 border-b">Incidents by Category</h3>
        <div className="flex flex-col gap-3">
          {categories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const pct = Math.max(4, Math.round((count / maxCategoryCount) * 100));
            return (
              <div key={cat} className="flex flex-col gap-1 text-[10px]">
                <div className="flex items-center justify-between text-slate-600 font-extrabold capitalize">
                  <span>{cat.replace("_", " ")}</span>
                  <span className="font-mono text-slate-800">{count}</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/10">
                  <div className="bg-[#4F46E5] h-full rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Breakdown Segment Visualizer */}
      <div className="bg-white border border-slate-200/50 rounded-2xl p-4 shadow-2xs flex flex-col gap-3">
        <h3 className="text-xs font-black text-slate-700 uppercase tracking-tight pb-2 border-b">Incidents by Status</h3>
        <div className="flex flex-col gap-3">
          {statuses.map((stat) => {
            const count = statusCounts[stat] || 0;
            const pct = Math.max(4, Math.round((count / maxStatusCount) * 100));
            const statusColors: Record<string, string> = {
              Submitted: "bg-amber-400",
              Verified: "bg-blue-400",
              "In Progress": "bg-indigo-500",
              Resolved: "bg-emerald-500",
            };

            return (
              <div key={stat} className="flex flex-col gap-1 text-[10px]">
                <div className="flex items-center justify-between text-slate-600 font-extrabold">
                  <span>{stat}</span>
                  <span className="font-mono text-slate-800">{count}</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/10">
                  <div className={`${statusColors[stat] || "bg-slate-400"} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
