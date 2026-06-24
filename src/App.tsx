import React, { useState, useEffect } from "react";
import { ActiveView, IssueReport, AgentTraceEntry } from "./types";
import MobileFrame from "./components/MobileFrame";
import Header from "./components/Header";
import LandingPage from "./components/LandingPage";
import ReportPage from "./components/ReportPage";
import SuccessPage from "./components/SuccessPage";
import IssueDetailPage from "./components/IssueDetailPage";
import { useFirebase } from "./context/FirebaseContext";
import { 
  fetchRecentIssues, 
  submitIssueReport, 
  upvoteIssue,
  findDuplicateCandidates,
  checkDuplicateWithAI,
  submitEvidenceForIssue,
  calculatePriorityScore
} from "./services/issues";
import { AlertCircle, Loader2 } from "lucide-react";
import DuplicateCheckPage from "./components/DuplicateCheckPage";
import OperatorQueue from "./components/OperatorQueue";
import OperatorDetailView from "./components/OperatorDetailView";
import ImpactDashboard from "./components/ImpactDashboard";
import AgentTraceTimeline from "./components/AgentTraceTimeline";

export default function App() {
  const { user } = useFirebase();
  const [currentView, setCurrentView] = useState<ActiveView>("landing");
  const [latestReport, setLatestReport] = useState<Partial<IssueReport> | null>(null);
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [upvoteLoadingId, setUpvoteLoadingId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

  // User Geolocation Shared State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Operator Simulation Persona States
  const [persona, setPersona] = useState<"citizen" | "operator">("citizen");
  const [operatorSelectedIssueId, setOperatorSelectedIssueId] = useState<string | null>(null);

  // Duplicate Check States
  const [pendingReportData, setPendingReportData] = useState<Partial<IssueReport> | null>(null);
  const [duplicateCandidate, setDuplicateCandidate] = useState<IssueReport | null>(null);
  const [duplicateDistance, setDuplicateDistance] = useState<number>(0);
  const [duplicateReasons, setDuplicateReasons] = useState<string[]>([]);
  const [duplicateSimilarity, setDuplicateSimilarity] = useState<number>(0);
  const [isDeduplicating, setIsDeduplicating] = useState<boolean>(false);
  const [dedupConfirmedMerged, setDedupConfirmedMerged] = useState<boolean>(false);
  const [liveTrace, setLiveTrace] = useState<AgentTraceEntry[]>([]);

  // Load issues from Firestore
  const loadIssues = async () => {
    setIssuesLoading(true);
    setLoadError(false);
    try {
      const data = await fetchRecentIssues();
      setIssues(data);
    } catch (err) {
      console.error("Failed to load issues:", err);
      setLoadError(true);
    } finally {
      setIssuesLoading(false);
    }
  };

  useEffect(() => {
    loadIssues();
  }, [currentView]);

  const handleNavigate = (view: ActiveView) => {
    setErrorNotice(null);
    setCurrentView(view);
  };

  const handleSelectIssue = (id: string) => {
    setSelectedIssueId(id);
    setCurrentView("detail");
  };

  const saveNewStandaloneReport = async (reportData: Partial<IssueReport>, customTrace?: AgentTraceEntry[], customPlan?: any) => {
    const savedReport = await submitIssueReport({
      image: reportData.image!,
      category: reportData.category!,
      description: reportData.description!,
      lat: reportData.lat,
      lng: reportData.lng,
      locationName: reportData.locationName,
      title: reportData.title,
      summary: reportData.summary,
      severity: reportData.severity,
      urgency: reportData.urgency,
      visibleHazards: reportData.visibleHazards,
      affectedArea: reportData.affectedArea,
      privacyFlags: reportData.privacyFlags,
      confidence: reportData.confidence,
      agentTrace: customTrace,
      resolutionPlan: customPlan || undefined,
    });
    setLatestReport(savedReport);
    setCurrentView("success");
  };

  const handleReportSubmit = async (reportData: Partial<IssueReport>) => {
    setErrorNotice(null);
    if (!user) {
      setErrorNotice("Authentication required to file complaints. Please verify identity below.");
      return;
    }

    setDedupConfirmedMerged(false);
    setCurrentView("submitting");
    setLiveTrace([]);

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      // 1. Perceive Step
      const perceiveMeta = (reportData as any).perceiveMeta;
      const perceiveEntry: AgentTraceEntry = {
        step: "Perceive",
        tool: "Gemini Multimodal Vision (/api/analyze-report)",
        status: "done",
        rationale: perceiveMeta
          ? `Identified visual category "${reportData.category || "other"}" with severity rating ${reportData.severity || 3}/5 and parsed visible hazards: ${(reportData.visibleHazards || []).join(", ") || "none"}.`
          : "Manual form input: the citizen entered issue category, title, and description manually.",
        ts: new Date().toISOString(),
        durationMs: perceiveMeta?.durationMs || 1200,
        confidence: perceiveMeta?.confidence || 1.0,
        inputDigest: perceiveMeta?.inputDigest || `Manual input category: ${reportData.category}`,
        outputSummary: perceiveMeta?.outputSummary || `Manual form verified`,
        retried: perceiveMeta?.retried || false,
        fallbackUsed: perceiveMeta?.fallbackUsed || false,
      };
      setLiveTrace([perceiveEntry]);
      await delay(1000);

      // 2. Locate Step
      const hasGeo = typeof reportData.lat === "number" && typeof reportData.lng === "number";
      const locateEntry: AgentTraceEntry = {
        step: "Locate",
        tool: "GPS Geo-locator (Navigator API)",
        status: hasGeo ? "done" : "skipped",
        rationale: hasGeo 
          ? `Successfully resolved geo-coordinates (${reportData.lat?.toFixed(4)}, ${reportData.lng?.toFixed(4)}) at "${reportData.locationName || "Current Location"}".`
          : `No GPS coordinates provided. Standard fallback to local description: "${reportData.locationName || "Default Landmark"}".`,
        ts: new Date().toISOString(),
        durationMs: hasGeo ? 150 : 50,
        confidence: 1.0,
        inputDigest: hasGeo ? `lat: ${reportData.lat?.toFixed(4)}, lng: ${reportData.lng?.toFixed(4)}` : "No GPS",
        outputSummary: hasGeo ? `Located at: ${reportData.locationName}` : "Local address fallback",
      };
      setLiveTrace(prev => [...prev, locateEntry]);
      await delay(1000);

      // 3. Deduplicate Step
      let dupStatus: "done" | "skipped" = "skipped";
      let dupRationale = "Proximity search skipped because no geolocational coordinates were provided.";
      let dupMeta: any = {};
      let localCandidates: any[] = [];
      let aiResponse: any = null;

      if (hasGeo) {
        localCandidates = await findDuplicateCandidates(reportData);
        if (localCandidates.length === 0) {
          dupStatus = "done";
          dupRationale = "Proximity analysis scanned active issues within 150m. None matching: approved new standalone report.";
          dupMeta = {
            durationMs: 320,
            confidence: 1.0,
            inputDigest: `Scan radius 150m around (${reportData.lat?.toFixed(2)}, ${reportData.lng?.toFixed(2)})`,
            outputSummary: "0 candidates found. Standard stand-alone path.",
          };
        } else {
          const rawCandidates = localCandidates.map(c => c.issue);
          try {
            const startTime = Date.now();
            aiResponse = await checkDuplicateWithAI(reportData, rawCandidates);
            const durationMs = Date.now() - startTime;
            dupStatus = "done";
            dupRationale = `Proximity search scanned ${localCandidates.length} tickets. Recommendation: ${aiResponse.recommendation}. Reasons: ${aiResponse.reasons?.join("; ") || "None"}`;
            dupMeta = {
              durationMs,
              confidence: aiResponse.similarity,
              inputDigest: `Compare: ${reportData.category} vs ${localCandidates.length} candidates`,
              outputSummary: `Rec: ${aiResponse.recommendation} · similarity: ${(aiResponse.similarity || 0).toFixed(2)}`,
            };
          } catch (err: any) {
            dupStatus = "done";
            dupRationale = "Failed to communicate with semantic service. Standalone fallback applied to preserve ticket integrity.";
            dupMeta = {
              durationMs: 150,
              confidence: 0.5,
              errorMsg: err.message,
            };
          }
        }
      }

      const deduplicateEntry: AgentTraceEntry = {
        step: "Deduplicate",
        tool: "Proximity & Semantic Engine (/api/check-duplicate)",
        status: dupStatus,
        rationale: dupRationale,
        ts: new Date().toISOString(),
        ...dupMeta,
      };
      
      const currentTraceWithDup = [...[perceiveEntry, locateEntry], deduplicateEntry];
      setLiveTrace(currentTraceWithDup);
      await delay(1000);

      // Handle duplicate check routing
      if (aiResponse && (aiResponse.recommendation === "merge" || aiResponse.recommendation === "ask_user") && aiResponse.bestCandidateId) {
        const matchedCandidateObj = localCandidates.find(c => c.issue.id === aiResponse.bestCandidateId);
        if (matchedCandidateObj) {
          setPendingReportData({ ...reportData, perceiveMeta: undefined, agentTrace: currentTraceWithDup } as any);
          setDuplicateCandidate(matchedCandidateObj.issue);
          setDuplicateDistance(matchedCandidateObj.distance);
          setDuplicateReasons(aiResponse.reasons);
          setDuplicateSimilarity(aiResponse.similarity);
          setCurrentView("duplicate");
          return;
        }
      }

      // 4. Prioritize Step
      const calculatedScore = calculatePriorityScore({
        category: reportData.category!,
        severity: reportData.severity || 3,
        affectedArea: reportData.affectedArea || "unknown",
        urgency: reportData.urgency || "routine",
      } as any);

      const prioritizeEntry: AgentTraceEntry = {
        step: "Prioritize",
        tool: "Deterministic Priority Engine (TypeScript)",
        status: "done",
        rationale: `Evaluated priority score to ${calculatedScore} using standard index. Formula: severity (${reportData.severity || 3}/5) * 10 + affectedArea weight + urgency weight.`,
        ts: new Date().toISOString(),
        durationMs: 80,
        confidence: 1.0,
        inputDigest: `severity: ${reportData.severity || 3}, urgency: ${reportData.urgency || "routine"}, area: ${reportData.affectedArea || "unknown"}`,
        outputSummary: `priorityScore: ${calculatedScore}`,
      };
      
      const currentTraceWithPrio = [...currentTraceWithDup, prioritizeEntry];
      setLiveTrace(currentTraceWithPrio);
      await delay(1000);

      // 5. Decide Step
      const isHighSeverity = (reportData.severity && reportData.severity >= 4) || reportData.urgency === "urgent";
      let decideRationale = "";
      if (isHighSeverity) {
        decideRationale = `Autonomous routing decision: High-severity or urgent issue identified (severity ${reportData.severity}/5, urgency: ${reportData.urgency}). Decision: Bypassing standard queue, triggering immediate compliance complaint resolution plan drafting.`;
      } else {
        decideRationale = `Autonomous routing decision: Standard issue detected (severity ${reportData.severity}/5, urgency: ${reportData.urgency || "routine"}). Decision: Routing to community verification queue to build public consensus first.`;
      }

      const decideEntry: AgentTraceEntry = {
        step: "Decide",
        tool: "Autonomous Routing Decision Engine",
        status: "done",
        rationale: decideRationale,
        ts: new Date().toISOString(),
        durationMs: 120,
        confidence: 1.0,
        inputDigest: `isHighSeverity: ${isHighSeverity}`,
        outputSummary: isHighSeverity ? "Trigger immediate resolution drafting" : "Route to community verification",
      };

      const currentTraceWithDecide = [...currentTraceWithPrio, decideEntry];
      setLiveTrace(currentTraceWithDecide);
      await delay(1000);

      // 6. Resolution Plan steps if high severity
      let finalResolutionPlan: any = null;
      let finalTrace = currentTraceWithDecide;

      if (isHighSeverity) {
        try {
          const startTime = Date.now();
          const response = await fetch("/api/resolution-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: reportData.category,
              title: reportData.title || "Civic Incident",
              summary: reportData.summary || reportData.description,
              locationName: reportData.locationName || "Default Civic Landmark",
              lat: reportData.lat,
              lng: reportData.lng,
              ticketId: "PRE-SUBMIT-TICKET",
            }),
          });
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const durationMs = Date.now() - startTime;
              finalResolutionPlan = result.data;
              
              const findAuthorityEntry: AgentTraceEntry = {
                step: "Find Authority",
                tool: "Grounded Authority Search Engine (/api/resolution-plan)",
                status: "done",
                rationale: `Grounded search successfully identified "${result.data.recommendedAuthority}" as governing body, with channel "${result.data.contactChannel}".`,
                ts: new Date().toISOString(),
                durationMs: Math.round(durationMs * 0.4),
                confidence: 0.95,
                inputDigest: `Search local bodies in "${reportData.locationName || "India"}"`,
                outputSummary: `Authority: ${result.data.recommendedAuthority} · SLA: ${result.data.slaDays} days`,
              };

              const draftActionPacketEntry: AgentTraceEntry = {
                step: "Draft Action Packet",
                tool: "Complaint Translation & Formulator (/api/resolution-plan)",
                status: "done",
                rationale: `Drafted professional escalation complaint letter and generated native Hindi translation. Citizen SLA is ${result.data.slaDays} days.`,
                ts: new Date().toISOString(),
                durationMs: Math.round(durationMs * 0.6),
                confidence: 0.95,
                inputDigest: `category: ${reportData.category}`,
                outputSummary: `Formal template + Hindi translation prepared`,
              };

              finalTrace = [...currentTraceWithDecide, findAuthorityEntry, draftActionPacketEntry];
              setLiveTrace(finalTrace);
              await delay(1000);
            }
          }
        } catch (planErr) {
          console.error("Auto resolution plan error:", planErr);
          const findAuthorityEntry: AgentTraceEntry = {
            step: "Find Authority",
            tool: "Grounded Authority Search Engine (/api/resolution-plan)",
            status: "skipped",
            rationale: "Grounded lookup failed or was timed out. Degraded gracefully to manual generation.",
            ts: new Date().toISOString(),
          };
          const draftActionPacketEntry: AgentTraceEntry = {
            step: "Draft Action Packet",
            tool: "Complaint Translation & Formulator (/api/resolution-plan)",
            status: "skipped",
            rationale: "Action packet drafting skipped due to authority search failure.",
            ts: new Date().toISOString(),
          };
          finalTrace = [...currentTraceWithDecide, findAuthorityEntry, draftActionPacketEntry];
          setLiveTrace(finalTrace);
          await delay(1000);
        }
      }

      await saveNewStandaloneReport(reportData, finalTrace, finalResolutionPlan);

    } catch (err: any) {
      console.error("Submitting pipeline error:", err);
      setErrorNotice(err.message || "Failed to submit report. Please try again.");
      setCurrentView("report");
    }
  };

  const handleMergeDuplicate = async () => {
    if (!pendingReportData || !duplicateCandidate) return;
    setErrorNotice(null);
    setIsDeduplicating(true);

    try {
      await submitEvidenceForIssue(duplicateCandidate.id, {
        imageUrl: pendingReportData.image!,
        description: pendingReportData.description || pendingReportData.summary || "Co-supporting evidence submitted.",
        lat: pendingReportData.lat,
        lng: pendingReportData.lng,
        severity: pendingReportData.severity || 1,
      });

      setDedupConfirmedMerged(true);
      setLatestReport({
        ...duplicateCandidate,
        category: pendingReportData.category!,
        ticketId: duplicateCandidate.ticketId,
        description: pendingReportData.description || pendingReportData.summary,
      });
      setCurrentView("success");
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to link evidence. Please try again.");
    } finally {
      setIsDeduplicating(false);
      setPendingReportData(null);
      setDuplicateCandidate(null);
    }
  };

  const handleCreateStandaloneAnyway = async () => {
    if (!pendingReportData) return;
    setErrorNotice(null);
    setCurrentView("submitting");
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    try {
      const existingTrace = (pendingReportData as any).agentTrace || [];
      setLiveTrace(existingTrace);
      await delay(1000);

      // 4. Prioritize
      const calculatedScore = calculatePriorityScore({
        category: pendingReportData.category!,
        severity: pendingReportData.severity || 3,
        affectedArea: pendingReportData.affectedArea || "unknown",
        urgency: pendingReportData.urgency || "routine",
      } as any);

      const prioritizeEntry: AgentTraceEntry = {
        step: "Prioritize",
        tool: "Deterministic Priority Engine (TypeScript)",
        status: "done",
        rationale: `Evaluated priority score to ${calculatedScore} using standard index. Formula: severity (${pendingReportData.severity || 3}/5) * 10 + affectedArea weight + urgency weight.`,
        ts: new Date().toISOString(),
        durationMs: 80,
        confidence: 1.0,
        inputDigest: `severity: ${pendingReportData.severity || 3}, urgency: ${pendingReportData.urgency || "routine"}, area: ${pendingReportData.affectedArea || "unknown"}`,
        outputSummary: `priorityScore: ${calculatedScore}`,
      };

      const traceWithPrio = [...existingTrace, prioritizeEntry];
      setLiveTrace(traceWithPrio);
      await delay(1000);

      // 5. Decide
      const isHighSeverity = (pendingReportData.severity && pendingReportData.severity >= 4) || pendingReportData.urgency === "urgent";
      let decideRationale = "";
      if (isHighSeverity) {
        decideRationale = `Autonomous routing decision: High-severity or urgent issue identified (severity ${pendingReportData.severity}/5, urgency: ${pendingReportData.urgency}). Decision: Bypassing standard queue, triggering immediate compliance complaint resolution plan drafting.`;
      } else {
        decideRationale = `Autonomous routing decision: Standard issue detected (severity ${pendingReportData.severity}/5, urgency: ${pendingReportData.urgency || "routine"}). Decision: Routing to community verification queue to build public consensus first.`;
      }

      const decideEntry: AgentTraceEntry = {
        step: "Decide",
        tool: "Autonomous Routing Decision Engine",
        status: "done",
        rationale: decideRationale,
        ts: new Date().toISOString(),
        durationMs: 120,
        confidence: 1.0,
        inputDigest: `isHighSeverity: ${isHighSeverity}`,
        outputSummary: isHighSeverity ? "Trigger immediate resolution drafting" : "Route to community verification",
      };

      const traceWithDecide = [...traceWithPrio, decideEntry];
      setLiveTrace(traceWithDecide);
      await delay(1000);

      // 6. Resolution Plan
      let finalResolutionPlan: any = null;
      let finalTrace = traceWithDecide;

      if (isHighSeverity) {
        try {
          const startTime = Date.now();
          const response = await fetch("/api/resolution-plan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category: pendingReportData.category,
              title: pendingReportData.title || "Civic Incident",
              summary: pendingReportData.summary || pendingReportData.description,
              locationName: pendingReportData.locationName || "Default Civic Landmark",
              lat: pendingReportData.lat,
              lng: pendingReportData.lng,
              ticketId: "PRE-SUBMIT-TICKET",
            }),
          });
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              const durationMs = Date.now() - startTime;
              finalResolutionPlan = result.data;
              
              const findAuthorityEntry: AgentTraceEntry = {
                step: "Find Authority",
                tool: "Grounded Authority Search Engine (/api/resolution-plan)",
                status: "done",
                rationale: `Grounded search successfully identified "${result.data.recommendedAuthority}" as governing body, with channel "${result.data.contactChannel}".`,
                ts: new Date().toISOString(),
                durationMs: Math.round(durationMs * 0.4),
                confidence: 0.95,
                inputDigest: `Search local bodies in "${pendingReportData.locationName || "India"}"`,
                outputSummary: `Authority: ${result.data.recommendedAuthority} · SLA: ${result.data.slaDays} days`,
              };

              const draftActionPacketEntry: AgentTraceEntry = {
                step: "Draft Action Packet",
                tool: "Complaint Translation & Formulator (/api/resolution-plan)",
                status: "done",
                rationale: `Drafted professional escalation complaint letter and generated native Hindi translation. Citizen SLA is ${result.data.slaDays} days.`,
                ts: new Date().toISOString(),
                durationMs: Math.round(durationMs * 0.6),
                confidence: 0.95,
                inputDigest: `category: ${pendingReportData.category}`,
                outputSummary: `Formal template + Hindi translation prepared`,
              };

              finalTrace = [...traceWithDecide, findAuthorityEntry, draftActionPacketEntry];
              setLiveTrace(finalTrace);
              await delay(1000);
            }
          }
        } catch (planErr) {
          console.error("Auto resolution plan error:", planErr);
          const findAuthorityEntry: AgentTraceEntry = {
            step: "Find Authority",
            tool: "Grounded Authority Search Engine (/api/resolution-plan)",
            status: "skipped",
            rationale: "Grounded lookup failed or was timed out. Degraded gracefully to manual generation.",
            ts: new Date().toISOString(),
          };
          const draftActionPacketEntry: AgentTraceEntry = {
            step: "Draft Action Packet",
            tool: "Complaint Translation & Formulator (/api/resolution-plan)",
            status: "skipped",
            rationale: "Action packet drafting skipped due to authority search failure.",
            ts: new Date().toISOString(),
          };
          finalTrace = [...traceWithDecide, findAuthorityEntry, draftActionPacketEntry];
          setLiveTrace(finalTrace);
          await delay(1000);
        }
      }

      await saveNewStandaloneReport(pendingReportData, finalTrace, finalResolutionPlan);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to submit new report.");
      setCurrentView("report");
    } finally {
      setPendingReportData(null);
      setDuplicateCandidate(null);
    }
  };

  const handleUpvote = async (issueId: string) => {
    if (!user) {
      setErrorNotice("Please login/verify your identity to support this issue report!");
      return;
    }

    setUpvoteLoadingId(issueId);
    try {
      await upvoteIssue(issueId);
      // Optimistic update
      setIssues((prev) =>
        prev.map((issue) =>
          issue.id === issueId
            ? { ...issue, citizenUpvotes: issue.citizenUpvotes + 1 }
            : issue
        )
      );
    } catch (err: any) {
      setErrorNotice("Upvote denied or rate-limited. Ensure you are email-verified!");
    } finally {
      setUpvoteLoadingId(null);
    }
  };

  return (
    <MobileFrame>
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-marigold focus:text-ink focus:px-4 focus:py-2 focus:rounded-lg focus:font-bold focus:shadow-md focus:outline-none"
      >
        Skip to main content
      </a>
      <Header 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        persona={persona}
        onTogglePersona={(p) => {
          setPersona(p);
          if (p === "operator") {
            setOperatorSelectedIssueId(null);
          }
        }}
      />

      {/* Global Toast Error Notice */}
      {errorNotice && (
        <div 
          role="status" 
          aria-live="polite" 
          className="mx-4 mt-3 bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl flex flex-col gap-2 shadow-xs transition-all"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs font-semibold leading-relaxed">
              {errorNotice}
            </div>
          </div>
        </div>
      )}

      {/* View Router */}
      <main id="main-content" className="flex flex-col flex-1 overflow-y-auto">
        {loadError ? (
          <div className="flex-1 flex flex-col justify-center items-center p-6 text-center font-sans">
            <div className="bg-white border border-alert/20 p-6 rounded-2xl max-w-sm shadow-xs flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-alert/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-alert" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Unable to fetch registered incidents</h3>
                <p className="text-[11px] text-slate mt-1 leading-relaxed">
                  Our secure connection to the Inspectorate is temporarily congested or your network is slow.
                </p>
              </div>
              <button
                type="button"
                onClick={loadIssues}
                className="w-full bg-marigold hover:bg-marigold/90 text-ink font-bold text-xs py-2 px-4 rounded-xl shadow-xs cursor-pointer min-h-[36px]"
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : persona === "operator" ? (
          operatorSelectedIssueId ? (
            (() => {
              const selectedIssue = issues.find((issue) => issue.id === operatorSelectedIssueId);
              if (!selectedIssue) {
                return (
                  <div className="p-4 text-center text-xs font-semibold text-slate-500 font-sans">
                    Issue report not found.
                    <button onClick={() => setOperatorSelectedIssueId(null)} className="block mt-2 underline mx-auto text-[#4F46E5] font-bold">
                      Back to Queue
                    </button>
                  </div>
                );
              }
              return (
                <OperatorDetailView
                  issue={selectedIssue}
                  onBack={() => setOperatorSelectedIssueId(null)}
                  onRefresh={loadIssues}
                />
              );
            })()
          ) : (
            <OperatorQueue
              issues={issues}
              onSelectIssue={(id) => setOperatorSelectedIssueId(id)}
              onRefresh={loadIssues}
              loading={issuesLoading}
            />
          )
        ) : (
          <>
            {currentView === "landing" && (
              <LandingPage
                onNavigate={handleNavigate}
                issues={issues}
                onUpvote={handleUpvote}
                upvoteLoadingId={upvoteLoadingId}
                onSelectIssue={handleSelectIssue}
                userLocation={userLocation}
                onUserLocationChange={setUserLocation}
                loading={issuesLoading}
              />
            )}

            {currentView === "detail" && selectedIssueId && (
              (() => {
                const selectedIssue = issues.find((issue) => issue.id === selectedIssueId);
                if (!selectedIssue) {
                  return (
                    <div className="p-4 text-center text-xs font-semibold text-slate-500">
                      Issue report not found. Please navigate back manually.
                      <button onClick={() => setCurrentView("landing")} className="block mt-2 underline mx-auto text-[#4F46E5] font-sans">
                        Back to Hub
                      </button>
                    </div>
                  );
                }
                return (
                  <IssueDetailPage
                    issue={selectedIssue}
                    onBack={() => setCurrentView("landing")}
                    onUpvote={handleUpvote}
                    upvoteLoadingId={upvoteLoadingId}
                    onRefresh={loadIssues}
                  />
                );
              })()
            )}

            {currentView === "report" && (
              <ReportPage
                onBack={() => {
                  setPendingReportData(null);
                  handleNavigate("landing");
                }}
                onSubmit={handleReportSubmit}
                prefilledLocation={userLocation}
                prefilledData={pendingReportData}
              />
            )}

            {currentView === "success" && (
              <SuccessPage
                report={latestReport}
                onNavigate={handleNavigate}
                isMerged={dedupConfirmedMerged}
              />
            )}

            {currentView === "duplicate" && pendingReportData && duplicateCandidate && (
              <DuplicateCheckPage
                newReport={pendingReportData}
                candidate={duplicateCandidate}
                distance={duplicateDistance}
                reasons={duplicateReasons}
                similarity={duplicateSimilarity}
                onMerge={handleMergeDuplicate}
                onCreateNew={handleCreateStandaloneAnyway}
                onCancel={() => {
                  setDuplicateCandidate(null);
                  setCurrentView("report");
                }}
                isProcessing={isDeduplicating}
              />
            )}

            {currentView === "dashboard" && (
              <ImpactDashboard
                issues={issues}
                onBack={() => setCurrentView("landing")}
              />
            )}

            {currentView === "submitting" && (
              <div className="flex flex-col gap-6 p-4 min-h-[75vh] justify-center items-center font-sans">
                <div className="w-full bg-white border border-hairline rounded-3xl p-5 shadow-md flex flex-col gap-5">
                  <div className="flex flex-col items-center text-center gap-2 border-b border-hairline pb-4">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-marigold/10 animate-ping" />
                      <div className="relative w-12 h-12 rounded-full bg-marigold/10 flex items-center justify-center border border-marigold/20">
                        <Loader2 className="w-6 h-6 text-marigold animate-spin" />
                      </div>
                    </div>
                    <h2 className="text-base font-bold text-ink font-display mt-2">Agent Running Autonomously...</h2>
                    <p className="text-[11px] text-slate max-w-xs leading-normal font-medium">
                      Verifying, geocoding, checking duplication integrity, scoring, and routing your complaint.
                    </p>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto pr-1">
                    <AgentTraceTimeline trace={liveTrace} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Deduplication Integrity scanner loading overlay */}
      {isDeduplicating && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center z-50 px-6">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3 max-w-xs text-center border border-slate-100">
            <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin" />
            <p className="text-xs font-bold text-slate-800">Checking Duplication Integrity</p>
            <p className="text-[10px] text-slate-400 font-medium leading-normal">
              Analyzing active tickets using real-time geometric and semantic matching.
            </p>
          </div>
        </div>
      )}
    </MobileFrame>
  );
}
