import React, { useState, useEffect } from "react";
import { ArrowLeft, ArrowUp, MapPin, ShieldAlert, Clock, RefreshCw, Sparkles } from "lucide-react";
import { IssueReport, IssueActivity } from "../types";
import { fetchIssueActivities } from "../services/issues";
import { useLanguage } from "../context/LanguageContext";
import PriorityBreakdownWidget from "./PriorityBreakdownWidget";
import VerificationPanel from "./VerificationPanel";
import AgentTraceTimeline from "./AgentTraceTimeline";
import { humanizeCategory, humanizeUrgency } from "../utils/humanize";
import { fetchLatestAgentRun } from "../services/api";
import { ISSUE_STATUS_KEYS, issueStatusLabel } from "../constants/status";

interface IssueDetailPageProps {
  issue: IssueReport;
  onBack: () => void;
  onUpvote: (id: string) => Promise<void>;
  upvoteLoadingId: string | null;
  onRefresh: () => void;
}

const STATUS_STEPS = ISSUE_STATUS_KEYS;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

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
  const confidence = finiteNumber(issue.confidence);
  const closureConfidence = finiteNumber(issue.closureAssessment?.confidence);
  const ghostConfidence = finiteNumber(issue.ghostForensics?.confidence);
  const hasCoordinates = finiteNumber(issue.lat) !== null && finiteNumber(issue.lng) !== null;

  const [activities, setActivities] = useState<IssueActivity[]>([]);
  const [loadingAct, setLoadingAct] = useState(true);
  
  const { language: lang, t } = useLanguage();

  const [persistedAgentSteps, setPersistedAgentSteps] = useState<any[]>([]);
  const [activeAgentRun, setActiveAgentRun] = useState<any | null>(null);

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
      className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-5 font-sans animate-fade-in pb-28 bg-paper min-h-screen text-ink sm:px-6 lg:px-8"
    >
      {/* Back Button and Case Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            id="detail-back-btn"
            onClick={onBack}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-white border border-hairline shadow-2xs cursor-pointer hover:bg-paper transition-colors"
            aria-label="Back to landing"
          >
            <ArrowLeft className="w-4 h-4 text-ink" />
          </button>
          <div>
            <span className="text-sm font-mono text-slate block">
              {t("nav.report").toUpperCase()}
            </span>
            <h2 className="text-sm font-mono font-semibold text-ink">
              {t("detail.ticketId")}: {issue.ticketId}
            </h2>
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-white px-3 py-2 text-right text-sm font-semibold text-slate shadow-2xs">
          <span className="block text-ink">{t("account.language")}</span>
          <span className="block">{lang === "hi" ? "हिन्दी सक्रिय" : "English active"}</span>
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
            <span className="absolute left-3 top-3 bg-ink/75 backdrop-blur-xs text-white text-sm font-sans px-2.5 py-1 rounded-lg border border-white/10">
              {humanizeCategory(issue.category)}
            </span>
            {issue.isDemoData && (
              <span className="absolute right-3 top-3 bg-marigold text-ink text-sm font-semibold px-2 py-1 rounded-lg border border-white/10 select-none">
                Demo
              </span>
            )}
          </div>
        ) : (
          <div className="aspect-video w-full bg-paper flex items-center justify-center text-slate border-b border-hairline">
            <p className="text-base font-medium">No incident photograph uploaded</p>
          </div>
        )}

        <div className="p-4 flex flex-col gap-2.5">
          {/* Headline analysis state */}
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-black text-ink leading-tight animate-fade-in">
              {lang === "hi"
                ? (issue.titleHi || issue.title || "Geotagged Civic Incident")
                : (issue.title || "Geotagged Civic Incident")}
            </h1>
            {confidence !== null && (
              <span className="text-sm font-mono bg-paper text-ink font-semibold px-2 py-1 rounded-lg border border-hairline flex-shrink-0">
                AI Confidence {(confidence * 100).toFixed(0)}%
              </span>
            )}
          </div>

          <p className="text-base text-slate leading-relaxed bg-paper/50 p-3 rounded-xl border border-hairline/80 whitespace-pre-wrap animate-fade-in">
            {lang === "hi"
              ? (issue.summaryHi || issue.summary || issue.description)
              : (issue.summary || issue.description)}
          </p>

          {/* Severity and follow-up widgets */}
          <div className="grid grid-cols-2 gap-2 mt-0.5">
            <div className={`border p-2.5 rounded-xl flex flex-col gap-0.5 ${severityInfo.classes}`}>
              <span className="text-sm font-mono opacity-75">AI severity</span>
              <span className="text-[13px] font-bold">{severityInfo.text}</span>
            </div>
            <div className={`border p-2.5 rounded-xl flex flex-col gap-0.5 ${getUrgencyClasses(issue.urgency)}`}>
              <span className="text-sm font-mono opacity-75">Urgency</span>
              <span className="text-[13px] font-bold capitalize">{humanizeUrgency(issue.urgency)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Read-only server agent evidence */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-3 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <div className="flex items-center justify-between border-b border-hairline pb-2.5">
          <h3 className="text-xl font-display font-black text-ink flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-marigold" />
            Server agent evidence
          </h3>
          {persistedAgentSteps.length > 0 && (
            <span className="text-sm font-mono bg-verify/10 text-verify px-2 py-1 rounded-lg border border-verify/20">
              Persisted run
            </span>
          )}
        </div>

        <p className="text-base text-slate leading-relaxed">
          This public detail page only displays persisted server-generated tool records. Agent runs, draft routing, escalation, and lifecycle decisions happen in the authorized operator workspace and do not file or route anything outside CivicLens.
        </p>
      </div>

      {/* vertical timeline audit trace */}
      <AgentTraceTimeline trace={persistedAgentSteps} run={activeAgentRun} />

      {/* Visual risk diagnosis */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-3 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <h3 className="text-xl font-display font-black text-ink flex items-center gap-2 border-b border-hairline pb-2.5">
          <ShieldAlert className="w-4 h-4 text-alert" />
          {t("detail.hazard")}
        </h3>

        <div className="flex flex-col gap-3 text-base text-ink/80">
          {/* Hazards */}
          <div className="flex flex-col gap-1">
            <span className="text-sm font-mono text-slate">Identified hazards</span>
            {issue.visibleHazards && issue.visibleHazards.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {issue.visibleHazards.map((tag) => (
                  <span key={tag} className="bg-alert/5 border border-alert/20 text-alert text-sm py-1 px-2 rounded-lg font-medium">
                    Warning: {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate italic text-sm">No public hazards detected.</span>
            )}
          </div>

          {/* Privacy Redactions */}
          <div className="flex flex-col gap-1 mt-1">
            <span className="text-sm font-mono text-slate">Redaction and de-identifier markers</span>
            {issue.privacyFlags && issue.privacyFlags.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {issue.privacyFlags.map((flag) => (
                  <span key={flag} className="bg-slate/5 border border-slate/20 text-slate text-sm py-1 px-2 rounded-lg font-medium">
                    Privacy: {flag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-slate italic text-sm">No sensitive data tags flagged.</span>
            )}
          </div>

          {/* Footprints */}
          {issue.affectedArea && (
            <div className="flex items-center justify-between border-t border-hairline pt-2.5 mt-1 text-sm">
              <span className="font-mono text-slate">Calculated impact boundary</span>
              <span className="bg-paper text-ink border border-hairline font-bold px-2 py-1 rounded-lg capitalize font-sans text-sm">
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
            <h3 className="text-xl font-display font-black text-ink flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-marigold" />
              Comparative Evidence Verdict
            </h3>
            <span className={`text-sm font-mono font-semibold px-2 py-1 rounded-lg border ${
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

          <div className="flex flex-col gap-1.5 text-sm bg-paper p-2.5 rounded-xl border border-hairline mt-1">
            <div className="flex items-center justify-between text-sm font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-slate uppercase">Visual Match Metrics</span>
                <span className="font-semibold text-verify">{closureConfidence !== null ? `${(closureConfidence * 100).toFixed(0)}% matched` : "Match not recorded"}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate uppercase">Type</span>
                <span className="font-bold text-ink uppercase">{issue.closureAssessment.recommendation.replace("_", " ")}</span>
              </div>
            </div>
            <div className="text-slate leading-relaxed font-semibold text-sm p-2 bg-white rounded-lg border border-hairline/80 mt-1 italic">
              "{issue.closureAssessment.explanation}"
            </div>
          </div>
        </div>
      )}

      {issue.ghostForensics && (
        <div id="ghost-forensics-card" className="p-4 bg-white border border-hairline rounded-2xl shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)] flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-hairline pb-2.5">
            <h3 className="text-xl font-display font-black text-ink flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-alert" />
              Ghost Closure Forensics
            </h3>
            <span className={`text-sm font-mono font-semibold px-2 py-1 rounded-lg border ${
              issue.ghostForensics.autoReopened
                ? "bg-alert/10 text-alert border-alert/20"
                : "bg-verify/10 text-verify border-verify/20"
            }`}>
              {issue.ghostForensics.autoReopened ? "auto reopened" : "checked"}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-hairline bg-paper p-2.5">
              <span className="block text-sm font-mono text-slate">Recommendation</span>
              <span className="text-base font-black uppercase text-ink">{issue.ghostForensics.recommendation.replace("_", " ")}</span>
            </div>
            <div className="rounded-xl border border-hairline bg-paper p-2.5">
              <span className="block text-sm font-mono text-slate">Confidence</span>
              <span className="text-base font-black text-marigold">{ghostConfidence !== null ? `${Math.round(ghostConfidence * 100)}%` : "Not recorded"}</span>
            </div>
            <div className="rounded-xl border border-hairline bg-paper p-2.5">
              <span className="block text-sm font-mono text-slate">Penalty</span>
              <span className="text-base font-black text-alert">{issue.ghostForensics.officerPenaltyPoints || 0} pts</span>
            </div>
          </div>
          {(issue.ghostForensics.signals || []).length > 0 && (
            <ul className="list-disc pl-5 text-sm font-semibold text-slate">
              {(issue.ghostForensics.signals || []).slice(0, 4).map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          )}
          <p className="rounded-xl border border-hairline bg-paper p-3 text-sm font-semibold leading-relaxed text-slate italic">
            "{issue.ghostForensics.explanation}"
          </p>
        </div>
      )}

      {/* Captured Location coordinate card */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-2 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <span className="text-sm font-mono text-slate">Spatial reference point</span>
        <div className="flex items-start gap-2.5">
          <MapPin className="w-4 h-4 text-marigold flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-ink leading-tight">
              {issue.locationName || "Reported Location"}
            </p>
            {hasCoordinates && (
              <span className="text-sm font-mono text-slate block mt-0.5 select-all">
                COORD: {finiteNumber(issue.lat)!.toFixed(6)} N, {finiteNumber(issue.lng)!.toFixed(6)} E
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Community voice backer details */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex items-center justify-between shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <div className="flex flex-col">
          <span className="text-sm font-mono text-slate">Community support</span>
          <span className="text-base font-semibold text-ink mt-0.5">{issue.citizenUpvotes} {issue.citizenUpvotes === 1 ? "citizen" : "citizens"} backed this case</span>
        </div>
        <button
          type="button"
          disabled={upvoteLoadingId === issue.id}
          onClick={() => onUpvote(issue.id)}
          className="flex min-h-[44px] items-center gap-1.5 bg-marigold text-ink hover:bg-marigold/95 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer shadow-xs disabled:opacity-50"
        >
          <ArrowUp className="w-3.5 h-3.5" />
          <span>{upvoteLoadingId === issue.id ? "..." : "Support this report"}</span>
        </button>
      </div>

      {/* Verification controls */}
      <VerificationPanel issue={issue} onRefresh={onRefresh} />

      {/* Priority scale score breakdown */}
      <PriorityBreakdownWidget issue={issue} />

      {/* Compact Interactive Status progress bar */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-4 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <h3 className="text-lg font-display font-black text-ink border-b border-hairline pb-2.5">
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
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-mono transition-all duration-[300ms] border ${
                    isCompleted
                      ? isCurrent
                        ? "bg-marigold text-ink border-marigold font-bold scale-105"
                        : "bg-verify text-white border-verify"
                      : "bg-white text-slate/40 border-hairline"
                  }`}
                >
                  {idx + 1}
                </div>
                <span className={`text-sm font-sans font-semibold ${isCurrent ? "text-ink font-bold" : isCompleted ? "text-verify" : "text-slate/60"}`}>
                  {issueStatusLabel(step)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Prototype activity trail list */}
      <div className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-3.5 shadow-[0_4px_16px_-4px_rgba(14,26,43,0.05)]">
        <h3 className="text-lg font-display font-black text-ink flex items-center gap-2 border-b border-hairline pb-2.5">
          <Clock className="w-3.5 h-3.5 text-slate" />
          {t("detail.timeline")}
        </h3>

        {loadingAct ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate" />
          </div>
        ) : activities.length === 0 ? (
          <p className="text-sm text-slate/60 text-center font-medium py-2">
            No activity yet.
          </p>
        ) : (
          <div className="flex flex-col gap-4 pl-3.5 border-l border-hairline relative">
            {activities.map((act) => (
              <div key={act.id} className="relative flex flex-col gap-0.5">
                <div className="absolute -left-[19px] top-1.5 w-1.5 h-1.5 rounded-full bg-slate border border-white" />
                <span className="text-sm font-mono font-bold text-slate">
                  {{
                    operator: "Prototype Operator",
                    ai: "CivicLens Agent",
                    citizen: "Citizen",
                  }[act.actorType] || "Citizen"}
                </span>
                <p className="text-sm text-ink leading-relaxed font-sans font-medium">
                  {act.message}
                </p>
                <span className="text-sm font-mono text-slate/60">
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
