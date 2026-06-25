import React, { useMemo, useState } from "react";
import { IssueReport } from "../types";
import { ArrowLeft, CheckCircle, Copy, Clock, Layers } from "lucide-react";

interface ImpactDashboardProps {
  issues: IssueReport[];
  onBack: () => void;
  hasMoreIssues?: boolean;
  loadedPageSize?: number;
}

type DashboardScope = "real" | "demo";

const categories = ["pothole", "water_leak", "streetlight", "waste", "drainage", "road_damage", "other"];
const statuses = ["Submitted", "Verified", "In Progress", "Resolved"];
const MIN_RATE_DENOMINATOR = 3;

function parseStoredDate(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function formatMetricUnavailable(reason: string) {
  return {
    value: "Not enough data",
    detail: reason,
  };
}

function buildMetrics(issues: IssueReport[]) {
  const totalReported = issues.length;
  const totalResolved = issues.filter((issue) => issue.status === "Resolved").length;
  const resolutionRate = totalReported >= MIN_RATE_DENOMINATOR
    ? {
        value: `${Math.round((totalResolved / totalReported) * 100)}%`,
        detail: "Resolved among loaded records",
      }
    : formatMetricUnavailable(`Need at least ${MIN_RATE_DENOMINATOR} loaded records`);

  const resolutionDurations = issues.flatMap((issue) => {
    const createdAt = parseStoredDate(issue.createdAt || issue.timestamp);
    const resolvedAt = parseStoredDate(issue.resolvedAt);
    if (!createdAt || !resolvedAt || resolvedAt < createdAt) return [];
    return [(resolvedAt - createdAt) / (1000 * 60 * 60 * 24)];
  });
  const avgResolutionTime = resolutionDurations.length > 0
    ? {
        value: `${(resolutionDurations.reduce((sum, days) => sum + days, 0) / resolutionDurations.length).toFixed(1)}d`,
        detail: `${resolutionDurations.length} resolved record${resolutionDurations.length === 1 ? "" : "s"} with stored timestamps`,
      }
    : formatMetricUnavailable("No resolved records with stored created/resolved timestamps");

  const totalDuplicates = issues.reduce((acc, curr) => {
    const count = curr.reportCount || 1;
    return acc + Math.max(0, count - 1);
  }, 0);

  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = issues.filter((issue) => issue.category === cat).length;
    return acc;
  }, {} as Record<string, number>);

  const statusCounts = statuses.reduce((acc, stat) => {
    acc[stat] = issues.filter((issue) => issue.status === stat).length;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalReported,
    totalResolved,
    resolutionRate,
    avgResolutionTime,
    totalDuplicates,
    categoryCounts,
    statusCounts,
  };
}

