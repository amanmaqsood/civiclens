import React, { useState } from "react";
import { IssueReport } from "../types";
import { ShieldCheck, ArrowRight, Eye, RefreshCw, Layers, Database } from "lucide-react";
import { seedDemoIssuesBengaluru } from "../services/issues";

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

  // Sort by priorityScore descending
  const sortedIssues = [...issues].sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  return (
    <div id="operator-queue-container" className="flex flex-col gap-4 p-4 font-sans bg-slate-50 min-h-screen">
      {/* Simulation Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-md border border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-indigo-200">
            Authority Operator Control Panel
          </h2>
        </div>
        <p className="text-[10px] text-slate-300 mt-1.5 leading-relaxed font-semibold">
          Disclaimer: This is a simulated preview console for municipal and agency triage officers. Change current status and audit municipal SLA pipelines.
        </p>
      </div>

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex flex-col">
          <span className="text-[9px] text-slate-400 font-bold uppercase">All Incidents</span>
          <span className="text-sm font-extrabold text-slate-800">{issues.length}</span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex flex-col">
          <span className="text-[9px] text-slate-400 font-bold uppercase font-sans">Action Needed</span>
          <span className="text-sm font-extrabold text-indigo-600">
            {issues.filter(i => i.status === "Submitted" || i.status === "Verified").length}
          </span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 flex flex-col">
          <span className="text-[9px] text-slate-400 font-bold uppercase">Resolved</span>
          <span className="text-sm font-extrabold text-emerald-600">
            {issues.filter(i => i.status === "Resolved").length}
          </span>
        </div>
      </div>

      {/* Main List Container */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-3xs flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-tight">Active Grievance Queue</h3>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50 cursor-pointer"
            title="Refresh issues"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {issues.length < 3 && (
          <div className="bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 border border-indigo-200/40 rounded-xl p-3 flex flex-col items-center text-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-[11px] font-bold text-slate-800">Demo Environment Seed</h4>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed max-w-sm">
                Fewer than 3 issues exist. Seed 7 high-fidelity Bengaluru reports to preview triaging, analytics, and auto-escalation cycles.
              </p>
            </div>
            {seedError && (
              <p className="text-[9px] text-rose-500 font-semibold">{seedError}</p>
            )}
            <button
              id="load-demo-btn"
              onClick={handleLoadDemo}
              disabled={seeding || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-3xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
            >
              {seeding ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Seeding Bengaluru...</span>
                </>
              ) : (
                <span>Load Bengaluru Demo Data</span>
              )}
            </button>
          </div>
        )}

        {sortedIssues.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400 font-medium">
            No issues filed in this city region.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sortedIssues.map((issue) => {
              const statusColors: Record<string, string> = {
                Submitted: "bg-amber-50 text-amber-700 border-amber-200/60",
                Verified: "bg-blue-50 text-blue-700 border-blue-200/60",
                "In Progress": "bg-indigo-50 text-indigo-700 border-indigo-200/60",
                Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
              };

              return (
                <div
                  id={`operator-issue-row-${issue.id}`}
                  key={issue.id}
                  onClick={() => onSelectIssue(issue.id)}
                  className="bg-slate-50 hover:bg-indigo-50/40 border border-slate-200/30 hover:border-indigo-100 rounded-xl p-3 flex flex-col gap-2.5 cursor-pointer transition-all duration-200 hover:shadow-2xs"
                >
                  {/* Top: Category & Urgency badges, score */}
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="text-[10px] uppercase font-extrabold text-[#4F46E5] tracking-wider">
                      {issue.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-sans text-slate-400">Score:</span>
                      <span className="font-mono text-xs font-black text-slate-800 bg-slate-200/60 px-2 py-0.5 rounded-md">
                        {issue.priorityScore || 0}
                      </span>
                    </div>
                  </div>

                  {/* Title & description */}
                  <div className="flex flex-col">
                    <h4 className="text-xs font-bold text-slate-850 leading-snug line-clamp-1">{issue.title || "Civic Incident"}</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {issue.description}
                    </p>
                  </div>

                  {/* Bottom: Inline mini table values */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200/20 text-[10px]">
                    <div className="flex gap-2.5 items-center text-slate-500 font-medium">
                      <span>Sv: <span className="font-bold text-slate-700">{issue.severity || 1}/5</span></span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>Rpt: <span className="font-bold text-slate-700">{issue.reportCount || 1}</span></span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span>Cnf: <span className="font-bold text-slate-700">{issue.confirmCount || 0}</span></span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      {issue.isDemoData && (
                        <span className="text-[9px] font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Demo
                        </span>
                      )}
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${statusColors[issue.status] || "bg-slate-50"}`}>
                        {issue.status}
                      </span>
                      <div className="w-5 h-5 rounded-md bg-slate-100 flex items-center justify-center text-slate-500">
                        <Eye className="w-3 h-3" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
