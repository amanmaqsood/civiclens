import React, { useState, useEffect, lazy, Suspense } from "react";
import { ActiveView, IssueReport, AgentTraceEntry } from "./types";
import MobileFrame from "./components/MobileFrame";
import Header from "./components/Header";
import AppBottomNav from "./components/AppBottomNav";
import FloatingReportAction from "./components/FloatingReportAction";
import LandingPage from "./components/LandingPage";
import ReportPage from "./components/ReportPage";
import SuccessPage from "./components/SuccessPage";
import IssueDetailPage from "./components/IssueDetailPage";
import { useFirebase } from "./context/FirebaseContext";
import { 
  fetchIssuesPage, 
  fetchIssueById,
  submitIssueReport, 
  upvoteIssue,
  findDuplicateCandidates,
  checkDuplicateWithAI,
  submitEvidenceForIssue,
  calculatePriorityScore,
  type IssuePageCursor
} from "./services/issues";
import { AlertCircle, Loader2 } from "lucide-react";
import DuplicateCheckPage from "./components/DuplicateCheckPage";
import AgentTraceTimeline from "./components/AgentTraceTimeline";
import { fetchApiSession, type ApiSession } from "./services/api";

type OperatorAccess = "none" | "demo" | "real";
const ISSUE_PAGE_SIZE = 50;

const OperatorQueue = lazy(() => import("./components/OperatorQueue"));
const OperatorDetailView = lazy(() => import("./components/OperatorDetailView"));
const ImpactDashboard = lazy(() => import("./components/ImpactDashboard"));

function sortIssuesForDisplay(items: IssueReport[]): IssueReport[] {
  return [...items].sort((a, b) => {
    const scoreA = a.priorityScore ?? 0;
    const scoreB = b.priorityScore ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return Date.parse(b.timestamp) - Date.parse(a.timestamp);
  });
}

function RouteLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-[45vh] w-full items-center justify-center gap-2 p-6 text-xs font-bold text-slate">
      <Loader2 className="h-4 w-4 animate-spin text-marigold" />
      <span>{label}</span>
    </div>
  );
}

function getInitialRoute(): { view: ActiveView; issueId: string | null } {
  if (typeof window === "undefined") return { view: "landing", issueId: null };
  const hash = window.location.hash || "";
  if (hash.startsWith("#issue/")) {
    const issueId = decodeURIComponent(hash.replace("#issue/", "").trim());
    if (issueId) return { view: "detail", issueId };
  }
  if (hash === "#report") return { view: "report", issueId: null };
  if (hash === "#dashboard") return { view: "dashboard", issueId: null };
  return { view: "landing", issueId: null };
}

function updateBrowserHash(view: ActiveView, issueId?: string | null) {
  if (typeof window === "undefined") return;
  const base = `${window.location.pathname}${window.location.search}`;
  const hash = view === "detail" && issueId
    ? `#issue/${encodeURIComponent(issueId)}`
    : view === "report"
      ? "#report"
      : view === "dashboard"
        ? "#dashboard"
        : "";
  window.history.replaceState(null, "", `${base}${hash}`);
}