export default function ImpactDashboard({
  issues,
  onBack,
  hasMoreIssues = false,
  loadedPageSize = 50,
}: ImpactDashboardProps) {
  const [scope, setScope] = useState<DashboardScope>("real");
  const realIssues = useMemo(() => issues.filter((issue) => !issue.isDemoData), [issues]);
  const demoIssues = useMemo(() => issues.filter((issue) => issue.isDemoData), [issues]);
  const scopedIssues = scope === "real" ? realIssues : demoIssues;
  const metrics = useMemo(() => buildMetrics(scopedIssues), [scopedIssues]);
  const maxCategoryCount = Math.max(...Object.values(metrics.categoryCounts), 1);
  const maxStatusCount = Math.max(...Object.values(metrics.statusCounts), 1);

  const scopeOptions: { id: DashboardScope; label: string; count: number }[] = [
    { id: "real", label: "Real records", count: realIssues.length },
    { id: "demo", label: "Synthetic demo", count: demoIssues.length },
  ];

  return (
    <div id="impact-dashboard" className="flex flex-col gap-4 p-4 bg-paper min-h-screen font-sans pb-16 text-ink">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-11 h-11 rounded-full bg-white border border-hairline shadow-2xs cursor-pointer hover:bg-paper transition-all"
          title="Back to Landing"
          aria-label="Back to landing page"
        >
          <ArrowLeft className="w-4 h-4 text-ink" />
        </button>
        <div>
          <span className="text-[9px] font-mono uppercase text-slate tracking-wider block">Prototype impact dashboard</span>
          <h2 className="text-xs font-display font-bold uppercase tracking-wider text-ink">Loaded Incident Ledger</h2>
        </div>
      </div>

      <div className="bg-white border border-hairline rounded-2xl p-3 shadow-xs flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {scopeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setScope(option.id)}
              aria-pressed={scope === option.id}
              className={`min-h-[44px] rounded-xl border px-3 text-xs font-bold ${
                scope === option.id
                  ? "bg-ink text-paper border-ink"
                  : "bg-paper text-slate border-hairline hover:text-ink"
              }`}
            >
              {option.label} ({option.count})
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate leading-relaxed">
          Metrics are computed only from the {scopedIssues.length} {scope === "real" ? "real" : "synthetic demo"} records currently loaded.
          {hasMoreIssues ? ` More records may exist beyond the loaded page of ${loadedPageSize}.` : " The current query reports no additional page."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
        <div className="bg-white p-3.5 rounded-2xl border border-hairline flex flex-col gap-1 shadow-[0_2px_8px_-2px_rgba(14,26,43,0.04)]">
          <div className="flex items-center gap-1 text-slate">
            <Layers className="w-3.5 h-3.5 text-slate shrink-0" />
            <span className="text-[9px] font-mono uppercase tracking-tight">Loaded records</span>
          </div>
          <span className="text-xl font-mono font-bold text-ink leading-tight mt-0.5">{metrics.totalReported}</span>
          <span className="text-[9.5px] text-slate font-medium leading-none">{scope === "demo" ? "Synthetic demo records" : "Non-demo records"}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-hairline flex flex-col gap-1 shadow-[0_2px_8px_-2px_rgba(14,26,43,0.04)]">
          <div className="flex items-center gap-1 text-verify">
            <CheckCircle className="w-3.5 h-3.5 text-verify shrink-0" />
            <span className="text-[9px] font-mono uppercase tracking-tight">Resolved rate</span>
          </div>
          <span className="text-lg font-mono font-bold text-verify leading-tight mt-0.5">{metrics.resolutionRate.value}</span>
          <span className="text-[9.5px] text-slate font-medium leading-tight">{metrics.resolutionRate.detail}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-hairline flex flex-col gap-1 shadow-[0_2px_8px_-2px_rgba(14,26,43,0.04)]">
          <div className="flex items-center gap-1 text-slate">
            <Clock className="w-3.5 h-3.5 text-slate shrink-0" />
            <span className="text-[9px] font-mono uppercase tracking-tight">Resolution time</span>
          </div>
          <span className="text-lg font-mono font-bold text-ink leading-tight mt-0.5">{metrics.avgResolutionTime.value}</span>
          <span className="text-[9.5px] text-slate font-medium leading-tight">{metrics.avgResolutionTime.detail}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-hairline flex flex-col gap-1 shadow-[0_2px_8px_-2px_rgba(14,26,43,0.04)]">
          <div className="flex items-center gap-1 text-marigold">
            <Copy className="w-3.5 h-3.5 text-marigold shrink-0" />
            <span className="text-[9px] font-mono uppercase tracking-tight">Consolidated</span>
          </div>
          <span className="text-xl font-mono font-bold text-ink leading-tight mt-0.5">{metrics.totalDuplicates}</span>
          <span className="text-[9.5px] text-slate font-medium leading-none">Stored duplicate count signals</span>
        </div>
      </div>

      <div className="bg-white border border-hairline rounded-2xl p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] flex flex-col gap-3">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate border-b border-hairline pb-2">Category Distribution</h3>
        <div className="flex flex-col gap-3">
          {categories.map((cat) => {
            const count = metrics.categoryCounts[cat] || 0;
            const pct = count === 0 ? 0 : Math.max(6, Math.round((count / maxCategoryCount) * 100));
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

      <div className="bg-white border border-hairline rounded-2xl p-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] flex flex-col gap-3">
        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate border-b border-hairline pb-2">Status Lifecycles</h3>
        <div className="flex flex-col gap-3">
          {statuses.map((stat) => {
            const count = metrics.statusCounts[stat] || 0;
            const pct = count === 0 ? 0 : Math.max(6, Math.round((count / maxStatusCount) * 100));
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
