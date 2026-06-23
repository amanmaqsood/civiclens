import React, { useState, useEffect } from "react";
import { ActiveView, IssueReport } from "./types";
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
  submitEvidenceForIssue
} from "./services/issues";
import { AlertCircle, Loader2 } from "lucide-react";
import DuplicateCheckPage from "./components/DuplicateCheckPage";
import OperatorQueue from "./components/OperatorQueue";
import OperatorDetailView from "./components/OperatorDetailView";
import ImpactDashboard from "./components/ImpactDashboard";

export default function App() {
  const { user } = useFirebase();
  const [currentView, setCurrentView] = useState<ActiveView>("landing");
  const [latestReport, setLatestReport] = useState<Partial<IssueReport> | null>(null);
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [upvoteLoadingId, setUpvoteLoadingId] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);

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

  // Load issues from Firestore
  const loadIssues = async () => {
    setIssuesLoading(true);
    try {
      const data = await fetchRecentIssues();
      setIssues(data);
    } catch (err) {
      console.error("Failed to load issues:", err);
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
      setErrorNotice("Authentication required to file complaints. Please verify identity below.");
      return;
    }

    setIsDeduplicating(true);
    setDedupConfirmedMerged(false);

    try {
      // If the report has no location data, we skip duplicate check per instruction
      if (typeof reportData.lat !== "number" || typeof reportData.lng !== "number" || isNaN(reportData.lat) || isNaN(reportData.lng)) {
        await saveNewStandaloneReport(reportData);
        setIsDeduplicating(false);
        return;
      }

      // 1. Fetch nearest duplicate candidates (Filters 14-day window, proximity, and status in JS)
      const localCandidates = await findDuplicateCandidates(reportData);
      if (localCandidates.length === 0) {
        await saveNewStandaloneReport(reportData);
        setIsDeduplicating(false);
        return;
      }

      // 2. Call server-side duplicate determination endpoint
      const rawCandidates = localCandidates.map(c => c.issue);
      const aiResponse = await checkDuplicateWithAI(reportData, rawCandidates);

      if (aiResponse.recommendation === "create_new" || !aiResponse.bestCandidateId) {
        await saveNewStandaloneReport(reportData);
        setIsDeduplicating(false);
        return;
      }

      // We have recommendation "merge" or "ask_user"
      const matchedCandidateObj = localCandidates.find(c => c.issue.id === aiResponse.bestCandidateId);
      if (!matchedCandidateObj) {
        await saveNewStandaloneReport(reportData);
        setIsDeduplicating(false);
        return;
      }

      // Present the duplication review view to get explicit consent
      setPendingReportData(reportData);
      setDuplicateCandidate(matchedCandidateObj.issue);
      setDuplicateDistance(matchedCandidateObj.distance);
      setDuplicateReasons(aiResponse.reasons);
      setDuplicateSimilarity(aiResponse.similarity);
      setIsDeduplicating(false);
      setCurrentView("duplicate");

    } catch (err: any) {
      console.error("Deduplication error pipeline:", err);
      // Fallback cleanly to save report rather than losing raw citizen reports
      try {
        await saveNewStandaloneReport(reportData);
      } catch (saveErr: any) {
        setErrorNotice(saveErr.message || "Failed to submit report. Please check rules & try again.");
      }
      setIsDeduplicating(false);
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
    setIsDeduplicating(true);

    try {
      await saveNewStandaloneReport(pendingReportData);
    } catch (err: any) {
      setErrorNotice(err.message || "Failed to submit new report.");
    } finally {
      setIsDeduplicating(false);
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
        <div className="mx-4 mt-3 bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-xl flex flex-col gap-2 shadow-xs transition-all">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs font-semibold leading-relaxed">
              {errorNotice}
            </div>
          </div>
        </div>
      )}

      {/* View Router */}
      {persona === "operator" ? (
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
              onBack={() => handleNavigate("landing")}
              onSubmit={handleReportSubmit}
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
                setPendingReportData(null);
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
        </>
      )}

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
