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
      try {
        const vote = await checkUserVerification(issue.id);
        setUserVote(vote);
      } catch (err) {
        console.error("fetchUserVote error: ", err);
      }
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
    "Submitted": "Verify Report Quality",
    "Verified": "SLA In-Progress Action",
    "In Progress": "Mark as Resolved"
  }[issue.status] || null;

  return (
    <div id="verification-panel" className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] font-sans">
      {/* 1. Community Verification Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[9pt] font-mono uppercase text-slate">COMMUNITY VERIFICATION</span>
          <span className="text-[9px] font-mono font-semibold bg-paper text-ink px-2 py-0.5 rounded border border-hairline capitalize">
            {issue.verificationStatus || "unverified"}
          </span>
        </div>

        {/* Counts display using theme colors */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className="bg-verify/5 border border-verify/20 text-verify p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <ThumbsUp className="w-3.5 h-3.5 text-verify" />
              <span>Confirmed</span>
            </div>
            <span className="font-mono font-extrabold text-[12px]">{issue.confirmCount || 0}</span>
          </div>
          <div className="bg-alert/5 border border-alert/20 text-alert p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <ThumbsDown className="w-3.5 h-3.5 text-alert" />
              <span>Disputed</span>
            </div>
            <span className="font-mono font-extrabold text-[12px]">{issue.disputeCount || 0}</span>
          </div>
        </div>

        {/* Voting triggers */}
        {userVote ? (
          <div className="bg-paper p-2.5 rounded-xl text-center border border-hairline text-[10px] text-slate font-medium leading-relaxed select-none">
             Fact verification submitted: audit category is marked as <span className="font-semibold text-ink">{userVote === "confirm" ? "Accurate" : "Disputed"}</span>.
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => handleVote("confirm")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 border border-verify/20 bg-verify/5 text-verify hover:bg-verify/10 text-[10px] py-2 px-3 rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
              style={{ minHeight: "36px" }}
            >
              <ThumbsUp className="w-3.5 h-3.5 text-verify" />
              <span>Confirm</span>
            </button>
            <button
              onClick={() => handleVote("dispute")}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-1.5 border border-alert/20 bg-alert/5 text-alert hover:bg-alert/10 text-[10px] py-2 px-3 rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
              style={{ minHeight: "36px" }}
            >
              <ThumbsDown className="w-3.5 h-3.5 text-alert" />
              <span>Dispute</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Interactive Status Transition Section */}
      {statusNextLabel && issue.status !== "Resolved" && (
        <div className="border-t border-hairline pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[9pt] font-mono text-slate uppercase">Case advancement flow</span>
            <span className="text-[9px] text-slate/60">Simulate official action</span>
          </div>
          <button
            onClick={handleStatusTransition}
            disabled={statusLoading}
            className="w-full flex items-center justify-center gap-1.5 border border-hairline bg-white hover:bg-paper text-ink text-[10px] py-2 px-3 rounded-xl font-bold cursor-pointer transition-all shadow-2xs disabled:opacity-60"
            style={{ minHeight: "36px" }}
          >
            {statusLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate" /> : <CheckCircle className="w-3.5 h-3.5 text-verify" />}
            <span>{statusLoading ? "Processing..." : statusNextLabel}</span>
          </button>
        </div>
      )}

      {/* Errors output */}
      {error && (
        <div className="bg-alert/5 border border-alert/20 text-alert text-[10px] p-2.5 rounded-xl flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-alert mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
