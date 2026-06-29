import React, { useState, useEffect } from "react";
import { ThumbsUp, ThumbsDown, AlertCircle, Scale, ShieldCheck, RotateCcw } from "lucide-react";
import { IssueReport } from "../types";
import { appealTrustConsensus, submitVerification, checkUserVerification } from "../services/issues";

interface VerificationPanelProps {
  issue: IssueReport;
  onRefresh: () => void;
}

export default function VerificationPanel({ issue, onRefresh }: VerificationPanelProps) {
  const [userVote, setUserVote] = useState<"confirm" | "dispute" | null>(null);
  const [loading, setLoading] = useState(false);
  const [appealLoading, setAppealLoading] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const consensus = issue.trustConsensus;
  const confirmWeight = typeof consensus?.confirmWeight === "number" ? consensus.confirmWeight : issue.weightedConfirmScore || 0;
  const disputeWeight = typeof consensus?.disputeWeight === "number" ? consensus.disputeWeight : issue.weightedDisputeScore || 0;
  const threshold = consensus?.autoResolveThreshold || 2.4;
  const progressPct = Math.max(0, Math.min(100, Math.round((confirmWeight / threshold) * 100)));
  const brigadingRisk = consensus?.brigadingRisk || "low";
  const autoResolved = !!consensus?.autoResolvedAt;
  const appealPending = consensus?.appealStatus === "pending" || issue.trustAppeal?.status === "pending";

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
    setNotice(null);
    try {
      const result = await submitVerification(issue.id, type);
      setUserVote(type);
      if (result?.trust?.brigadingCollapsed) {
        setNotice("Signal saved with reduced weight after the brigading guard reviewed the vote burst.");
      } else if (result?.autoResolved) {
        setNotice("Weighted consensus crossed the auto-resolution threshold.");
      } else if (typeof result?.trust?.weight === "number") {
        setNotice(`Gemini-audited signal weight: ${result.trust.weight.toFixed(2)}.`);
      }
      onRefresh(); // refresh detail page state to fetch new counts
    } catch (err: any) {
      setError(err.message || "Failed to submit verification.");
    } finally {
      setLoading(false);
    }
  };

  const handleAppeal = async () => {
    setAppealLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await appealTrustConsensus(issue.id, appealReason);
      setNotice(result?.reopened ? "Appeal recorded and the case was reopened for review." : "Appeal recorded for review.");
      setAppealReason("");
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Failed to appeal consensus decision.");
    } finally {
      setAppealLoading(false);
    }
  };

  return (
    <div id="verification-panel" className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] font-sans">
      {/* 1. Community Verification Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-slate">Community verification</span>
          <span className="text-sm font-mono font-semibold bg-paper text-ink px-2 py-1 rounded-lg border border-hairline capitalize">
            {issue.verificationStatus || "unverified"}
          </span>
        </div>

        {/* Counts display using theme colors */}
        <div className="grid grid-cols-2 gap-2 text-center text-sm">
          <div className="bg-verify/5 border border-verify/20 text-status-resolved-ink p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <ThumbsUp className="w-3.5 h-3.5 text-status-resolved-ink" />
              <span>Confirmed</span>
            </div>
            <span className="font-mono font-extrabold text-base">{issue.confirmCount || 0}</span>
          </div>
          <div className="bg-alert/5 border border-alert/20 text-status-overdue-ink p-2.5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold">
              <ThumbsDown className="w-3.5 h-3.5 text-status-overdue-ink" />
              <span>Disputed</span>
            </div>
            <span className="font-mono font-extrabold text-base">{issue.disputeCount || 0}</span>
          </div>
        </div>

        {consensus && (
          <div id="trust-consensus-panel" className="rounded-xl border border-hairline bg-paper p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-marigold" />
                <span className="text-sm font-mono text-slate">Weighted consensus</span>
              </div>
              <span className={`rounded-lg border px-2 py-1 text-sm font-bold ${
                brigadingRisk === "high"
                  ? "border-alert/20 bg-alert/10 text-status-overdue-ink"
                  : brigadingRisk === "watch"
                    ? "border-marigold/20 bg-marigold/10 text-marigold-ink"
                    : "border-verify/20 bg-verify/10 text-status-resolved-ink"
              }`}>
                {brigadingRisk}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full border border-hairline bg-white">
              <div className="h-full bg-verify transition-all duration-300" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 border border-hairline">
                <span className="font-semibold text-slate">Confirm weight</span>
                <span className="font-mono font-black text-status-resolved-ink">{confirmWeight.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5 border border-hairline">
                <span className="font-semibold text-slate">Dispute weight</span>
                <span className="font-mono font-black text-status-overdue-ink">{disputeWeight.toFixed(2)}</span>
              </div>
            </div>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate">
              {consensus.publicExplanation}
            </p>
            {consensus.collapsedVotes > 0 && (
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-status-overdue-ink">
                <ShieldCheck className="w-3.5 h-3.5" />
                {consensus.collapsedVotes} low-weight signal{consensus.collapsedVotes === 1 ? "" : "s"} collapsed by the guard.
              </p>
            )}
          </div>
        )}

        {/* Voting triggers */}
        {userVote ? (
          <div className="bg-paper p-3 rounded-xl text-center border border-hairline text-sm text-slate font-medium leading-relaxed select-none">
             Community feedback saved: this report is marked as <span className="font-semibold text-ink">{userVote === "confirm" ? "Confirmed" : "Disputed"}</span> in CivicLens.
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => handleVote("confirm")}
              disabled={loading}
              className="flex-1 flex min-h-[44px] items-center justify-center gap-1.5 border border-verify/20 bg-verify/5 text-status-resolved-ink hover:bg-verify/10 text-sm py-2 px-3 rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
            >
              <ThumbsUp className="w-3.5 h-3.5 text-status-resolved-ink" />
              <span>Confirm</span>
            </button>
            <button
              onClick={() => handleVote("dispute")}
              disabled={loading}
              className="flex-1 flex min-h-[44px] items-center justify-center gap-1.5 border border-alert/20 bg-alert/5 text-status-overdue-ink hover:bg-alert/10 text-sm py-2 px-3 rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50"
            >
              <ThumbsDown className="w-3.5 h-3.5 text-status-overdue-ink" />
              <span>Dispute</span>
            </button>
          </div>
        )}
      </div>

      {autoResolved && (
        <div className="rounded-xl border border-marigold/25 bg-marigold/5 p-3">
          <div className="flex items-start gap-2">
            <RotateCcw className="mt-0.5 h-4 w-4 flex-shrink-0 text-marigold" />
            <div className="flex-1">
              <p className="text-sm font-bold text-ink">Consensus auto-resolution is appealable.</p>
              {appealPending ? (
                <p className="mt-1 text-sm font-semibold text-slate">An appeal is pending human review.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    value={appealReason}
                    onChange={(event) => setAppealReason(event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-hairline bg-white p-2 text-sm font-medium text-ink outline-none focus:border-marigold"
                    placeholder="Why should this consensus decision be reviewed?"
                  />
                  <button
                    type="button"
                    onClick={handleAppeal}
                    disabled={appealLoading || appealReason.trim().length < 12}
                    className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-bold text-paper disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{appealLoading ? "Recording..." : "Appeal decision"}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="bg-verify/5 border border-verify/20 text-status-resolved-ink text-sm p-3 rounded-xl flex items-start gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-status-resolved-ink mt-0.5 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Errors output */}
      {error && (
        <div className="bg-alert/5 border border-alert/20 text-status-overdue-ink text-sm p-3 rounded-xl flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-status-overdue-ink mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
