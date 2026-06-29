import React, { useState, useEffect } from "react";
import { IssueReport, IssueActivity } from "../types";
import { approveRoutingPlan, dispatchEscalation, fetchIssueActivities, finalizeEscalation, updateIssueStatus } from "../services/issues";
import { fetchLatestAgentRun, runAgentForIssue } from "../services/api";
import { ArrowLeft, Clock, CheckSquare, RefreshCw, Lock, Sparkles, Send, CheckCircle2 } from "lucide-react";
import ClosureVerificationPanel from "./ClosureVerificationPanel";
import AutoEscalationPanel from "./AutoEscalationPanel";
import AgentTraceTimeline from "./AgentTraceTimeline";
import confetti from "canvas-confetti";
import { IssueStatusKey, issueStatusLabel } from "../constants/status";

interface OperatorDetailViewProps {
  issue: IssueReport;
  onBack: () => void;
  onRefresh: () => void;
  demoOperator: boolean;
  embedded?: boolean;
}

export default function OperatorDetailView({ issue, onBack, onRefresh, demoOperator, embedded = false }: OperatorDetailViewProps) {
  const [activities, setActivities] = useState<IssueActivity[]>([]);
  const [loadingAct, setLoadingAct] = useState(true);
  const [confirmingStatus, setConfirmingStatus] = useState<IssueStatusKey | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);
  const [approvalRationale, setApprovalRationale] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [liveAgentSteps, setLiveAgentSteps] = useState<any[]>([]);
  const [persistedAgentSteps, setPersistedAgentSteps] = useState<any[]>([]);
  const [activeAgentRun, setActiveAgentRun] = useState<any | null>(null);

  const loadActivities = async () => {
    setLoadingAct(true);
    try {
      const data = await fetchIssueActivities(issue.id);
      setActivities(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAct(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [issue.id]);

  useEffect(() => {
    let active = true;
    async function loadLatestRun() {
      try {
        const result = await fetchLatestAgentRun(issue.id);
        if (active) {
          setPersistedAgentSteps(result.steps || []);
          setActiveAgentRun(result.run || null);
        }
      } catch {
        if (active) {
          setPersistedAgentSteps([]);
          setActiveAgentRun(null);
        }
      }
    }
    loadLatestRun();
    return () => {
      active = false;
    };
  }, [issue.id]);

  const handleRunAgent = async () => {
    setAgentRunning(true);
    setAgentError(null);
    setLiveAgentSteps([]);
    try {
      const agentResult = await runAgentForIssue(issue.id, { demoOperator });
      // Show the real persisted trace exactly as the server recorded it - no
      // artificial step-by-step replay timing.
      setLiveAgentSteps(agentResult.steps || []);
      setActiveAgentRun(agentResult.run || null);
      setPersistedAgentSteps(agentResult.steps || []);
      await loadActivities();
      onRefresh();
    } catch (e: any) {
      setAgentError(e?.message || "Failed to run the server agent workflow.");
    } finally {
      setAgentRunning(false);
    }
  };

  const handleAdvanceStatus = async (nextStatus: IssueStatusKey) => {
    const rationale = approvalRationale.trim();
    if (!rationale) {
      setActionError("Enter a written operator rationale before confirming this status transition.");
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      await updateIssueStatus(issue.id, nextStatus, { demoOperator, rationale });
      setConfirmingStatus(null);
      setApprovalRationale("");
      if (nextStatus === "resolved") {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
      await loadActivities();
      onRefresh();
    } catch (e: any) {
      setActionError(e?.message || "Failed updating incident status state.");
    } finally {
      setActionPending(false);
    }
  };

  const handleApproveRouting = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      await approveRoutingPlan(
        issue.id,
        `Operator approved the draft routing/action packet for ${issue.resolutionPlan?.recommendedAuthority || "the suggested authority"}.`,
        { demoOperator }
      );
      await loadActivities();
      onRefresh();
    } catch (e: any) {
      setActionError(e.message || "Failed approving routing plan.");
    } finally {
      setActionPending(false);
    }
  };

  const handleFinalizeEscalation = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      await finalizeEscalation(
        issue.id,
        "Operator reviewed and finalized the escalation/RTI draft for manual use outside CivicLens.",
        { demoOperator }
      );
      await loadActivities();
      onRefresh();
    } catch (e: any) {
      setActionError(e.message || "Failed finalizing escalation draft.");
    } finally {
      setActionPending(false);
    }
  };

  const [dispatchResult, setDispatchResult] = useState<any>(issue.dispatch || null);
  const handleDispatchEscalation = async () => {
    setActionPending(true);
    setActionError(null);
    try {
      const dispatch = await dispatchEscalation(issue.id, { demoOperator });
      setDispatchResult(dispatch);
      await loadActivities();
      onRefresh();
    } catch (e: any) {
      setActionError(e.message || "Failed to dispatch escalation to the authority channel.");
    } finally {
      setActionPending(false);
    }
  };

  const isResolved = issue.status === "resolved";
  const isAiVerified = !!issue.closureAssessment;
  const canMarkResolved = issue.status === "in_progress" && (isAiVerified || manualOverride);
  const rootClassName = embedded
    ? "flex flex-col gap-5 p-4 sm:p-5 lg:p-6 bg-slate-50 min-h-full w-full font-sans"
    : "flex flex-col gap-5 p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen w-full font-sans";

  return (
    <div id="operator-detail-scroll-view" className={rootClassName}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full hover:bg-slate-200 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Back to operator queue"
        >
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div>
          <span className="text-sm font-black bg-indigo-100 text-marigold px-2 py-1 rounded-lg">
            Prototype Ticket: {issue.ticketId}
          </span>
          <h2 className="text-2xl font-black text-slate-900 line-clamp-2">Command center case: {issue.title || "Civic Incident"}</h2>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] xl:items-start">
        <div className="flex flex-col gap-4">
          {actionError && (
            <div role="alert" className="rounded-xl border border-alert/20 bg-alert/10 p-3 text-base font-semibold leading-relaxed text-alert">
              {actionError}
            </div>
          )}

          {issue.followUp?.action && (
            <div className="rounded-xl border border-marigold/30 bg-marigold/10 p-3 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-marigold" aria-hidden="true" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-bold text-marigold-ink">
                  AI follow-up recommendation: {String(issue.followUp.action).replace(/_/g, " ").toUpperCase()}
                </span>
                <span className="text-[13px] text-ink-2 leading-snug">{issue.followUp.reasoning}</span>
              </div>
            </div>
          )}

          <ClosureVerificationPanel issue={issue} onVerified={() => { loadActivities(); onRefresh(); }} />

          <div className="flex flex-col gap-3">
            <div className="bg-white border rounded-2xl p-4 shadow-3xs flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3 border-b pb-2">
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Persisted agent workflow
                  </h3>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500">
                    Runs the server-side Gemini tool loop for this operator case. Drafts stay inside CivicLens until a human acts outside the app.
                  </p>
                </div>
                {persistedAgentSteps.length > 0 && (
                  <span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-sm font-bold text-emerald-700">
                    Persisted
                  </span>
                )}
              </div>

              {agentError && (
                <div role="alert" className="rounded-xl border border-alert/20 bg-alert/10 p-3 text-sm font-bold text-alert">
                  {agentError}
                </div>
              )}

              <button
                type="button"
                onClick={handleRunAgent}
                disabled={agentRunning || actionPending}
                className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2.5 text-base font-bold text-white shadow-xs disabled:opacity-60"
              >
                {agentRunning ? "Running server agent..." : persistedAgentSteps.length > 0 ? "Re-run server agent" : "Run server agent"}
              </button>

              {agentRunning && (
                <div className="flex items-center justify-center gap-2 rounded-xl border bg-slate-50 py-2 text-sm font-bold text-slate-600">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                  Executing persisted tool workflow...
                </div>
              )}
            </div>

            <AgentTraceTimeline trace={agentRunning ? liveAgentSteps : persistedAgentSteps} run={activeAgentRun} />
          </div>

          <div className="bg-white border rounded-2xl p-4 shadow-3xs flex flex-col gap-3">
        <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-1.5 border-b pb-2">
          <CheckSquare className="w-4 h-4 text-indigo-500" />
          Status Advance Controls
        </h3>

        {isResolved ? (
          <div className="bg-emerald-50 text-emerald-800 border p-3 rounded-xl text-center text-sm font-bold flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Prototype lifecycle marked resolved.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-sm text-slate-500 font-bold block">
              Current prototype step: <span className="text-indigo-600 font-extrabold">{issueStatusLabel(issue.status)}</span>
            </span>

            <div className="grid grid-cols-1 gap-2 text-sm">
              <button
                disabled={issue.status !== "submitted"}
                onClick={() => setConfirmingStatus("verified")}
                className="w-full min-h-[44px] text-left bg-slate-50 disabled:opacity-40 hover:bg-slate-100/50 cursor-pointer border py-2.5 px-3 rounded-xl flex items-center justify-between font-semibold"
              >
                <span>1. Acknowledge Draft</span>
                <span className="text-sm bg-sky-100 text-sky-800 px-2 py-1 rounded-lg">To Verified</span>
              </button>

              <button
                disabled={issue.status !== "verified"}
                onClick={() => setConfirmingStatus("in_progress")}
                className="w-full min-h-[44px] text-left bg-slate-50 disabled:opacity-40 hover:bg-slate-100/50 cursor-pointer border py-2.5 px-3 rounded-xl flex items-center justify-between font-semibold"
              >
                <span>2. Mark In Progress</span>
                <span className="text-sm bg-violet-100 text-violet-800 px-2 py-1 rounded-lg">To In Progress</span>
              </button>

              <div className="flex flex-col gap-2">
                <button
                  disabled={!canMarkResolved}
                  onClick={() => setConfirmingStatus("resolved")}
                  className="w-full min-h-[44px] text-left bg-emerald-50 disabled:opacity-40 hover:bg-emerald-100/50 hover:border-emerald-300 disabled:bg-slate-50 cursor-pointer border py-2.5 px-3 rounded-xl flex items-center justify-between font-semibold text-emerald-950"
                >
                  <span>3. Mark Resolved</span>
                  <span className="text-sm bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg">To Resolved</span>
                </button>

                {issue.status === "in_progress" && !isAiVerified && (
                  <label className="flex items-center gap-2 px-1 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualOverride}
                      onChange={(e) => setManualOverride(e.target.checked)}
                      className="rounded border-slate-300 text-marigold focus:ring-marigold w-5 h-5"
                    />
                    <span>Manual prototype override (requires written operator rationale)</span>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}
          </div>

          {issue.status !== "resolved" && (
            <AutoEscalationPanel issue={issue} onUpdated={onRefresh} />
          )}
        </div>

        <aside className="flex flex-col gap-4">
          {(issue.resolutionPlan || issue.escalation) && (
            <div className="bg-white border rounded-2xl p-4 shadow-3xs flex flex-col gap-3">
          <h3 className="text-base font-extrabold text-slate-800 border-b pb-2">
            Human Approval Records
          </h3>
          {issue.resolutionPlan && (
            <button
              onClick={handleApproveRouting}
              disabled={actionPending}
              className="w-full min-h-[44px] text-left bg-slate-50 disabled:opacity-50 hover:bg-slate-100/50 cursor-pointer border py-2.5 px-3 rounded-xl flex items-center justify-between font-semibold text-sm"
            >
              <span>Approve draft routing/action packet</span>
              <span className="text-sm bg-sky-100 text-sky-800 px-2 py-1 rounded-lg">Record</span>
            </button>
          )}
          {issue.escalation && (
            <button
              onClick={handleFinalizeEscalation}
              disabled={actionPending}
              className="w-full min-h-[44px] text-left bg-slate-50 disabled:opacity-50 hover:bg-slate-100/50 cursor-pointer border py-2.5 px-3 rounded-xl flex items-center justify-between font-semibold text-sm"
            >
              <span>Finalize escalation/RTI draft</span>
              <span className="text-sm bg-violet-100 text-violet-800 px-2 py-1 rounded-lg">Record</span>
            </button>
          )}
          {issue.escalation && (
            <button
              onClick={handleDispatchEscalation}
              disabled={actionPending || dispatchResult?.status === "delivered"}
              className="w-full min-h-[44px] text-left bg-marigold/10 disabled:opacity-60 hover:bg-marigold/20 cursor-pointer border border-marigold/30 py-2.5 px-3 rounded-xl flex items-center justify-between font-semibold text-sm"
            >
              <span className="flex items-center gap-1.5 text-marigold-ink">
                <Send className="w-4 h-4" aria-hidden="true" />
                {dispatchResult?.status === "delivered" ? "Dispatched to authority channel" : "Dispatch to authority channel"}
              </span>
              <span className="text-sm bg-marigold/20 text-marigold-ink px-2 py-1 rounded-lg">Send</span>
            </button>
          )}
          {dispatchResult?.status === "delivered" && (
            <p className="flex items-center gap-1.5 text-[13px] text-verify font-medium px-1">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              Delivered to {dispatchResult.endpoint} (HTTP {dispatchResult.httpStatus}) · receipt {String(dispatchResult.deliveryId).slice(-12)}
            </p>
          )}
            </div>
          )}

          <div className="bg-white border rounded-2xl p-4 shadow-3xs flex flex-col gap-3">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5 border-b pb-2">
          <Clock className="w-4 h-4 text-slate-500" />
          Activity History (Prototype)
        </h3>
        {loadingAct ? (
          <div className="flex justify-center py-4"><RefreshCw className="w-4 h-4 animate-spin text-slate-300" /></div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-slate-500 text-center font-semibold">No audits.</p>
        ) : (
          <div className="flex flex-col gap-3 pl-3.5 border-l border-slate-100 relative text-sm">
            {activities.map((act) => (
              <div key={act.id} className="relative flex flex-col">
                <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white" />
                <span className="text-sm text-slate-500 font-bold">{act.actorType === "operator" ? "Prototype Operator" : "Citizen"}</span>
                <p className="text-slate-700 font-semibold mt-0.5">{act.message}</p>
                <span className="text-sm text-slate-500 font-mono mt-0.5">{new Date(act.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
          </div>
        </aside>
      </div>

      {confirmingStatus && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-3xs flex items-center justify-center z-50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="operator-status-dialog-title"
            className="bg-white p-5 rounded-2xl border max-w-xs w-full shadow-xl flex flex-col gap-4 text-center"
          >
            <h4 id="operator-status-dialog-title" className="text-xl font-bold text-slate-800">Confirm status</h4>
            <p className="text-base text-slate-500 font-medium">
              Transition this complaint status to <span className="font-extrabold text-marigold">"{issueStatusLabel(confirmingStatus)}"</span>?
            </p>
            <textarea
              value={approvalRationale}
              onChange={(event) => setApprovalRationale(event.target.value)}
              className="w-full min-h-24 border rounded-xl p-3 text-base text-left"
              placeholder="Operator rationale"
              aria-label="Operator rationale for status transition"
              aria-describedby="operator-rationale-help"
              required
            />
            <p id="operator-rationale-help" className="text-sm font-semibold leading-relaxed text-slate-500">
              Written rationale is required for every lifecycle transition.
            </p>
            <div className="flex gap-2 justify-center">
              <button type="button" onClick={() => { setConfirmingStatus(null); setApprovalRationale(""); }} className="min-h-[44px] bg-slate-100 text-slate-700 text-base font-bold py-2 px-4 rounded-lg cursor-pointer border">Cancel</button>
              <button type="button" onClick={() => handleAdvanceStatus(confirmingStatus)} disabled={actionPending || approvalRationale.trim().length === 0} className="min-h-[44px] bg-marigold text-white text-base font-bold py-2 px-4 rounded-lg cursor-pointer disabled:opacity-60">Confirm transition</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
