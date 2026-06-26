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
import { IssueReport } from "../types";
import { updateIssueResolutionPlan } from "../services/issues";

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
      await updateIssueResolutionPlan(issue.id);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to draft the authority plan.");
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
              Draft a possible authority contact, follow-up window, and complaint text for a human to verify before use.
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
                <span className="font-mono text-[10.5px]">Researching options...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Draft Plan</span>
              </>
            )}
          </button>
          {errorMsg && <p className="text-[10px] font-mono text-alert mt-1">{errorMsg}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <span className="text-[9pt] font-mono uppercase text-slate">Draft authority plan</span>
            <span className="text-[9px] font-mono font-semibold text-verify bg-verify/5 px-2 py-0.5 rounded border border-verify/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-verify" />
              Needs review
            </span>
          </div>

          {/* Department Detail Cards */}
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-paper border border-hairline p-3 rounded-xl flex items-start gap-2.5 text-xs">
              <MapPin className="w-4 h-4 text-marigold shrink-0 mt-0.5" />
              <div className="flex flex-col min-w-0">
                <span className="text-[8px] font-mono text-slate uppercase tracking-wider">Suggested contact</span>
                <span className="text-ink font-semibold mt-0.5 truncate">{plan.recommendedAuthority}</span>
                <span className="text-[9.5px] text-slate mt-1">Draft channel: <span className="font-mono font-bold text-ink underline">{plan.contactChannel}</span></span>
              </div>
            </div>

            <div className="bg-paper border border-hairline p-3 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate shrink-0" />
                <span className="text-slate font-medium text-[10.5px]">Suggested follow-up window:</span>
              </div>
              <span className="font-mono font-extrabold text-marigold text-[11.5px] bg-white border border-hairline px-2.5 py-0.5 rounded-full">
                {plan.slaDays} Days
              </span>
            </div>
          </div>

          {/* Drafted Complaint Body */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[9pt] font-mono uppercase text-slate">Draft complaint text</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1 bg-paper hover:bg-white border border-hairline text-ink px-2.5 py-1 rounded-lg cursor-pointer text-[9.5px] transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-verify" /> : <Copy className="w-3 h-3" />}
                <span className="font-medium">{copied ? "Copied" : "Copy Draft"}</span>
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

          {/* Suggested next steps */}
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

          {/* Research footnotes */}
          {plan.groundingSources && plan.groundingSources.length > 0 && (
            <div className="border-t border-hairline pt-3 flex flex-col gap-1.5">
              <span className="text-[8px] font-mono uppercase tracking-wider text-slate">Grounding reference links</span>
              <div className="flex flex-wrap gap-1.5">
                {plan.groundingSources.map((src, i) => {
                  const sourceUrl = typeof src === "string" ? src : src.url;
                  const sourceTitle = typeof src === "string" ? "" : src.title;
                  const sourceClaim = typeof src === "string" ? "" : src.claimSupported;
                  let domain = "Reference link";
                  try {
                    domain = new URL(sourceUrl).hostname.replace("www.", "");
                  } catch(e) {}
                  return (
                    <a
                      key={i}
                      href={sourceUrl || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={sourceClaim || sourceTitle || domain}
                      className="flex items-center gap-1 text-[9px] font-mono text-slate hover:text-ink underline transition-colors cursor-pointer"
                    >
                      <span>{sourceTitle || domain}</span>
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
