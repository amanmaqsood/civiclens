import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowUp, MapPin, AlertCircle, ShieldAlert, BadgeInfo, Clock, RefreshCw, Sparkles } from "lucide-react";
import { IssueReport, IssueActivity } from "../types";
import { fetchIssueActivities } from "../services/issues";
import PriorityBreakdownWidget from "./PriorityBreakdownWidget";
import VerificationPanel from "./VerificationPanel";
import AgentTraceTimeline from "./AgentTraceTimeline";
import ResolutionPlanWidget from "./ResolutionPlanWidget";
import AutoEscalationPanel from "./AutoEscalationPanel";

interface IssueDetailPageProps {
  issue: IssueReport;
  onBack: () => void;
  onUpvote: (id: string) => Promise<void>;
  upvoteLoadingId: string | null;
  onRefresh: () => void;
}

const STATUS_STEPS = ["Submitted", "Verified", "In Progress", "Resolved"] as const;

export default function IssueDetailPage({
  issue,
  onBack,
  onUpvote,
  upvoteLoadingId,
  onRefresh,
}: IssueDetailPageProps) {
  const getSeverityLabel = (severity?: number) => {
    const s = severity || 3;
    if (s <= 2) return { text: `Low (Level ${s}/5)`, color: "bg-emerald-50 text-emerald-700 border-emerald-100" };
    if (s === 3) return { text: `Medium (Level ${s}/5)`, color: "bg-amber-50 text-amber-700 border-amber-100" };
    return { text: `High (Level ${s}/5)`, color: "bg-rose-50 text-rose-700 border-rose-100" };
  };

  const getUrgencyColor = (urgency?: string) => {
    switch (urgency) {
      case "urgent":
        return "bg-red-100 text-red-800 border-red-200";
      case "priority":
        return "bg-amber-100 text-amber-800 border-amber-200 font-bold";
      default:
        return "bg-slate-100 text-slate-800 border-slate-200";
    }
  };

  const severityBadge = getSeverityLabel(issue.severity);
  const currentStatusIndex = STATUS_STEPS.indexOf(issue.status as any);

  const [activities, setActivities] = useState<IssueActivity[]>([]);
  const [loadingAct, setLoadingAct] = useState(true);
  const [lang, setLang] = useState<"en" | "hi">("en");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingAct(true);
      try {
        const data = await fetchIssueActivities(issue.id);
        if (active) setActivities(data);
      } catch (err) {
        console.error("Failed to load activities in detail page:", err);
      } finally {
        if (active) setLoadingAct(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [issue.id]);

  return (
    <div id="issue-detail-page" className="flex flex-col gap-5 px-4 py-5 font-sans animate-fade-in pb-16 bg-slate-50 min-h-screen">
      {/* Back Button and Title Bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            id="detail-back-btn"
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-slate-200 shadow-3xs cursor-pointer hover:bg-slate-50 transition-colors"
            aria-label="Back to feed"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Complaint Detail</span>
            <h2 className="text-sm font-bold text-slate-800 leading-tight">Ticket: {issue.ticketId}</h2>
          </div>
        </div>

        {/* English/Hindi language toggle */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-sans font-bold select-none">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              lang === "en" ? "bg-white text-slate-800 shadow-3xs" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
              lang === "hi" ? "bg-white text-slate-800 shadow-3xs" : "text-slate-400 hover:text-slate-600"
            }`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* Main Evidence Image Card */}
      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-xs">
        {issue.image ? (
          <div className="aspect-video w-full bg-slate-900 relative">
            <img
              src={issue.image}
              alt={issue.title || "Complaint Evidence"}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {/* Overlay Category badge */}
            <span className="absolute left-3 top-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
              {issue.category}
            </span>
            {issue.isDemoData && (
              <span className="absolute right-3 top-3 bg-amber-500 text-white text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-1 rounded-full border border-amber-600 shadow-sm">
                Demo Issue
              </span>
            )}
          </div>
        ) : (
          <div className="aspect-video w-full bg-slate-100 flex items-center justify-center text-slate-400">
            <p className="text-xs font-semibold">No proof image uploaded</p>
          </div>
        )}

        <div className="p-4 flex flex-col gap-3">
          {/* AI title and confidence score */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-base font-bold text-slate-900 leading-snug">
              {lang === "hi" && issue.resolutionPlan?.actionPacket.subject
                ? issue.resolutionPlan.actionPacket.subject
                : (issue.title || "Geotagged Civic Incident")}
            </h1>
            {issue.confidence !== undefined && (
              <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-sm border border-indigo-100/50 flex-shrink-0">
                {(issue.confidence * 100).toFixed(0)}% AI Match
              </span>
            )}
          </div>

          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap">
            {lang === "hi"
              ? (issue.resolutionPlan?.actionPacket.summaryHindi || `[हिन्दी अनुवाद के लिए पहले नीचे से 'Formulate Compliance SLA Plan' संकलित करें] \n\n${issue.summary || issue.description}`)
              : (issue.summary || issue.description)}
          </p>

          {/* Severity & Urgency Widgets */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className={`border p-2.5 rounded-xl flex flex-col gap-0.5 ${severityBadge.color}`}>
              <span className="text-[9px] uppercase tracking-wider font-bold opacity-75">AI Severity</span>
              <span className="text-xs font-extrabold">{severityBadge.text}</span>
            </div>
            <div className={`border p-2.5 rounded-xl flex flex-col gap-0.5 ${getUrgencyColor(issue.urgency)}`}>
              <span className="text-[9px] uppercase tracking-wider font-bold opacity-75">Triage Status</span>
              <span className="text-xs font-extrabold capitalize">{issue.urgency || "routine"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Agent Trace Signatures */}
      <AgentTraceTimeline trace={issue.agentTrace} />

      {/* AI Hazards and Context Details */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-3.5 shadow-3xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <ShieldAlert className="w-4 h-4 text-[#4F46E5]" />
          Visual & Risk Diagnostics
        </h3>

        <div className="flex flex-col gap-3 text-xs text-slate-600">
          {/* Hazard Tags */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identified Hazards</span>
            {issue.visibleHazards && issue.visibleHazards.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {issue.visibleHazards.map((tag) => (
                  <span key={tag} className="bg-rose-50 border border-rose-100 text-rose-700 text-[10px] py-0.5 px-2 rounded-md font-medium">
                    ⚠️ {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 italic text-[11px]">No immediate public hazards detected.</span>
            )}
          </div>

          {/* Privacy Flags */}
          <div className="flex flex-col gap-1.5 mt-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Privacy & Redactions</span>
            {issue.privacyFlags && issue.privacyFlags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {issue.privacyFlags.map((flag) => (
                  <span key={flag} className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] py-0.5 px-2 rounded-md font-medium">
                    🚫 {flag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 italic text-[11px]">No privacy exclusions triggered.</span>
            )}
          </div>

          {/* Affected Footprint */}
          {issue.affectedArea && (
            <div className="flex items-center justify-between border-t border-slate-50 pt-2.5 mt-1 text-[11px]">
              <span className="font-bold text-slate-400 uppercase tracking-wider">Estimated Area Impact</span>
              <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded-sm capitalize">
                {issue.affectedArea.replace("_", " ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Prominent Closure Verdict Box */}
      {issue.closureAssessment && (
        <div id="closure-verdict-box" className="p-4 bg-white border border-slate-200/60 rounded-2xl shadow-3xs flex flex-col gap-3 font-sans">
          <div className="flex items-center justify-between border-b border-slate-150 pb-2">
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              AI Repair Verification Verdict
            </h3>
            <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
              issue.closureAssessment.resolved
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
              {issue.closureAssessment.resolved ? "Resolved / Closed" : "Reopened"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-0.5">
            <div className="relative rounded-xl overflow-hidden border border-slate-100">
              <img src={issue.image} alt="Before" className="w-full aspect-video object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/90 to-transparent p-1.5">
                <span className="text-[8px] text-white font-bold tracking-wider uppercase">Before Incident</span>
              </div>
            </div>
            {issue.closureAssessment.afterImage && (
              <div className="relative rounded-xl overflow-hidden border border-slate-105">
                <img src={issue.closureAssessment.afterImage} alt="After" className="w-full aspect-video object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/90 to-transparent p-1.5">
                  <span className="text-[8px] text-white font-bold tracking-wider uppercase">After Verification</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-250/20">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Confidence Score</span>
                <span className="font-bold text-[#4F46E5]">{(issue.closureAssessment.confidence * 100).toFixed(0)}% Visual Match</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-slate-400 uppercase tracking-widest text-[8px]">Type</span>
                <span className="font-extrabold text-indigo-750 uppercase">{issue.closureAssessment.recommendation.replace("_", " ")}</span>
              </div>
            </div>
            <div className="text-slate-600 leading-relaxed font-semibold text-[10.5px] p-2 bg-white rounded-lg border border-slate-200/55 mt-1 italic">
              "{issue.closureAssessment.explanation}"
            </div>
          </div>
        </div>
      )}

      {/* Geolocational Anchor Card */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-2 shadow-3xs">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Captured Location</span>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-[#4F46E5] flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 leading-tight">
              {issue.locationName || "Reported Location"}
            </p>
            {issue.lat !== undefined && issue.lng !== undefined && (
              <span className="text-[9px] font-mono text-slate-400 mt-0.5 block">
                GPS: {issue.lat.toFixed(5)}, {issue.lng.toFixed(5)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Upvotes & Support Bar */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex items-center justify-between shadow-3xs">
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Community Voice</span>
          <span className="text-xs font-bold text-slate-800 mt-0.5">{issue.citizenUpvotes} citizens backed this</span>
        </div>
        <button
          type="button"
          disabled={upvoteLoadingId === issue.id}
          onClick={() => onUpvote(issue.id)}
          className="flex items-center gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
          style={{ minHeight: "38px" }}
        >
          <ArrowUp className="w-4 h-4" />
          <span>{upvoteLoadingId === issue.id ? "Voting..." : "Support Report"}</span>
        </button>
      </div>

      {/* Community Verification Panel (Confirm/Dispute & Status controls) */}
      <VerificationPanel issue={issue} onRefresh={onRefresh} />

      {/* Auto-Escalation & RTI Act Hub (available for non-Resolved issues) */}
      {issue.status !== "Resolved" && (
        <AutoEscalationPanel issue={issue} onUpdated={onRefresh} />
      )}

      {/* SLA Resolution Plan Generator Widget */}
      <ResolutionPlanWidget issue={issue} onRefresh={onRefresh} lang={lang} />

      {/* Deterministic Priority Score & Factor Breakdown Widget */}
      <PriorityBreakdownWidget issue={issue} />

      {/* Interactive Status Timeline */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-4 shadow-3xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Resolution Timeline</h3>
        <div className="relative flex justify-between items-center px-2">
          {/* Timeline background bar */}
          <div className="absolute top-1/2 left-4 right-4 h-1 bg-slate-100 -translate-y-1/2 z-0" />
          {/* Timeline active fill */}
          <div
            className="absolute top-1/2 left-4 h-1 bg-emerald-500 -translate-y-1/2 z-0 transition-all duration-500"
            style={{
              width: `${(currentStatusIndex / (STATUS_STEPS.length - 1)) * 88}%`,
            }}
          />

          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = currentStatusIndex >= idx;
            const isCurrent = currentStatusIndex === idx;

            return (
              <div key={step} className="flex flex-col items-center gap-1.5 z-10 relative">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all duration-300 ${
                    isCompleted
                      ? isCurrent
                        ? "bg-amber-400 text-slate-900 border-amber-500 shadow-xs scale-110"
                        : "bg-emerald-500 text-white border-emerald-600"
                      : "bg-white text-slate-400 border-slate-200"
                  }`}
                >
                  {idx + 1}
                </div>
                <span className={`text-[9px] font-bold ${isCurrent ? "text-slate-800 font-extrabold" : isCompleted ? "text-emerald-600" : "text-slate-400"}`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Audit History Trail */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-4 flex flex-col gap-3 shadow-3xs">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <Clock className="w-4 h-4 text-slate-500" />
          Audit History Trail (Official Pipeline)
        </h3>

        {loadingAct ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-4 h-4 animate-spin text-slate-300" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center font-medium py-2">
            No audit actions recorded for this complaint.
          </p>
        ) : (
          <div className="flex flex-col gap-3.5 pl-3.5 border-l border-slate-100 relative">
            {activities.map((act) => (
              <div key={act.id} className="relative flex flex-col gap-0.5">
                <div className="absolute -left-[20.5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white" />
                <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wide">
                  {act.actorType === "operator" ? "👨‍✈️ Simulated Operator" : "👤 Citizen"}
                </span>
                <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">
                  {act.message}
                </p>
                <span className="text-[9px] font-mono text-slate-400 mt-0.5">
                  {new Date(act.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
