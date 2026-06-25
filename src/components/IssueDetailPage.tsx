import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowUp, MapPin, ShieldAlert, Clock, RefreshCw, Sparkles } from "lucide-react";
import { IssueReport, IssueActivity } from "../types";
import { fetchIssueActivities, updateIssueAgentTraceAndPlan, findDuplicateCandidates } from "../services/issues";
import { useLanguage } from "../context/LanguageContext";
import PriorityBreakdownWidget from "./PriorityBreakdownWidget";
import VerificationPanel from "./VerificationPanel";
import AgentTraceTimeline from "./AgentTraceTimeline";
import ResolutionPlanWidget from "./ResolutionPlanWidget";
import AutoEscalationPanel from "./AutoEscalationPanel";
import { humanizeCategory, humanizeUrgency } from "../utils/humanize";

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
  // Exact severity color mapping: "Severity 1-2 verify, 3 marigold, 4 #F2683B, 5 alert."
  const getSeverityStyle = (severity?: number) => {
    const s = severity || 3;
    if (s <= 2) {
      return {
        text: `Low (Level ${s}/5)`,
        classes: "bg-verify/10 text-verify border-verify/20",
      };
    }
    if (s === 3) {
      return {
        text: `Medium (Level ${s}/5)`,
        classes: "bg-marigold/10 text-marigold border-marigold/20",
      };
    }
    if (s === 4) {
      return {
        text: `High (Level ${s}/5)`,
        classes: "bg-[#F2683B]/10 text-[#F2683B] border-[#F2683B]/20",
      };
    }
    return {
      text: `Critical (Level ${s}/5)`,
      classes: "bg-alert/10 text-alert border-alert/20",
    };
  };

  const getUrgencyClasses = (urgency?: string) => {
    switch (urgency) {
      case "urgent":
        return "bg-alert/10 text-alert border-alert/20";
      case "priority":
        return "bg-marigold/10 text-marigold border-marigold/20 font-bold";
      default:
        return "bg-slate/10 text-slate border-slate/20";
    }
  };

  const severityInfo = getSeverityStyle(issue.severity);
  const currentStatusIndex = STATUS_STEPS.indexOf(issue.status as any);

  const [activities, setActivities] = useState<IssueActivity[]>([]);
  const [loadingAct, setLoadingAct] = useState(true);
  
  const { language: lang, setLanguage: setLang, t } = useLanguage();
  const [translating, setTranslating] = useState(false);

  const [triageRunning, setTriageRunning] = useState(false);
  const [triageError, setTriageError] = useState<string | null>(null);
  const [liveTraceSteps, setLiveTraceSteps] = useState<any[]>([]);

  const handleRunTriage = async () => {
    setTriageRunning(true);
    setTriageError(null);
    setLiveTraceSteps([]);

    try {
      const localCandidates = await findDuplicateCandidates(issue);

      const agentRunResponse = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue: {
            category: issue.category || "other",
            severity: issue.severity || 3,
            urgency: issue.urgency || "routine",
            title: issue.title || "Civic Incident",
            summary: issue.summary || issue.description || "No description",
            locationName: issue.locationName || "Default Civic Landmark",
            confirmCount: issue.citizenUpvotes || 0,
            reportCount: 1,
          },
          candidates: localCandidates.map(c => ({
            id: c.issue.id,
            title: c.issue.title,
            category: c.issue.category,
            locationName: c.issue.locationName,
            distanceM: c.distance || 0,
          })),
        }),
      });

      if (!agentRunResponse.ok) {
        const errText = await agentRunResponse.text().catch(() => "Unknown error");
        throw new Error(errText || "Failed to call AI Triage Agent.");
      }

      const agentResult = await agentRunResponse.json();
      if (!agentResult.success) {
        throw new Error(agentResult.error || "Server-side agent triage returned unsuccessful.");
      }

      const baseSteps = (issue.agentTrace || []).filter(
        (step: any) => step.step === "Perceive" || step.step === "Locate" || step.step === "Deduplicate"
      );
      if (baseSteps.length === 0) {
        baseSteps.push({
          step: "Perceive",
          tool: "Manual form input: the citizen entered issue category, title, and description manually.",
          status: "done",
          ts: new Date().toISOString(),
          rationale: "Initial visual/text input registered."
        }, {
          step: "Locate",
          tool: "GPS Geo-locator (Navigator API)",
          status: "done",
          ts: new Date().toISOString(),
          rationale: `Located at ${issue.locationName || "specified landmark"}`
        });
      }

      let currentTrace = [...baseSteps];
      for (const step of agentResult.steps) {
        currentTrace = [...currentTrace, step];
        setLiveTraceSteps(currentTrace);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      let finalPriorityScore = agentResult.final?.priorityScore;
      if (!finalPriorityScore) {
        const scoreStep = agentResult.steps.find((s: any) => s.step === "calculate_priority" || s.step === "Prioritize");
        if (scoreStep) {
          try {
            const parsedScore = JSON.parse(scoreStep.outputSummary);
            finalPriorityScore = parsedScore.score || parsedScore.priorityScore;
          } catch (e) {
            const match = String(scoreStep.outputSummary).match(/score"?:\s*([0-9.]+)/i);
            if (match) finalPriorityScore = parseFloat(match[1]);
          }
        }
      }

      await updateIssueAgentTraceAndPlan(
        issue.id,
        currentTrace,
        agentResult.resolutionPlan || null,
        finalPriorityScore !== undefined ? finalPriorityScore : undefined
      );

      onRefresh();

    } catch (err: any) {
      console.error("AI Triage error:", err);
      setTriageError(err.message || "An unexpected error occurred during AI triage. Please try again.");
    } finally {
      setTriageRunning(false);
    }
  };

  useEffect(() => {
    if (lang === "hi" && (!issue.titleHi || !issue.summaryHi) && !translating) {
      setTranslating(true);
      const translateContent = async () => {
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: issue.title || "Geotagged Civic Incident",
              summary: issue.summary || issue.description || ""
            })
          });
          const json = await res.json();
          if (json.success && json.data) {
            const { titleHi, summaryHi } = json.data;
            const { updateIssueTranslations } = await import("../services/issues");
            await updateIssueTranslations(issue.id, titleHi, summaryHi);
            onRefresh();
          }
        } catch (err) {
          console.error("Failed to translate dynamically:", err);
        } finally {
          setTranslating(false);
        }
      };
      translateContent();
    }
  }, [lang, issue.id, issue.title, issue.summary, issue.description, issue.titleHi, issue.summaryHi, translating, onRefresh]);

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
    <div 
      id="issue-detail-page" 
      className="flex flex-col gap-4 px-4 py-4 font-sans animate-fade-in pb-16 bg-paper min-h-screen text-ink"
    >
      {/* Back Button and Case Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            id="detail-back-btn"
            onClick={onBack}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-white border border-hairline shadow-2xs cursor-pointer hover:bg-paper transition-colors"
            style={{ minWidth: "36px", minHeight: "36px" }}
            aria-label="Back to landing"
          >
            <ArrowLeft className="w-4 h-4 text-ink" />
          </button>
          <div>
            <span className="text-xs font-mono uppercase text-slate tracking-wider block">
              REPORT
            </span>
            <h2 className="text-xs font-mono font-semibold text-ink uppercase tracking-tight">
              ID: {issue.ticketId}
            </h2>
          </div>
        </div>

        {/* Translation Switch segment */}
        <div className="flex bg-white border border-hairline p-0.5 rounded-lg text-[9px] font-mono font-bold select-none">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              lang === "en" ? "bg-ink text-paper shadow-2xs" : "text-slate hover:text-ink"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
              lang === "hi" ? "bg-ink text-paper shadow-2xs" : "text-slate hover:text-ink"
            }`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* Main Evidence Visual Block */}
      <div className="bg-white border border-hairline rounded-2xl overflow-hidden shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        {issue.image ? (
          <div className="aspect-video w-full bg-ink relative overflow-hidden select-none">
            <img
              src={issue.image}
              alt={issue.title || "Complaint Evidence"}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            {/* Category overlays */}
            <span className="absolute left-3 top-3 bg-ink/75 backdrop-blur-xs text-white text-xs font-sans uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-white/10">
              {humanizeCategory(issue.category)}
            </span>
            {issue.isDemoData && (
              <span className="absolute right-3 top-3 bg-marigold text-ink text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-white/10 select-none">
                Demo
              </span>
            )}
          </div>
        ) : (
          <div className="aspect-video w-full bg-paper flex items-center justify-center text-slate border-b border-hairline">
            <p className="text-xs font-medium">No incident photograph uploaded</p>
          </div>
        )}

        <div className="p-4 flex flex-col gap-2.5">
          {/* Headline analysis state */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-sm font-semibold text-ink leading-snug animate-fade-in">
              {lang === "hi"
                ? (issue.titleHi || issue.title || "Geotagged Civic Incident")
                : (issue.title || "Geotagged Civic Incident")}
            </h1>
            {issue.confidence !== undefined && (
              <span className="text-[9px] font-mono bg-paper text-ink font-semibold px-2 py-0.5 rounded border border-hairline flex-shrink-0">
                AI Confidence {(issue.confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate leading-relaxed bg-paper/50 p-3 rounded-xl border border-hairline/80 whitespace-pre-wrap animate-fade-in">
            {lang === "hi"
              ? (issue.summaryHi || issue.summary || issue.description)
              : (issue.summary || issue.description)}
          </p>

          {/* Severity & SLA Widgets */}
          <div className="grid grid-cols-2 gap-2 mt-0.5">
            <div className={`border p-2.5 rounded-xl flex flex-col gap-0.5 ${severityInfo.classes}`}>
              <span className="text-xs font-mono uppercase tracking-wider opacity-75">AI Severity</span>
              <span className="text-[13px] font-bold">{severityInfo.text}</span>
            </div>
            <div className={`border p-2.5 rounded-xl flex flex-col gap-0.5 ${getUrgencyClasses(issue.urgency)}`}>
              <span className="text-xs font-mono uppercase tracking-wider opacity-75">Urgency</span>
              <span className="text-[13px] font-bold capitalize">{humanizeUrgency(issue.urgency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Triage Agent Control Panel */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-3 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <div className="flex items-center justify-between border-b border-hairline pb-2.5">
          <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-marigold" />
            AI Triage Agent
          </h3>
          {issue.agentTrace && issue.agentTrace.length > 0 && (
            <span className="text-[9px] font-mono bg-verify/10 text-verify px-2 py-0.5 rounded border border-verify/20">
              Triaged
            </span>
          )}
        </div>

        <p className="text-xs text-slate leading-relaxed">
          Run the full server-side agentic function-calling triage loop. The agent will calculate deterministic priority, detect duplicates in the neighborhood, consult live municipal records to locate the responsible authority, and draft official complaint packets with translations.
        </p>

        {/* Error message */}
        {triageError && (
          <div className="bg-alert/5 border border-alert/20 rounded-xl p-3 text-xs text-alert flex flex-col gap-2">
            <span className="font-semibold">Triage Execution Failed:</span>
            <span>{triageError}</span>
            <button
              onClick={handleRunTriage}
              className="text-left underline font-bold cursor-pointer hover:opacity-85 text-alert"
            >
              Retry Triage Loop
            </button>
          </div>
        )}

        {/* Action Button */}
        {!triageRunning && (
          <button
            onClick={handleRunTriage}
            className="flex items-center justify-center gap-2 bg-ink text-paper hover:bg-ink/90 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-marigold animate-pulse" />
            <span>
              {issue.agentTrace && issue.agentTrace.length > 0 ? "Re-run AI Triage Agent" : "Run AI Triage Agent"}
            </span>
          </button>
        )}

        {triageRunning && (
          <div className="flex items-center justify-center gap-2 py-2 bg-paper rounded-xl border border-hairline">
            <RefreshCw className="w-4 h-4 animate-spin text-marigold" />
            <span className="text-xs font-mono text-slate uppercase tracking-wider">Executing AI Agent...</span>
          </div>
        )}
      </div>

      {/* vertical timeline audit trace */}
      <AgentTraceTimeline trace={triageRunning ? liveTraceSteps : issue.agentTrace} />

      {/* Visual risk diagnosis */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-3 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider flex items-center gap-1.5 border-b border-hairline pb-2.5">
          <ShieldAlert className="w-4 h-4 text-alert" />
          {t("detail.hazard")}
        </h3>

        <div className="flex flex-col gap-3 text-xs text-ink/80">
          {/* Hazards */}
          <div className="flex flex-col gap-1">
            <span className="text-[9pt] font-mono uppercase text-slate">Identified Hazards</span>
            {issue.visibleHazards && issue.visibleHazards.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {issue.visibleHazards.map((tag) => (
                  <span key={tag} className="bg-alert/5 border border-alert/20 text-alert text-[10px] py-0.5 px-2 rounded font-medium">
                    ⚠️ {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate italic text-[10.5px]">No public hazards detected.</span>
            )}
          </div>

          {/* Privacy Redactions */}
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-[9pt] font-mono uppercase text-slate">Redaction & De-identifier Markers</span>
            {issue.privacyFlags && issue.privacyFlags.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {issue.privacyFlags.map((flag) => (
                  <span key={flag} className="bg-slate/5 border border-slate/20 text-slate text-[10px] py-0.5 px-2 rounded font-medium">
                    🚫 {flag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate italic text-[10.5px]">No sensitive data tags flagged.</span>
            )}
          </div>

          {/* Footprints */}
          {issue.affectedArea && (
            <div className="flex items-center justify-between border-t border-hairline pt-2.5 mt-1 text-[11px]">
              <span className="font-mono text-slate uppercase text-[9pt]">Calculated Impact Boundaryed</span>
              <span className="bg-paper text-ink border border-hairline font-bold px-2 py-0.5 rounded capitalize font-sans text-[10.5px]">
                {issue.affectedArea.replace("_", " ")}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Prominent Closure Verification Box (After Image comparative) */}
      {issue.closureAssessment && (
        <div id="closure-verdict-box" className="p-4 bg-white border border-hairline rounded-2xl shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-hairline pb-2.5">
            <h3 className="text-xs font-display font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-marigold" />
              Comparative Evidence Verdict
            </h3>
            <span className={`text-[9px] font-mono font-semibold uppercase px-2 py-0.5 rounded-full border ${
              issue.closureAssessment.resolved
                ? "bg-verify/10 text-verify border-verify/20"
                : "bg-alert/10 text-alert border-alert/20"
            }`}>
              {issue.closureAssessment.resolved ? "resolved" : "reopened"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-0.5">
            <div className="relative rounded-xl overflow-hidden border border-hairline">
              <img src={issue.image} alt="Before" className="w-full aspect-video object-cover" referrerPolicy="no-referrer" />
              <div className="absolute inset-x-0 bottom-0 bg-ink/80 p-1 mt-0.5 text-center">
                <span className="text-[7.5px] text-paper font-mono uppercase tracking-wider block">Before</span>
              </div>
            </div>
            {issue.closureAssessment.afterImage && (
              <div className="relative rounded-xl overflow-hidden border border-hairline">
                <img src={issue.closureAssessment.afterImage} alt="After" className="w-full aspect-video object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-x-0 bottom-0 bg-ink/80 p-1 mt-0.5 text-center">
                  <span className="text-[7.5px] text-paper font-mono uppercase tracking-wider block">After</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5 text-xs bg-paper p-2.5 rounded-xl border border-hairline mt-1">
            <div className="flex items-center justify-between text-[9px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate uppercase">Visual Match Metrics</span>
                <span className="font-semibold text-verify">{(issue.closureAssessment.confidence * 100).toFixed(0)}% matched</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate uppercase">Type</span>
                <span className="font-bold text-ink uppercase">{issue.closureAssessment.recommendation.replace("_", " ")}</span>
              </div>
            </div>
            <div className="text-slate leading-relaxed font-semibold text-[10px] p-2 bg-white rounded-lg border border-hairline/80 mt-1 italic">
              "{issue.closureAssessment.explanation}"
            </div>
          </div>
        </div>
      )}

      {/* Captured Location coordinate card */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-2 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <span className="text-[9pt] font-mono uppercase text-slate">Spatial Reference Point</span>
        <div className="flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-marigold flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-ink leading-tight">
              {issue.locationName || "Reported Location"}
            </p>
            {issue.lat !== undefined && issue.lng !== undefined && (
              <span className="text-[9px] font-mono text-slate block mt-0.5 select-all">
                COORD: {issue.lat.toFixed(6)} N, {issue.lng.toFixed(6)} E
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Community voice backer details */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex items-center justify-between shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <div className="flex flex-col">
          <span className="text-[9pt] font-mono uppercase text-slate">COMMUNITY SUPPORT</span>
          <span className="text-[11.5px] font-semibold text-ink mt-0.5">{issue.citizenUpvotes} {issue.citizenUpvotes === 1 ? "citizen" : "citizens"} backed this case</span>
        </div>
        <button
          type="button"
          disabled={upvoteLoadingId === issue.id}
          onClick={() => onUpvote(issue.id)}
          className="flex items-center gap-1.5 bg-marigold text-ink hover:bg-marigold/95 px-4.5 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
          style={{ minHeight: "36px" }}
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>{upvoteLoadingId === issue.id ? "..." : "Support this report"}</span>
        </button>
      </div>

      {/* Verification controls */}
      <VerificationPanel issue={issue} onRefresh={onRefresh} />

      {/* RTI ESCALATION PORTAL (if not resolved) */}
      {issue.status !== "Resolved" && (
        <AutoEscalationPanel issue={issue} onUpdated={onRefresh} />
      )}

      {/* Resolution Plan SLA builder */}
      <ResolutionPlanWidget issue={issue} onRefresh={onRefresh} lang={lang} />

      {/* Priority scale score breakdown */}
      <PriorityBreakdownWidget issue={issue} />

      {/* Compact Interactive Status progress bar */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider border-b border-hairline pb-2.5">
          {t("detail.status")}
        </h3>
        <div className="relative flex justify-between items-center px-1">
          {/* Timeline background rule */}
          <div className="absolute top-1/2 left-3 right-3 h-[2px] bg-hairline -translate-y-1/2 z-0" />
          {/* Active timeline progress */}
          <div
            className="absolute top-1/2 left-3 h-[2px] bg-verify -translate-y-1/2 z-0 transition-all duration-[500ms]"
            style={{
              width: `${(currentStatusIndex / (STATUS_STEPS.length - 1)) * 90}%`,
            }}
          />

          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = currentStatusIndex >= idx;
            const isCurrent = currentStatusIndex === idx;

            return (
              <div key={step} className="flex flex-col items-center gap-1.5 z-10 relative">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono transition-all duration-[300ms] border ${
                    isCompleted
                      ? isCurrent
                        ? "bg-marigold text-ink border-marigold font-bold scale-105"
                        : "bg-verify text-white border-verify"
                      : "bg-white text-slate/40 border-hairline"
                  }`}
                >
                  {idx + 1}
                </div>
                <span className={`text-[9px] font-sans font-semibold tracking-tight uppercase ${isCurrent ? "text-ink font-bold" : isCompleted ? "text-verify" : "text-slate/60"}`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Official Audit Trail list */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-3.5 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <h3 className="text-xs font-display font-bold text-ink uppercase tracking-tight flex items-center gap-1.5 border-b border-hairline pb-2.5">
          <Clock className="w-3.5 h-3.5 text-slate" />
          {t("detail.timeline")}
        </h3>

        {loadingAct ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-[10px] text-slate/60 text-center font-medium py-2">
            No activity yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4 pl-3.5 border-l border-hairline relative">
            {activities.map((act) => (
              <div key={act.id} className="relative flex flex-col gap-0.5">
                <div className="absolute -left-[19px] top-1.5 w-1.5 h-1.5 rounded-full bg-slate border border-white" />
                <span className="text-[10px] font-mono font-bold text-slate uppercase tracking-wider">
                  {{
                    operator: "🏛️ Operator",
                    ai: "🤖 CivicLens Agent",
                    citizen: "👤 Citizen",
                  }[act.actorType] || "👤 Citizen"}
                </span>
                <p className="text-[11px] text-ink leading-relaxed font-sans font-medium">
                  {act.message}
                </p>
                <span className="text-[8.5px] font-mono text-slate/60">
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
