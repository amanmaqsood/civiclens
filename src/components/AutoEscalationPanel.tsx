import React, { useState } from "react";
import { IssueReport } from "../types";
import { triggerAutoEscalation, recordIssueActivity } from "../services/issues";
import { ShieldAlert, Copy, Check, RefreshCw, Layers, Download, Clock } from "lucide-react";

interface AutoEscalationPanelProps {
  issue: IssueReport;
  onUpdated: () => void;
}

export default function AutoEscalationPanel({ issue, onUpdated }: AutoEscalationPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copiedEsc, setCopiedEsc] = useState(false);
  const [copiedRti, setCopiedRti] = useState(false);
  const [copiedAppeal, setCopiedAppeal] = useState(false);

  const escalation = issue.escalation;
  const ladder = issue.slaLadder;
  const slaLabel = issue.slaPolicy
    ? `${issue.slaPolicy.slaHours}h ${issue.slaPolicy.category}/S${issue.slaPolicy.severity}`
    : null;

  const handleEscalate = async () => {
    setLoading(true);
    setError(null);
    try {
      await triggerAutoEscalation(issue);
      await recordIssueActivity(issue.id, {
        actorType: "citizen",
        eventType: "escalated",
        message: `Draft escalation letter and RTI request prepared for human review. Nothing was submitted outside CivicLens.`,
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

  const copyText = async (text: string, setCopied: (v: boolean) => void) => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Copy failed. Select the draft text manually if clipboard permission is blocked.");
    }
  };

  return (
    <div 
      id="auto-escalation-panel" 
      className="bg-white border border-hairline rounded-2xl p-5 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] flex flex-col gap-4 font-sans text-ink"
    >
      <div className="flex items-center justify-between border-b border-hairline pb-3">
        <h3 className="flex items-center gap-1.5 text-base font-display font-bold text-alert select-none">
          <ShieldAlert className="w-4 h-4 text-alert" />
          Escalation & RTI Drafts
        </h3>
        {escalation && (
          <span className="rounded border border-alert/25 bg-alert/10 px-2 py-1 text-sm font-bold text-alert">
            Escalated
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-alert bg-alert/5 border border-alert/20 p-2.5 rounded-xl">
          {error}
        </p>
      )}
      {copyError && (
        <p role="alert" className="text-sm font-semibold text-alert bg-alert/5 border border-alert/20 p-2.5 rounded-xl">
          {copyError}
        </p>
      )}

      {(issue.slaDeadline || slaLabel || ladder?.currentStage) && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hairline bg-paper px-3 py-2 text-sm font-semibold text-slate">
          <Clock className="h-3.5 w-3.5 text-marigold" />
          {slaLabel && <span>{slaLabel}</span>}
          {issue.slaDeadline && <span>Due {new Date(issue.slaDeadline).toLocaleDateString()}</span>}
          {ladder?.currentStage && ladder.currentStage !== "none" && <span>Stage {ladder.currentStage.replace(/_/g, " ")}</span>}
        </div>
      )}

      {escalation ? (
        <div className="flex flex-col gap-3.5">
          <div className="bg-paper border border-hairline p-3 rounded-xl text-sm text-slate font-medium leading-relaxed">
            Escalation letter and RTI request drafted for manual review. Nothing was submitted to a government system. Drafts were prepared in CivicLens on <span className="text-ink font-semibold">{new Date(escalation.escalatedAt).toLocaleDateString()}</span>.
          </div>

          {/* Escalation Letter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono font-bold text-slate">
                (A) Higher Grievance Appeal Letter
              </span>
              <button
                type="button"
                onClick={() => copyText(escalation.escalationLetter, setCopiedEsc)}
                className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-bold text-slate hover:bg-white hover:text-ink"
              >
                {copiedEsc ? <Check className="w-3.5 h-3.5 text-verify" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEsc ? "Copied" : "Copy letter"}</span>
              </button>
            </div>
            <pre className="text-sm bg-paper p-3 rounded-xl max-h-36 overflow-y-auto font-mono text-ink/80 whitespace-pre-wrap border border-hairline leading-relaxed font-medium">
              {escalation.escalationLetter}
            </pre>
          </div>

          {/* RTI Request */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm font-mono font-bold text-marigold">
                <Layers className="w-3.5 h-3.5 text-marigold" />
                (B) Section 6(1) RTI Application
              </span>
              <div className="flex items-center gap-1">
                {escalation.rtiPdfDataUri && (
                  <a
                    href={escalation.rtiPdfDataUri}
                    download={escalation.rtiPdfFilename || "CivicLens-RTI-draft.pdf"}
                    className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-bold text-slate hover:bg-white hover:text-ink"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => copyText(escalation.rtiRequest || "", setCopiedRti)}
                  className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-bold text-slate hover:bg-white hover:text-ink"
                >
                  {copiedRti ? <Check className="w-3.5 h-3.5 text-verify" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedRti ? "Copied" : "Copy RTI"}</span>
                </button>
              </div>
            </div>
            <pre className="text-sm bg-paper p-3 rounded-xl max-h-36 overflow-y-auto font-mono text-ink/80 whitespace-pre-wrap border border-hairline leading-relaxed font-medium">
              {escalation.rtiRequest || "RTI draft pending the next SLA ladder step."}
            </pre>
          </div>

          {escalation.firstAppealLetter && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono font-bold text-slate">
                  (C) First Appeal Draft
                </span>
                <button
                  type="button"
                  onClick={() => copyText(escalation.firstAppealLetter || "", setCopiedAppeal)}
                  className="flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-sm font-bold text-slate hover:bg-white hover:text-ink"
                >
                  {copiedAppeal ? <Check className="w-3.5 h-3.5 text-verify" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAppeal ? "Copied" : "Copy appeal"}</span>
                </button>
              </div>
              <pre className="text-sm bg-paper p-3 rounded-xl max-h-36 overflow-y-auto font-mono text-ink/80 whitespace-pre-wrap border border-hairline leading-relaxed font-medium">
                {escalation.firstAppealLetter}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate leading-relaxed font-sans font-medium">
            If the case appears delayed, CivicLens can draft escalation and RTI text for a human to verify, copy, and file outside the app.
          </p>

          <button
            type="button"
            onClick={handleEscalate}
            disabled={loading || issue.status === "resolved"}
            className="w-full min-h-[44px] bg-alert hover:bg-alert/90 text-white text-base font-bold py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-2 border border-white/5 active:scale-[0.99] transition-all disabled:opacity-60"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Drafting review text...</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Draft Escalation and RTI</span>
              </>
            )}
          </button>
          <span className="block text-center text-sm font-semibold text-slate">
            Draft only - no external filing occurs
          </span>
        </div>
      )}
    </div>
  );
}
