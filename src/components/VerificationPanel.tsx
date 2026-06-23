import React, { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle, RefreshCw, AlertCircle } from "lucide-react";
import { IssueReport } from "../types";
import { submitVerification, checkUserVerification, updateIssueStatus } from "../services/issues";

interface VerificationPanelProps {
  issue: IssueReport;
  onRefresh: () => void;
}

export default function VerificationPanel({ issue, onRefresh }: VerificationPanelProps) {
  const [userVote, setUserVote] = useState<"confirm" | "dispute" | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUserVote() {
      const vote = await checkUserVerification(issue.id);
      setUserVote(vote);
    }
    fetchUserVote();
  }, [issue.id]);

  const handleVote = async (type: "confirm" | "dispute") => {
    setLoading(true);
    setError(null);
    try {
      await submitVerification(issue.id, type);
      setUserVote(type);
      onRefresh(); // refresh detail page state to fetch new counts
    } catch (err: any) {
      setError(err.message || "Failed to submit verification.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusTransition = async () => {
    const STATUS_FLOW = {
      "Submitted": "Verified",
      "Verified": "In Progress",
      "In Progress": "Resolved",
      "Resolved": "Resolved"
    } as const;

    const nextStatus = STATUS_FLOW[issue.status as keyof typeof STATUS_FLOW];
    if (nextStatus === issue.status) return;

    setStatusLoading(true);
    setError(null);
    try {
      await updateIssueStatus(issue.id, nextStatus as any);
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to progress issue status.");
    } finally {
      setStatusLoading(false);
    }
  };

  const statusNextLabel = {
    "Submitted": "Verify Report",
    "Verified": "Mark 'In Progress'",
    "In Progress": "Declare Resolved"
  }[issue.status] || null;

  return (
    <div id="verification-panel" className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-4 shadow-3xs font-sans">
      {/* 1. Community Verification Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Community Verification</span>
          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm capitalize">
            Status: {issue.verificationStatus || "unverified"}
          </span>
        </div>

        {/* Counts display */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <ThumbsUp className="w-4 h-4 text-emerald-600" />
              <span>Confirmed</span>
            </div>
            <span className="font-mono font-extrabold text-[13px]">{issue.confirmCount || 0}</span>
          </div>
          <div className="bg-rose-50 border border-rose-100 text-rose-800 p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <ThumbsDown className="w-4 h-4 text-rose-600" />
              <span>Disputed</span>
            </div>
            <span className="font-mono font-extrabold text-[13px]">{issue.disputeCount || 0}</span>
          </div>
        </div>

        {/* Voting triggers */}
        {userVote ? (
          <div className="bg-slate-50 p-2.5 rounded-xl text-center border border-slate-100 text-[11px] text-slate-500 font-medium">
             You marked this report containing <span className="font-bold underline">{userVote === "confirm" ? "Accurate Info" : "Inaccurate Info"}</span>.
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => handleVote("confirm")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs py-2 px-3 rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
              style={{ minHeight: "38px" }}
            >
              <ThumbsUp className="w-4 h-4" />
              <span>Confirm Fact</span>
            </button>
            <button
              onClick={() => handleVote("dispute")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs py-2 px-3 rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
              style={{ minHeight: "38px" }}
            >
              <ThumbsDown className="w-4 h-4" />
              <span>Dispute Fact</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Interactive Status Transition Section */}
      {statusNextLabel && issue.status !== "Resolved" && (
        <div className="border-t border-slate-100 pt-3.5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lifecycle Advancement</span>
            <span className="text-[9px] text-slate-400">Progress public incident</span>
          </div>
          <button
            onClick={handleStatusTransition}
            disabled={statusLoading}
            className="w-full flex items-center justify-center gap-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs py-2 px-3 rounded-xl font-bold cursor-pointer transition-colors shadow-3xs disabled:opacity-60"
            style={{ minHeight: "38px" }}
          >
            {statusLoading ? <RefreshCw className="w-4 h-4 animate-spin text-slate-400" /> : <CheckCircle className="w-4 h-4 text-emerald-500" />}
            <span>{statusLoading ? "Updating..." : statusNextLabel}</span>
          </button>
        </div>
      )}

      {/* Errors output */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-[11px] p-2.5 rounded-xl flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-rose-500 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
