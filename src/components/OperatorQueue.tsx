import React, { useState } from "react";
import { IssueReport } from "../types";
import { ShieldCheck, Eye, RefreshCw, Layers, Database } from "lucide-react";
import { seedDemoIssuesBengaluru, clearDemoIssues } from "../services/issues";
import { humanizeCategory } from "../utils/humanize";
import LifecycleStatusBadge from "./LifecycleStatusBadge";

interface OperatorQueueProps {
  issues: IssueReport[];
  onSelectIssue: (id: string) => void;
  onRefresh: () => void;
  onLoadMore?: () => void;
  loading: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  accessMode: "demo" | "real";
  selectedIssueId?: string | null;
  embedded?: boolean;
}

export default function OperatorQueue({
  issues,
  onSelectIssue,
  onRefresh,
  onLoadMore,
  loading,
  hasMore = false,
  loadingMore = false,
  accessMode,
  selectedIssueId,
  embedded = false,
}: OperatorQueueProps) {
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [seedError, setSeedError] = useState("");

  const handleLoadDemo = async () => {
    setSeeding(true);
    setSeedError("");
    try {
      await seedDemoIssuesBengaluru();
      onRefresh();
    } catch (err: any) {
      setSeedError(err.message || "Failed to seed.");
    } finally {
      setSeeding(false);
    }
  };

  const handleClearDemo = async () => {
    setClearing(true);
    setSeedError("");
    try {
      await clearDemoIssues();
      onRefresh();
    } catch (err: any) {
      setSeedError(err.message || "Failed to clear demo data.");
    } finally {
      setClearing(false);
    }
  };

  const sortedIssues = [...issues].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  const rootClassName = embedded
    ? "flex flex-col gap-4 p-4 sm:p-5 lg:p-6 font-sans bg-paper min-h-full text-ink"
    : "flex flex-col gap-4 p-4 sm:p-6 lg:p-8 font-sans bg-paper min-h-screen text-ink";

  return (
    <div id="operator-queue-container" className={rootClassName}>
      {/* Prototype operator header */}
      <div className="bg-ink text-paper p-4.5 rounded-2xl shadow-xs border border-white/5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-marigold" />
          <h2 className="text-[13px] font-display font-semibold uppercase tracking-wider text-paper">
            {accessMode === "real" ? "Operator Desk" : "Synthetic Demo Desk"}
          </h2>
        </div>
        <p className="text-base text-paper/75 mt-2 leading-relaxed font-medium font-sans">
          {accessMode === "real"
            ? "Review server-authorized prototype cases. This desk is not connected to any government workflow."
            : "Preview only synthetic demo cases. Demo actions are server-limited to records marked as demo data."}
        </p>
      </div>

      {/* Grid of counters */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-2.5 rounded-xl border border-hairline flex flex-col shadow-2xs">
          <span className="text-sm font-mono text-ink-2">Total feed</span>
          <span className="text-sm font-mono font-bold text-ink mt-0.5">{issues.length}</span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-hairline flex flex-col shadow-2xs">
          <span className="text-sm font-mono text-ink-2">Active triages</span>
          <span className="text-sm font-mono font-bold text-marigold mt-0.5">
            {issues.filter(i => i.status === "submitted" || i.status === "verified").length}
          </span>
         </div>
        <div className="bg-white p-2.5 rounded-xl border border-hairline flex flex-col shadow-2xs">
          <span className="text-sm font-mono text-ink-2">Resolved</span>
          <span className="text-sm font-mono font-bold text-verify mt-0.5">
            {issues.filter(i => i.status === "resolved").length}
          </span>
        </div>
      </div>

      {/* Main List Container */}
      <div className="bg-white border border-hairline rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-hairline pb-2.5">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-ink-2" />
            <h3 className="text-base font-mono font-bold text-ink-2">Active cases</h3>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="h-11 w-11 rounded-lg text-slate hover:bg-paper disabled:opacity-50 cursor-pointer flex items-center justify-center"
            title="Refresh Ledger"
            aria-label="Refresh operator case queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {accessMode === "demo" && (issues.length < 3 || issues.some(i => i.isDemoData)) && (
          <div className="bg-paper border border-hairline rounded-xl p-3 flex flex-col items-center text-center gap-2 select-none">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-hairline">
              <Database className="w-4 h-4 text-marigold" />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-ink">Demo Data Control</h4>
              <p className="text-[13px] text-ink-2 mt-0.5 leading-relaxed max-w-xs">
                Seed 7 synthetic Bengaluru reports to preview the workflow, or clear only demo records.
              </p>
            </div>
            {seedError && <p className="text-sm text-alert font-mono">{seedError}</p>}
            
            <div className="flex gap-2 w-full mt-1">
              <button
                id="load-demo-btn"
                onClick={handleLoadDemo}
                disabled={seeding || clearing || loading}
                className="flex-1 min-h-[44px] bg-marigold hover:bg-marigold/95 text-ink text-[13px] font-bold px-3 py-2 rounded-lg border border-hairline cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                {seeding ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Seeding...</span>
                  </>
                ) : (
                  <span>Seed Demo</span>
                )}
              </button>

              <button
                id="clear-demo-btn"
                onClick={handleClearDemo}
                disabled={seeding || clearing || loading}
                className="flex-1 min-h-[44px] bg-white hover:bg-paper text-ink-2 border border-slate-300 hover:border-slate-500 hover:text-ink text-[13px] font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                {clearing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Clearing...</span>
                  </>
                ) : (
                  <span>Clear Demo</span>
                )}
              </button>
            </div>
          </div>
        )}

        {sortedIssues.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-slate italic">
            No prototype reports saved yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sortedIssues.map((issue) => (
              <button
                type="button"
                id={`operator-issue-row-${issue.id}`}
                key={issue.id}
                onClick={() => onSelectIssue(issue.id)}
                aria-label={`Open case ${issue.title || issue.ticketId || issue.id}`}
                aria-pressed={selectedIssueId === issue.id}
                className={`w-full text-left bg-paper hover:bg-[#FDFDFD] border rounded-xl p-3 flex flex-col gap-2 cursor-pointer transition-all hover:shadow-2xs select-none min-h-[112px] ${
                  selectedIssueId === issue.id
                    ? "border-marigold shadow-xs ring-2 ring-marigold/20"
                    : "border-hairline"
                }`}
              >
                {/* Header info */}
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-sm font-mono text-ink-2 font-semibold">
                    {humanizeCategory(issue.category)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-mono text-ink-2">Priority</span>
                    <span className="font-mono text-sm font-bold text-ink bg-white border border-hairline px-2 py-1 rounded-lg">
                      {Math.round(issue.priorityScore || 0)}
                    </span>
                  </div>
                </div>

                {/* Body details */}
                <div className="flex flex-col">
                  <h4 className="text-sm font-semibold text-ink line-clamp-1 leading-normal">{issue.title || "Civic Incident"}</h4>
                  <p className="text-[13px] text-ink-2 mt-0.5 line-clamp-1 leading-snug font-normal">
                    {issue.description}
                  </p>
                </div>

                {/* Footer metrics info */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-hairline/60 text-sm font-mono">
                  <div className="flex gap-2 items-center text-ink-2 font-medium">
                    <span>SEVERITY: <span className="font-bold text-ink">{issue.severity || 1}/5</span></span>
                    <span className="w-0.5 h-0.5 rounded-full bg-slate" />
                    <span>RPTS: <span className="font-bold text-ink">{issue.reportCount || 1}</span></span>
                    <span className="w-0.5 h-0.5 rounded-full bg-slate" />
                    <span>CNF: <span className="font-bold text-ink">{issue.confirmCount || 0}</span></span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {issue.isDemoData && (
                      <span className="text-sm font-mono font-bold bg-marigold/10 border border-marigold/20 text-marigold-ink px-2 py-1 rounded-lg">
                        Demo
                      </span>
                    )}
                    <LifecycleStatusBadge status={issue.status} size="sm" />
                    <div className="w-5 h-5 rounded border border-hairline bg-white flex items-center justify-center text-slate">
                      <Eye className="w-2.5 h-2.5" />
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {hasMore && (
              <button
                type="button"
                onClick={onLoadMore}
                disabled={loadingMore}
                className="min-h-[44px] rounded-xl border border-hairline bg-white px-3 text-base font-bold text-ink hover:bg-paper disabled:opacity-60"
              >
                {loadingMore ? "Loading more cases..." : "Load more cases"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