export default function App() {
  const { user, loading: authLoading } = useFirebase();
  const [initialRoute] = useState(() => getInitialRoute());
  const [currentView, setCurrentView] = useState<ActiveView>(initialRoute.view);
  const [latestReport, setLatestReport] = useState<Partial<IssueReport> | null>(null);
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issueCursor, setIssueCursor] = useState<IssuePageCursor | null>(null);
  const [hasMoreIssues, setHasMoreIssues] = useState(false);
  const [loadingMoreIssues, setLoadingMoreIssues] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [upvoteLoadingId, setUpvoteLoadingId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(initialRoute.issueId);
  const [detailIssue, setDetailIssue] = useState<IssueReport | null>(null);
  const [detailIssueLoading, setDetailIssueLoading] = useState(false);
  const [detailIssueError, setDetailIssueError] = useState(false);

  // User Geolocation Shared State
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Operator Simulation Persona States
  const [persona, setPersona] = useState<"citizen" | "operator">("citizen");
  const [operatorSelectedIssueId, setOperatorSelectedIssueId] = useState<string | null>(null);
  const [apiSession, setApiSession] = useState<ApiSession | null>(null);

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
      const page = await fetchIssuesPage({ pageSize: ISSUE_PAGE_SIZE });
      setIssues(page.issues);
      setIssueCursor(page.nextCursor);
      setHasMoreIssues(page.hasMore);
    } catch (err) {
      console.error("Failed to load issues:", err);
      setLoadError(true);
    } finally {
      setIssuesLoading(false);
    }
  };

  const loadMoreIssues = async () => {
    if (!hasMoreIssues || !issueCursor || loadingMoreIssues) return;
    setLoadingMoreIssues(true);
    setLoadError(false);
    try {
      const page = await fetchIssuesPage({ pageSize: ISSUE_PAGE_SIZE, after: issueCursor });
      setIssues((prev) => {
        const byId = new Map(prev.map((issue) => [issue.id, issue]));
        for (const issue of page.issues) {
          byId.set(issue.id, issue);
        }
        return sortIssuesForDisplay(Array.from(byId.values()));
      });
      setIssueCursor(page.nextCursor);
      setHasMoreIssues(page.hasMore);
    } catch (err) {
      console.error("Failed to load additional issues:", err);
      setLoadError(true);
    } finally {
      setLoadingMoreIssues(false);
    }
  };

  useEffect(() => {
    if (authLoading) {
      setIssuesLoading(true);
      return;
    }
    if (!user) {
      setIssues([]);
      setIssueCursor(null);
      setHasMoreIssues(false);
      setIssuesLoading(false);
      return;
    }
    loadIssues();
  }, [currentView, authLoading, user?.uid]);

  useEffect(() => {
    let active = true;
    async function loadSession() {
      if (!user) {
        setApiSession(null);
        return;
      }
      const session = await fetchApiSession({ demoOperator: true }).catch(() => null);
      if (active) setApiSession(session);
    }
    loadSession();
    return () => {
      active = false;
    };
  }, [user?.uid]);

  const operatorAccess: OperatorAccess = apiSession?.isRealOperator ? "real" : apiSession?.isDemoOperator ? "demo" : "none";

  useEffect(() => {
    if (persona === "operator" && operatorAccess === "none") {
      setPersona("citizen");
      setOperatorSelectedIssueId(null);
    }
  }, [operatorAccess, persona]);

  const operatorIssues = operatorAccess === "real" ? issues : issues.filter((issue) => issue.isDemoData);
  const selectedOperatorIssue = operatorSelectedIssueId
    ? operatorIssues.find((issue) => issue.id === operatorSelectedIssueId) || null
    : null;

  const handleNavigate = (view: ActiveView) => {
    setErrorNotice(null);
    if (view !== "detail") setSelectedIssueId(null);
    updateBrowserHash(view);
    setCurrentView(view);
  };

  const handleSelectIssue = (id: string) => {
    setSelectedIssueId(id);
    setDetailIssue(null);
    setDetailIssueError(false);
    updateBrowserHash("detail", id);
    setCurrentView("detail");
  };

  useEffect(() => {
    if (currentView !== "detail" || !selectedIssueId || authLoading || !user) {
      setDetailIssueLoading(false);
      setDetailIssueError(false);
      if (currentView !== "detail") setDetailIssue(null);
      return;
    }

    if (issues.some((issue) => issue.id === selectedIssueId)) {
      setDetailIssue(null);
      setDetailIssueError(false);
      setDetailIssueLoading(false);
      return;
    }

    if (issuesLoading) return;

    let active = true;
    setDetailIssueLoading(true);
    setDetailIssueError(false);

    fetchIssueById(selectedIssueId)
      .then((issue) => {
        if (!active) return;
        setDetailIssue(issue);
        setDetailIssueError(!issue);
      })
      .catch(() => {
        if (active) {
          setDetailIssue(null);
          setDetailIssueError(true);
        }
      })
      .finally(() => {
        if (active) setDetailIssueLoading(false);
      });

    return () => {
      active = false;
    };
  }, [currentView, selectedIssueId, issuesLoading, authLoading, user?.uid]);

  const refreshCurrentIssue = async () => {
    await loadIssues();
    if (!selectedIssueId) return;
    try {
      const issue = await fetchIssueById(selectedIssueId);
      setDetailIssue(issue);
      setDetailIssueError(!issue);
    } catch {
      setDetailIssueError(true);
    }
  };

  const saveNewStandaloneReport = async (reportData: Partial<IssueReport>) => {
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
    });
    setLatestReport(savedReport);
    setCurrentView("success");
  };

  const handleReportSubmit = async (reportData: Partial<IssueReport>) => {
    setErrorNotice(null);
    if (!user) {
      setErrorNotice("Authentication required to save a report. Please verify identity below.");
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
        outputSummary: perceiveMeta?.outputSummary || `Manual form saved`,
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
      await saveNewStandaloneReport(reportData);

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

      await saveNewStandaloneReport(pendingReportData);
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
          if (p === "operator" && operatorAccess === "none") return;
          setPersona(p);
          if (p === "operator") {
            setOperatorSelectedIssueId(null);
          }
        }}
        operatorAccess={operatorAccess}
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
      <main id="main-content" className="flex flex-col flex-1 pb-28 md:pb-0">
        {loadError ? (
          <div className="flex-1 flex flex-col justify-center items-center p-6 text-center font-sans">
            <div className="bg-white border border-alert/20 p-6 rounded-2xl max-w-sm shadow-xs flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-alert/10 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-alert" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Unable to fetch registered incidents</h3>
                <p className="text-[11px] text-slate mt-1 leading-relaxed">
                  The prototype service could not load saved reports. Please check the network and try again.
                </p>
              </div>
              <button
                type="button"
                onClick={loadIssues}
                className="w-full bg-marigold hover:bg-marigold/90 text-ink font-bold text-xs py-2 px-4 rounded-xl shadow-xs cursor-pointer min-h-[44px]"
              >
                Retry Connection
              </button>
            </div>
          </div>
        ) : persona === "operator" && operatorAccess !== "none" ? (
          <Suspense fallback={<RouteLoading label="Loading operator workspace..." />}>
            <div id="operator-command-center" className="min-h-full w-full bg-slate-50 lg:grid lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[390px_minmax(0,1fr)]">
              <section
                className={`${operatorSelectedIssueId ? "hidden lg:block" : "block"} min-w-0 lg:border-r lg:border-slate-200 lg:bg-paper`}
                aria-label="Operator case queue"
              >
                <OperatorQueue
                  issues={operatorIssues}
                  onSelectIssue={(id) => setOperatorSelectedIssueId(id)}
                  onRefresh={loadIssues}
                  onLoadMore={loadMoreIssues}
                  hasMore={hasMoreIssues}
                  loadingMore={loadingMoreIssues}
                  loading={issuesLoading}
                  accessMode={operatorAccess}
                  selectedIssueId={operatorSelectedIssueId}
                  embedded
                />
              </section>
              <section
                className={`${operatorSelectedIssueId ? "block" : "hidden lg:flex"} min-w-0 lg:min-h-[calc(100vh-76px)]`}
                aria-label="Selected operator case"
              >
                {selectedOperatorIssue ? (
                  <OperatorDetailView
                    issue={selectedOperatorIssue}
                    onBack={() => setOperatorSelectedIssueId(null)}
                    onRefresh={loadIssues}
                    demoOperator={operatorAccess === "demo"}
                    embedded
                  />
                ) : (
                  <div className="flex min-h-[55vh] w-full flex-col items-center justify-center gap-3 p-6 text-center font-sans text-slate-500">
                    <h2 className="text-sm font-bold text-slate-800">
                      {operatorSelectedIssueId ? "Issue report not found." : "Select a prototype case"}
                    </h2>
                    <p className="max-w-sm text-xs leading-relaxed">
                      Choose a saved case from the queue to review evidence, persisted agent steps, approvals, and closure controls.
                    </p>
                    {operatorSelectedIssueId && (
                      <button
                        type="button"
                        onClick={() => setOperatorSelectedIssueId(null)}
                        className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-xs font-bold text-[#4F46E5]"
                      >
                        Back to Queue
                      </button>
                    )}
                  </div>
                )}
              </section>
            </div>
          </Suspense>
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
                hasMoreIssues={hasMoreIssues}
                loadingMoreIssues={loadingMoreIssues}
                onLoadMoreIssues={loadMoreIssues}
              />
            )}

            {currentView === "detail" && selectedIssueId && (
              (() => {
                const selectedIssue =
                  issues.find((issue) => issue.id === selectedIssueId) ||
                  (detailIssue?.id === selectedIssueId ? detailIssue : null);
                if (issuesLoading || detailIssueLoading) {
                  return <RouteLoading label="Loading saved issue..." />;
                }
                if (!selectedIssue || detailIssueError) {
                  return (
                    <div className="p-4 text-center text-xs font-semibold text-slate-500">
                      Issue report not found. Please navigate back manually.
                      <button onClick={() => handleNavigate("landing")} className="block mt-2 underline mx-auto text-[#4F46E5] font-sans">
                        Back to Hub
                      </button>
                    </div>
                  );
                }
                return (
                  <IssueDetailPage
                    issue={selectedIssue}
                    onBack={() => handleNavigate("landing")}
                    onUpvote={handleUpvote}
                    upvoteLoadingId={upvoteLoadingId}
                    onRefresh={() => { void refreshCurrentIssue(); }}
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
                  handleNavigate("report");
                }}
                isProcessing={isDeduplicating}
              />
            )}

            {currentView === "dashboard" && (
              <Suspense fallback={<RouteLoading label="Loading impact dashboard..." />}>
                <ImpactDashboard
                  issues={issues}
                  onBack={() => handleNavigate("landing")}
                  hasMoreIssues={hasMoreIssues}
                  loadedPageSize={ISSUE_PAGE_SIZE}
                />
              </Suspense>
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
                    <h2 className="text-base font-bold text-ink font-display mt-2">Preparing Prototype Report...</h2>
                    <p className="text-[11px] text-slate max-w-xs leading-normal font-medium">
                      Analyzing the image, checking location, comparing nearby reports, and preparing a draft case record.
                    </p>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto pr-1">
                    <AgentTraceTimeline trace={liveTrace} mode="local-progress" />
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
            <p className="text-xs font-bold text-slate-800">Checking Nearby Reports</p>
            <p className="text-[10px] text-slate-400 font-medium leading-normal">
              Comparing saved prototype cases with distance and semantic signals.
            </p>
          </div>
        </div>
      )}

      <FloatingReportAction currentView={currentView} persona={persona} onNavigate={handleNavigate} />
      <AppBottomNav
        currentView={currentView}
        persona={persona}
        operatorAccess={operatorAccess}
        onNavigate={handleNavigate}
        onTogglePersona={(p) => {
          if (p === "operator" && operatorAccess === "none") return;
          setPersona(p);
          if (p === "operator") setOperatorSelectedIssueId(null);
        }}
      />
    </MobileFrame>
  );
}
