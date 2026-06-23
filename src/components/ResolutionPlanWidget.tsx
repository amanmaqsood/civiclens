import React, { useState } from "react";
import { 
  ShieldCheck, 
  Sparkles, 
  Copy, 
  Check, 
  ExternalLink, 
  Compass, 
  MapPin, 
  Clock, 
  RefreshCw 
} from "lucide-react";
import { IssueReport, AgentTraceEntry, ResolutionPlan } from "../types";
import { generateResolutionPlan, updateIssueResolutionPlan } from "../services/issues";

interface ResolutionPlanProps {
  issue: IssueReport;
  onRefresh: () => void;
  lang?: "en" | "hi";
}

export default function ResolutionPlanWidget({ issue, onRefresh, lang = "en" }: ResolutionPlanProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const plan = await generateResolutionPlan(issue);

      const now = new Date().toISOString();
      const findAuthorityTrace: AgentTraceEntry = {
        step: "Find Authority",
        tool: "Gemini 2.5 Google Search Grounding (/api/resolution-plan)",
        status: "done",
        rationale: `Discovered and verified "${plan.recommendedAuthority}" as responsible agency. Channel route prescribed: "${plan.contactChannel}".`,
        ts: now
      };

      const draftPacketTrace: AgentTraceEntry = {
        step: "Draft Action Packet",
        tool: "Gemini Structured Compliance Compiler (/api/resolution-plan)",
        status: "done",
        rationale: `Drafted case packet titled "${plan.actionPacket.subject}" with SLA threshold of ${plan.slaDays} days.`,
        ts: new Date(Date.now() + 500).toISOString()
      };

      await updateIssueResolutionPlan(issue.id, plan, [findAuthorityTrace, draftPacketTrace]);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to formulate compliance SLA plan.");
    } finally {
      setLoading(false);
    }
  };

  const plan = issue.resolutionPlan;
  const displayedBody = (lang === "hi" && plan?.actionPacket.bodyHindi) ? plan.actionPacket.bodyHindi : plan?.actionPacket.body || "";

  const copyToClipboard = () => {
    if (!plan) return;
    navigator.clipboard.writeText(displayedBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      id="resolution-coordinator-section" 
      className="bg-white border border-hairline rounded-2xl p-5 flex flex-col gap-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] font-sans text-ink"
    >
      {!plan ? (
        <div className="flex flex-col gap-3.5 py-1 items-center text-center">
          <div className="w-10 h-10 rounded-full bg-paper border border-hairline flex items-center justify-center text-slate">
            <Compass className="w-5 h-5 text-marigold" />
          </div>
          <div className="flex flex-col gap-1">
            <h4 className="text-xs font-display font-bold uppercase tracking-wider text-ink">
              RESOLUTION PLAN
            </h4>
            <p className="text-[10.5px] text-slate max-w-xs leading-relaxed">
              Identify responsible agencies, typical SLA resolution thresholds, and structure official petitions using web-grounded research.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-1 w-full flex items-center justify-center gap-1.5 bg-marigold hover:bg-marigold/90 text-ink text-xs font-bold py-2.5 px-4 rounded-xl cursor-pointer disabled:bg-paper disabled:text-slate disabled:cursor-not-allowed transition-all duration-150 border border-hairline"
            style={{ minHeight: "38px" }}
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="font-mono text-[10.5px]">Extracting Jurisdictions...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Resolution Plan</span>
              </>
            )}
          </button>
          {errorMsg && <p className="text-[10px] font-mono text-alert mt-1">{errorMsg}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <span className="text-[9pt] font-mono uppercase text-slate">Government SLA Routing</span>
            <span className="text-[9px] font-mono font-semibold text-verify bg-verify/5 px-2 py-0.5 rounded border border-verify/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-verify" />
              SLA Locked
            </span>
          </div>

          {/* Department Detail Cards */}
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-paper border border-hairline p-3 rounded-xl flex items-start gap-2.5 text-xs">
              <MapPin className="w-4 h-4 text-marigold shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] font-mono text-slate uppercase tracking-wider">Department Contact</span>
                <span className="text-ink font-semibold mt-0.5 truncate">{plan.recommendedAuthority}</span>
                <span className="text-[9.5px] text-slate mt-1">Route: <span className="font-mono font-bold text-ink underline">{plan.contactChannel}</span></span>
              </div>
            </div>

            <div className="bg-paper border border-hairline p-3 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate shrink-0" />
                <span className="text-slate font-medium text-[10.5px]">Resolution threshold window:</span>
              </div>
              <span className="font-mono font-extrabold text-marigold text-[11.5px] bg-white border border-hairline px-2.5 py-0.5 rounded-full">
                {plan.slaDays} Days
              </span>
            </div>
          </div>

          {/* Drafted Complaint Body */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9pt] font-mono uppercase text-slate">Official Compliance Form</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 bg-paper hover:bg-white border border-hairline text-ink px-2.5 py-1 rounded-lg cursor-pointer text-[9.5px] transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-verify" /> : <Copy className="w-3 h-3" />}
                <span className="font-medium">{copied ? "Copied" : "Copy Form"}</span>
              </button>
            </div>
            <div className="bg-ink p-3.5 rounded-xl border border-white/5 text-paper">
              <span className="text-[8px] font-mono text-white/50 uppercase tracking-wider block mb-0.5">Subject Heading</span>
              <p className="text-[11px] text-marigold font-semibold mb-2.5 leading-relaxed border-b border-white/10 pb-2">{plan.actionPacket.subject}</p>
              <span className="text-[8px] font-mono text-white/50 uppercase tracking-wider block mb-1">Dossier body Text</span>
              <div className="max-h-24 overflow-y-auto text-[10.5px] text-paper/85 leading-relaxed whitespace-pre-wrap font-mono select-all">
                {displayedBody}
              </div>
            </div>
          </div>

          {/* SLA Next steps */}
          <div className="flex flex-col gap-1.5 mt-0.5">
            <span className="text-[9pt] font-mono uppercase text-slate">Action Items List</span>
            <div className="flex flex-col gap-2">
              {plan.actionPacket.nextActions.map((act, i) => (
                <div key={i} className="flex gap-2.5 items-start text-[11px] text-ink/80 leading-normal">
                  <span className="w-4.5 h-4.5 bg-paper border border-hairline rounded-full flex items-center justify-center text-[9px] font-mono text-ink font-semibold shrink-0">
                    0{i + 1}
                  </span>
                  <span className="mt-0.5">{act}</span>
                </div>
              ))}
            </div>
          </div>

          {/* SLA Research footnotes */}
          {plan.groundingSources && plan.groundingSources.length > 0 && (
            <div className="border-t border-hairline pt-3 flex flex-col gap-1.5">
              <span className="text-[8px] font-mono uppercase tracking-wider text-slate">Grounding reference links</span>
              <div className="flex flex-wrap gap-1.5">
                {plan.groundingSources.map((src, i) => {
                  let domain = "Government Portal";
                  try {
                    domain = new URL(src).hostname.replace("www.", "");
                  } catch(e) {}
                  return (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[9px] font-mono text-slate hover:text-ink underline transition-colors cursor-pointer"
                    >
                      <span>{domain}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    </a>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
