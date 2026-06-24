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

      // 3. Find Nearby Candidates
      let localCandidates: any[] = [];
      let dupStatus: "done" | "skipped" = "skipped";
      let dupRationale = "Proximity search skipped because no geolocational coordinates were provided.";
      let dupMeta: any = {};
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
          // Set pending state to allow duplicate resolution screen
          setPendingReportData({ 
            ...reportData, 
            perceiveMeta: undefined, 
            agentTrace: currentTraceWithDup 
          } as any);
          setDuplicateCandidate(matchedCandidateObj.issue);
          setDuplicateDistance(matchedCandidateObj.distance);
          setDuplicateReasons(aiResponse.reasons);
          setDuplicateSimilarity(aiResponse.similarity);
          setCurrentView("duplicate");
          return;
        }
      }

      // Otherwise, save the standalone report with the complete real trace and plan
      await saveNewStandaloneReport(
        reportData, 
        currentTraceWithDup, 
        undefined
      );

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
      await delay(800);

      await saveNewStandaloneReport(
        pendingReportData, 
        existingTrace, 
        (pendingReportData as any).resolutionPlan || undefined
      );
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
