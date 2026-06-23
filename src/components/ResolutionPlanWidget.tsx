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
      // 1. Fetch AI Resolution Coordinator response with Google Search Grounding
      const plan = await generateResolutionPlan(issue);

      // 2. Draft the companion Agent Trace steps to append on the issue
      const now = new Date().toISOString();
      const findAuthorityTrace: AgentTraceEntry = {
        step: "Find Authority",
        tool: "Gemini 2.5 Google Search Grounding (/api/resolution-plan)",
        status: "done",
        rationale: `Discovered and verified "${plan.recommendedAuthority}" as local responsible body. Channel route: "${plan.contactChannel}".`,
        ts: now
      };

      const draftPacketTrace: AgentTraceEntry = {
        step: "Draft Action Packet",
        tool: "Gemini Structured Compliance Compiler (/api/resolution-plan)",
        status: "done",
        rationale: `Drafted official form titled "${plan.actionPacket.subject}" with SLA threshold of ${plan.slaDays} days and action items.`,
        ts: new Date(Date.now() + 500).toISOString()
      };

      // 3. Persist plan and update traces in Firestore
      await updateIssueResolutionPlan(issue.id, plan, [findAuthorityTrace, draftPacketTrace]);

      // 4. Reload page context
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to compile compliance plan. Confirm key & try again.");
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
    <div id="resolution-coordinator-section" className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-4 shadow-3xs font-sans">
      {/* Plan not generated yet */}
      {!plan ? (
        <div className="flex flex-col gap-3 py-2 items-center text-center">
          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Compass className="w-5 h-5" />
          </div>
          <div className="flex flex-col gap-1.5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Resolution Planning Coordinator</h4>
            <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed">
              Verify legal Indian departments, typical service SLA guidelines, and auto-draft professional complaints using real-time search lookup.
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-1.5 bg-[#4F46E5] hover:bg-slate-900 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer hover:shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all duration-200"
            style={{ minHeight: "38px" }}
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Grounding Real-Time SLA Data...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Formulate Compliance SLA Plan</span>
              </>
            )}
          </button>
          {errorMsg && <p className="text-[10px] font-bold text-rose-500 mt-1">{errorMsg}</p>}
        </div>
      ) : (
        /* Plan summary view */
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Compliance Routing Plan</span>
            <span className="text-[9px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-sm border border-emerald-100 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              SLA Secured
            </span>
          </div>

          {/* Department Detail Cards */}
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-start gap-2 text-xs">
              <MapPin className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Responsible Authority</span>
                <span className="text-slate-800 font-extrabold">{plan.recommendedAuthority}</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Contact Route: <span className="font-bold underline text-indigo-600">{plan.contactChannel}</span></span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-slate-500 font-medium">Resolution SLA Timeline:</span>
              </div>
              <span className="font-mono font-extrabold text-[#4F46E5] text-[13px] bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                {plan.slaDays} Days
              </span>
            </div>
          </div>

          {/* Drafted Complaint Body */}
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Drafted Official Complaint</span>
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-1.5 text-[10px] text-indigo-600 hover:text-slate-900 border border-transparent hover:border-slate-100 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied Packet" : "Copy Form"}</span>
              </button>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-900">
              <span className="text-[10px] text-slate-500 font-bold block mb-1">Subject Line:</span>
              <p className="text-[11px] text-amber-200 font-medium mb-2 leading-relaxed border-b border-slate-850 pb-1.5">{plan.actionPacket.subject}</p>
              <span className="text-[10px] text-slate-500 font-bold block mb-1">Complaint Body:</span>
              <div className="max-h-28 overflow-y-auto text-[10.5px] text-slate-300 leading-relaxed whitespace-pre-wrap font-mono custom-scrollbar">
                {displayedBody}
              </div>
            </div>
          </div>

          {/* Action Steps */}
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Citizen Next Action Steps</span>
            <div className="flex flex-col gap-1.5">
              {plan.actionPacket.nextActions.map((act, i) => (
                <div key={i} className="flex gap-2 items-start text-[11px] text-slate-600">
                  <span className="w-4 h-4 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-600 shrink-0">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed font-medium">{act}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Grounding Reference URLs */}
          {plan.groundingSources && plan.groundingSources.length > 0 && (
            <div className="border-t pt-2.5 flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SLA Verification Sources (Search Grounding)</span>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {plan.groundingSources.map((src, i) => {
                  let domain = "Reference Source";
                  try {
                    domain = new URL(src).hostname.replace("www.", "");
                  } catch(e) {}
                  return (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[9px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md border border-indigo-100/50 cursor-pointer shadow-3xs transition-colors"
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
