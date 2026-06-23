import React, { useState } from "react";
import { IssueReport } from "../types";
import { ShieldCheck, Eye, RefreshCw, Layers, Database } from "lucide-react";
import { seedDemoIssuesBengaluru } from "../services/issues";
import { humanizeCategory } from "../utils/humanize";

interface OperatorQueueProps {
  issues: IssueReport[];
  onSelectIssue: (id: string) => void;
  onRefresh: () => void;
  loading: boolean;
}

export default function OperatorQueue({ issues, onSelectIssue, onRefresh, loading }: OperatorQueueProps) {
  const [seeding, setSeeding] = useState(false);
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

  const sortedIssues = [...issues].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Verified": return "bg-marigold/10 border-marigold/20 text-marigold";
      case "In Progress": return "bg-[#3B82F6]/10 border-[#3B82F6]/20 text-[#3B82F6]";
      case "Resolved": return "bg-verify/10 border-verify/20 text-verify";
      default: return "bg-slate/10 border-slate/20 text-slate";
    }
  };

  return (
    <div id="operator-queue-container" className="flex flex-col gap-4 p-4 font-sans bg-paper min-h-screen text-ink">
      {/* Simulation Header */}
      <div className="bg-ink text-paper p-4.5 rounded-2xl shadow-xs border border-white/5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-marigold" />
          <h2 className="text-[13px] font-display font-semibold uppercase tracking-wider text-paper">
            Authority Control Desk
          </h2>
        </div>
        <p className="text-[13px] text-paper/85 mt-2 leading-relaxed font-normal">
          Disclaimer: This is a simulated preview console for municipal and agency triage officers. Adjust status, review metrics, and enforce SLA pipelines.
        </p>
      </div>

      {/* Grid of counters */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-2.5 rounded-xl border border-hairline flex flex-col shadow-2xs">
          <span className="text-xs font-mono text-slate uppercase">Total feed</span>
          <span className="text-sm font-mono font-bold text-ink mt-0.5">{issues.length}</span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-hairline flex flex-col shadow-2xs">
          <span className="text-xs font-mono text-slate uppercase">Active Triages</span>
          <span className="text-sm font-mono font-bold text-marigold mt-0.5">
            {issues.filter(i => i.status === "Submitted" || i.status === "Verified").length}
          </span>
         </div>
        <div className="bg-white p-2.5 rounded-xl border border-hairline flex flex-col shadow-2xs">
          <span className="text-xs font-mono text-slate uppercase">Resolved</span>
          <span className="text-sm font-mono font-bold text-verify mt-0.5">
            {issues.filter(i => i.status === "Resolved").length}
          </span>
        </div>
      </div>

      {/* Main List Container */}
      <div className="bg-white border border-hairline rounded-2xl p-4 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-hairline pb-2.5">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate" />
            <h3 className="text-xs font-mono font-bold text-slate uppercase tracking-wide">ACTIVE CASES</h3>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 rounded-lg text-slate hover:bg-paper disabled:opacity-50 cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {issues.length < 3 && (
          <div className="bg-paper border border-hairline rounded-xl p-3 flex flex-col items-center text-center gap-2 select-none">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border border-hairline">
              <Database className="w-4 h-4 text-marigold" />
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-ink">Demo Data</h4>
              <p className="text-[13px] text-slate mt-0.5 leading-relaxed max-w-xs">
                Requires sample payload. Seed 7 high-fidelity Bengaluru reports to preview municipal status cycles.
              </p>
            </div>
            {seedError && <p className="text-xs text-alert font-mono">{seedError}</p>}
            <button
              id="load-demo-btn"
              onClick={handleLoadDemo}
              disabled={seeding || loading}
              className="w-full bg-marigold hover:bg-marigold/95 text-ink text-[13px] font-bold px-3 py-1.5 rounded-lg border border-hairline cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              style={{ minHeight: "30px" }}
            >
              {seeding ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Seeding telemetry...</span>
                </>
              ) : (
                <span>Load Bengaluru Demo Data</span>
              )}
            </button>
          </div>
        )}

        {sortedIssues.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-slate italic">
            No issues filed in this municipality range.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sortedIssues.map((issue) => (
              <div
                id={`operator-issue-row-${issue.id}`}
                key={issue.id}
                onClick={() => onSelectIssue(issue.id)}
                className="bg-paper hover:bg-[#FDFDFD] border border-hairline rounded-xl p-3 flex flex-col gap-2 cursor-pointer transition-all hover:shadow-2xs select-none"
              >
                {/* Header info */}
                <div className="flex items-center justify-between gap-2.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate font-semibold">
                    {humanizeCategory(issue.category)}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-mono text-slate">PRIORITY:</span>
                    <span className="font-mono text-xs font-bold text-ink bg-white border border-hairline px-2 py-0.5 rounded">
                      {Math.round(issue.priorityScore || 0)}
                    </span>
                  </div>
                </div>

                {/* Body details */}
                <div className="flex flex-col">
                  <h4 className="text-sm font-semibold text-ink line-clamp-1 leading-normal">{issue.title || "Civic Incident"}</h4>
                  <p className="text-[13px] text-slate mt-0.5 line-clamp-1 leading-snug font-normal">
                    {issue.description}
                  </p>
                </div>

                {/* Footer metrics info */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-hairline/60 text-xs font-mono">
                  <div className="flex gap-2 items-center text-slate font-medium">
                    <span>SEVERITY: <span className="font-bold text-ink">{issue.severity || 1}/5</span></span>
                    <span className="w-0.5 h-0.5 rounded-full bg-slate" />
                    <span>RPTS: <span className="font-bold text-ink">{issue.reportCount || 1}</span></span>
                    <span className="w-0.5 h-0.5 rounded-full bg-slate" />
                    <span>CNF: <span className="font-bold text-ink">{issue.confirmCount || 0}</span></span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    {issue.isDemoData && (
                      <span className="text-[10px] font-mono font-bold bg-marigold/10 border border-marigold/20 text-marigold px-1.5 py-0.5 rounded uppercase">
                        Demo
                      </span>
                    )}
                    <span className={`text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStatusStyle(issue.status)}`}>
                      {issue.status}
                    </span>
                    <div className="w-5 h-5 rounded border border-hairline bg-white flex items-center justify-center text-slate">
                      <Eye className="w-2.5 h-2.5" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
