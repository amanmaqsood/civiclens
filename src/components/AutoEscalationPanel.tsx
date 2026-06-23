import React, { useState } from "react";
import { IssueReport } from "../types";
import { triggerAutoEscalation, recordIssueActivity } from "../services/issues";
import { ShieldAlert, Copy, Check, RefreshCw, Layers } from "lucide-react";

interface AutoEscalationPanelProps {
  issue: IssueReport;
  onUpdated: () => void;
}

export default function AutoEscalationPanel({ issue, onUpdated }: AutoEscalationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedEsc, setCopiedEsc] = useState(false);
  const [copiedRti, setCopiedRti] = useState(false);

  const escalation = issue.escalation;

  const handleEscalate = async () => {
    setLoading(true);
    setError(null);
    try {
      await triggerAutoEscalation(issue);
      await recordIssueActivity(issue.id, {
        actorType: "citizen",
        eventType: "escalated",
        message: `Official grievance escalated to higher authority and RTI request drafted under RTI Act 2005.`,
        timestamp: new Date().toISOString(),
      });
      onUpdated();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to trigger auto-escalation.");
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="auto-escalation-panel" className="bg-white border rounded-2xl p-4 shadow-3xs flex flex-col gap-3">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5 text-rose-600">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Auto-Escalation & RTI Act Hub
        </h3>
        {escalation && (
          <span className="text-[9px] bg-rose-50 text-rose-700 font-extrabold px-2 py-0.5 rounded-full border border-rose-100">
            Escalated
          </span>
        )}
      </div>

      {error && (
        <p className="text-[10px] text-rose-600 font-semibold bg-rose-50 p-2 rounded-xl">
          {error}
        </p>
      )}

      {escalation ? (
        <div className="flex flex-col gap-3.5">
          <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-[10px] text-slate-500 font-semibold">
            Escalated to Higher Authority on <span className="text-slate-800">{new Date(escalation.escalatedAt).toLocaleDateString()}</span>. Official drafted petitions ready below:
          </div>

          {/* Escalation Letter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide">
                (A) Higher Grievance Appeal
              </span>
              <button
                onClick={() => copyText(escalation.escalationLetter, setCopiedEsc)}
                className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 cursor-pointer"
              >
                {copiedEsc ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedEsc ? "Copied" : "Copy Letter"}
              </button>
            </div>
            <pre className="text-[10px] bg-slate-50 p-3 rounded-xl max-h-36 overflow-y-auto font-mono text-slate-700 whitespace-pre-wrap border border-slate-200/50 leading-relaxed font-medium">
              {escalation.escalationLetter}
            </pre>
          </div>

          {/* RTI Request */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-extrabold text-[#D97706] uppercase tracking-wide flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" />
                (B) Section 6(1) RTI Request Act 2005
              </span>
              <button
                onClick={() => copyText(escalation.rtiRequest, setCopiedRti)}
                className="text-[9px] font-bold text-[#D97706] hover:text-[#92400E] flex items-center gap-1.5 cursor-pointer"
              >
                {copiedRti ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                {copiedRti ? "Copied" : "Copy RTI"}
              </button>
            </div>
            <pre className="text-[10px] bg-amber-50/20 p-3 rounded-xl max-h-36 overflow-y-auto font-mono text-slate-700 whitespace-pre-wrap border border-amber-200/30 leading-relaxed font-medium">
              {escalation.rtiRequest}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">
            Is this civic resolution lagging behind the standard SLA? Auto-escalate the complaint to top-tier state administrative heads and instantly formulate a legal RTI application directed to the PIO.
          </p>

          <button
            onClick={handleEscalate}
            disabled={loading || issue.status === "Resolved"}
            className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-2 shadow-2xs disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Drafting official RTI petitions...
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                Escalate Complaint & Draft RTI Petitions
              </>
            )}
          </button>
          <span className="text-[9px] text-center text-slate-400 font-bold block">
            Recommended if grievance exceeds SLA resolution limits
          </span>
        </div>
      )}
    </div>
  );
}
