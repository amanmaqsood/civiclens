import React, { useState, useEffect } from "react";
import { IssueReport, IssueActivity, ClosureAssessment } from "../types";
import { fetchIssueActivities, recordIssueActivity, updateIssueStatus } from "../services/issues";
import { ArrowLeft, Clock, ShieldCheck, CheckSquare, RefreshCw, Lock } from "lucide-react";
import ClosureVerificationPanel from "./ClosureVerificationPanel";
import AutoEscalationPanel from "./AutoEscalationPanel";
import confetti from "canvas-confetti";

interface OperatorDetailViewProps {
  issue: IssueReport;
  onBack: () => void;
  onRefresh: () => void;
}

export default function OperatorDetailView({ issue, onBack, onRefresh }: OperatorDetailViewProps) {
  const [activities, setActivities] = useState<IssueActivity[]>([]);
  const [loadingAct, setLoadingAct] = useState(true);
  const [confirmingStatus, setConfirmingStatus] = useState<"Verified" | "In Progress" | "Resolved" | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [manualOverride, setManualOverride] = useState(false);

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

  const handleAdvanceStatus = async (nextStatus: "Verified" | "In Progress" | "Resolved") => {
    setActionPending(true);
    try {
      await updateIssueStatus(issue.id, nextStatus);
      await recordIssueActivity(issue.id, {
        actorType: "operator",
        eventType: "status_changed",
        message: `Incident status moved to '${nextStatus}' by prototype operator.${
          nextStatus === "Resolved" && !issue.closureAssessment ? " (Manual prototype override recorded)" : ""
        }`,
        timestamp: new Date().toISOString(),
      });
      setConfirmingStatus(null);
      if (nextStatus === "Resolved") {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
      await loadActivities();
      onRefresh();
    } catch (e) {
      alert("Failed updating incident status state.");
    } finally {
      setActionPending(false);
    }
  };

  const isResolved = issue.status === "Resolved";
  const isAiVerified = !!issue.closureAssessment;
  const canMarkResolved = issue.status === "In Progress" && (isAiVerified || manualOverride);

  return (
    <div id="operator-detail-scroll-view" className="flex flex-col gap-4 p-4 bg-slate-50 min-h-screen font-sans">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-slate-200 cursor-pointer min-w-[40px] min-h-[40px]">
          <ArrowLeft className="w-5 h-5 text-slate-700" />
        </button>
        <div>
          <span className="text-[9px] font-black uppercase bg-indigo-100 text-[#4F46E5] px-2 py-0.5 rounded-sm">
            Prototype Ticket: {issue.ticketId}
          </span>
          <h2 className="text-sm font-bold text-slate-900 line-clamp-1">{issue.title || "Civic Incident"}</h2>
        </div>
      </div>

      <ClosureVerificationPanel issue={issue} onVerified={() => { loadActivities(); onRefresh(); }} />

      <div className="bg-white border rounded-2xl p-4 shadow-3xs flex flex-col gap-3">
        <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-tight flex items-center gap-1.5 border-b pb-2">
          <CheckSquare className="w-4 h-4 text-indigo-500" />
          Status Advance Controls
        </h3>

        {isResolved ? (
          <div className="bg-emerald-50 text-emerald-800 border p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Lifecycle resolved & locked.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              Current prototype step: <span className="text-indigo-600 font-extrabold">{issue.status}</span>
            </span>

            <div className="grid grid-cols-1 gap-2 text-xs">
              <button
                disabled={issue.status !== "Submitted"}
                onClick={() => setConfirmingStatus("Verified")}
                className="w-full text-left bg-slate-50 disabled:opacity-40 hover:bg-slate-100/50 cursor-pointer border py-2.5 px-3 rounded-xl flex items-center justify-between font-semibold"
              >
                <span>1. Acknowledge & Route</span>
                <span className="text-[9px] bg-sky-100 text-sky-800 px-2 py-0.5 rounded-md">To Verified</span>
              </button>

              <button
                disabled={issue.status !== "Verified"}
                onClick={() => setConfirmingStatus("In Progress")}
                className="w-full text-left bg-slate-50 disabled:opacity-40 hover:bg-slate-100/50 cursor-pointer border py-2.5 px-3 rounded-xl flex items-center justify-between font-semibold"
              >
                <span>2. Mark In Progress</span>
                <span className="text-[9px] bg-violet-100 text-violet-800 px-2 py-0.5 rounded-md">To In Progress</span>
              </button>

              <div className="flex flex-col gap-2">
                <button
                  disabled={!canMarkResolved}
                  onClick={() => setConfirmingStatus("Resolved")}
                  className="w-full text-left bg-emerald-50 disabled:opacity-40 hover:bg-emerald-100/50 hover:border-emerald-300 disabled:bg-slate-50 cursor-pointer border py-2.5 px-3 rounded-xl flex items-center justify-between font-semibold text-emerald-950"
                >
                  <span>3. Mark Resolved</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">To Resolved</span>
                </button>

                {issue.status === "In Progress" && !isAiVerified && (
                  <label className="flex items-center gap-2 px-1 text-[10.5px] font-bold text-slate-500 hover:text-slate-800 transition-colors select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualOverride}
                      onChange={(e) => setManualOverride(e.target.checked)}
                      className="rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5] w-3.5 h-3.5"
                    />
                    <span>Manual prototype override (requires rationale in final rebuild)</span>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {issue.status !== "Resolved" && (
        <AutoEscalationPanel issue={issue} onUpdated={onRefresh} />
      )}

      <div className="bg-white border rounded-2xl p-4 shadow-3xs flex flex-col gap-3">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5 border-b pb-2">
          <Clock className="w-4 h-4 text-slate-500" />
          Activity History (Prototype)
        </h3>
        {loadingAct ? (
          <div className="flex justify-center py-4"><RefreshCw className="w-4 h-4 animate-spin text-slate-300" /></div>
        ) : activities.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center font-semibold">No audits.</p>
        ) : (
          <div className="flex flex-col gap-3 pl-3.5 border-l border-slate-100 relative text-[10.5px]">
            {activities.map((act) => (
              <div key={act.id} className="relative flex flex-col">
                <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white" />
                <span className="text-[9px] text-slate-400 font-bold uppercase">{act.actorType === "operator" ? "Prototype Operator" : "Citizen"}</span>
                <p className="text-slate-700 font-semibold mt-0.5">{act.message}</p>
                <span className="text-[8.5px] text-slate-400 font-mono mt-0.5">{new Date(act.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmingStatus && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-3xs flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-2xl border max-w-xs w-full shadow-xl flex flex-col gap-4 text-center">
            <h4 className="text-xs font-bold text-slate-800 uppercase">Confirm Status</h4>
            <p className="text-[10.5px] text-slate-500 font-medium">
              Transition this complaint status to <span className="font-extrabold text-[#4F46E5]">"{confirmingStatus}"</span>?
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setConfirmingStatus(null)} className="bg-slate-100 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer border">No</button>
              <button onClick={() => handleAdvanceStatus(confirmingStatus)} disabled={actionPending} className="bg-[#4F46E5] text-white text-xs font-bold py-1.5 px-3 rounded-lg cursor-pointer">Yes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
