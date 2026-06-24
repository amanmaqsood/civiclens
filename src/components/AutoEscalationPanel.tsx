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
    <div 
      id="auto-escalation-panel" 
      className="bg-white border border-hairline rounded-2xl p-5 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] flex flex-col gap-4 font-sans text-ink"
    >
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <h3 className="text-xs font-display font-bold uppercase tracking-wider flex items-center gap-1.5 text-alert select-none">
          <ShieldAlert className="w-4 h-4 text-alert" />
          Auto-Escalation & RTI Act Hub
        </h3>
        {escalation && (
          <span className="text-[9px] font-mono bg-alert/10 text-alert font-bold px-2 py-0.5 rounded border border-alert/25 uppercase tracking-wide">
            Escalated
          </span>
        )}
      </div>

      {error && (
        <p className="text-[10px] font-mono text-alert bg-alert/5 border border-alert/20 p-2.5 rounded-xl">
          {error}
        </p>
      )}

      {escalation ? (
        <div className="flex flex-col gap-3.5">
          <div className="bg-paper border border-hairline p-3 rounded-xl text-[10px] text-slate font-medium leading-relaxed">
            Escalation letter & RTI petition drafted (not submitted) — review and file manually. Case flagged as escalated on CivicLens on <span className="text-ink font-semibold">{new Date(escalation.escalatedAt).toLocaleDateString()}</span>. Compiled appeal packets are prepared below:
          </div>

          {/* Escalation Letter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold text-slate uppercase tracking-wide">
                (A) Higher Grievance Appeal Letter
              </span>
              <button
                onClick={() => copyText(escalation.escalationLetter, setCopiedEsc)}
                className="text-[9px] font-mono text-slate hover:text-ink flex items-center gap-1 cursor-pointer"
              >
                {copiedEsc ? <Check className="w-3.5 h-3.5 text-verify" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEsc ? "Copied" : "Copy letter"}</span>
              </button>
            </div>
            <pre className="text-[10px] bg-paper p-3 rounded-xl max-h-36 overflow-y-auto font-mono text-ink/80 whitespace-pre-wrap border border-hairline leading-relaxed font-medium">
              {escalation.escalationLetter}
            </pre>
          </div>

          {/* RTI Request */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-mono font-bold text-marigold uppercase tracking-wide flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-marigold" />
                (B) Section 6(1) RTI Application
              </span>
              <button
                onClick={() => copyText(escalation.rtiRequest, setCopiedRti)}
                className="text-[9px] font-mono text-slate hover:text-ink flex items-center gap-1 cursor-pointer"
              >
                {copiedRti ? <Check className="w-3.5 h-3.5 text-verify" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRti ? "Copied" : "Copy RTI"}</span>
              </button>
            </div>
            <pre className="text-[10px] bg-paper p-3 rounded-xl max-h-36 overflow-y-auto font-mono text-ink/80 whitespace-pre-wrap border border-hairline leading-relaxed font-medium">
              {escalation.rtiRequest}
            </pre>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[10.5px] text-slate leading-relaxed font-sans font-medium">
            Lagging resolution SLA? Escalate this dossier case instantly to top-tier state administrative bodies and draft a legal RTI petition directed to the Public Information Officer (PIO).
          </p>

          <button
            onClick={handleEscalate}
            disabled={loading || issue.status === "Resolved"}
            className="w-full bg-alert hover:bg-alert/90 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-2 border border-white/5 active:scale-[0.99] transition-all"
            style={{ minHeight: "38px" }}
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Formulating Legal appeals...</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Escalate & Draft RTI Petitions</span>
              </>
            )}
          </button>
          <span className="text-[8.5px] text-center text-slate font-semibold block uppercase tracking-wider font-mono">
            Recommended if grievance exceeds SLA resolution limits
          </span>
        </div>
      )}
    </div>
  );
}
