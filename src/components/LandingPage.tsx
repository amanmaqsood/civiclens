import React, { Suspense, lazy, useState } from "react";
import { Camera, TrendingUp, CheckCircle2, Users } from "lucide-react";
import { ActiveView, IssueReport } from "../types";
import IssueListWithFilter from "./IssueListWithFilter";
import Onboarding from "./Onboarding";
import { useLanguage } from "../context/LanguageContext";

const HomeMap = lazy(() => import("./HomeMap"));

interface LandingPageProps {
  onNavigate: (view: ActiveView) => void;
  issues: IssueReport[];
  onUpvote: (id: string) => Promise<void>;
  upvoteLoadingId: string | null;
  onSelectIssue: (id: string) => void;
  userLocation: { lat: number; lng: number } | null;
  onUserLocationChange: (loc: { lat: number; lng: number } | null) => void;
  loading?: boolean;
  hasMoreIssues?: boolean;
  loadingMoreIssues?: boolean;
  onLoadMoreIssues?: () => void;
}

export default function LandingPage({
  onNavigate,
  issues,
  onUpvote,
  upvoteLoadingId,
  onSelectIssue,
  userLocation,
  onUserLocationChange,
  loading = false,
  hasMoreIssues = false,
  loadingMoreIssues = false,
  onLoadMoreIssues,
}: LandingPageProps) {
  const { t } = useLanguage();
  const [showDemoBanner, setShowDemoBanner] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem("has_seen_onboarding");
  });
  const hasDemoData = issues.some(i => i.isDemoData);

  return (
    <div id="landing-page-root" className="flex flex-col gap-4 px-4 py-4 font-sans pb-16">
      {showOnboarding && <Onboarding onDismiss={() => setShowOnboarding(false)} />}
      
      {/* Noticeable but dismissible alert banner */}
      {showDemoBanner && hasDemoData && (
        <div className="bg-marigold/10 border border-marigold/35 text-ink text-xs p-3 rounded-2xl flex items-start gap-2.5 relative shadow-3xs">
          <div className="flex-1">
            <p className="font-bold text-xs text-ink">Sample data</p>
            <p className="text-[#475569] text-[11px] mt-0.5 leading-relaxed">
              These Bengaluru reports are pre-seeded samples to demonstrate the workflow. File your own report anytime, or clear samples from the Operator panel.
            </p>
          </div>
          <button 
            type="button"
            onClick={() => setShowDemoBanner(false)}
            className="text-slate hover:text-ink font-bold text-lg leading-none p-0.5 -mt-0.5 shrink-0 select-none cursor-pointer"
            aria-label="Dismiss demo banner"
          >
            &times;
          </button>
        </div>
      )}

      {/* Banner Card / Hero */}
      <div className="bg-ink text-white p-5 rounded-2xl relative overflow-hidden shadow-[0_6px_24px_-8px_rgba(14,26,43,0.3)] border border-white/5">
        <div className="absolute -right-12 -bottom-12 w-40 h-40 rounded-full bg-marigold/10 blur-2xl" />
        
        <div className="relative z-10 flex flex-col gap-3">
          <span className="self-start text-[10px] font-mono lg:text-xs font-bold uppercase tracking-widest bg-marigold text-ink px-2.5 py-0.5 rounded-full select-none">
            {t("hero.title")}
          </span>
          <h2 className="text-sm font-sans text-white/90 animate-fade-in leading-relaxed">
            {t("hero.subtitle")}
          </h2>
          <button
            id="report-issue-btn"
            onClick={() => onNavigate("report")}
            className="mt-1 w-full flex items-center justify-center gap-2 bg-marigold hover:bg-marigold/95 font-bold text-ink text-sm py-3 px-5 rounded-xl transition duration-150 active:scale-[0.98] cursor-pointer font-sans"
            style={{ minHeight: "44px" }}
            aria-label={t("hero.reportButton")}
          >
            <Camera className="w-4 h-4 flex-shrink-0" />
            {t("hero.reportButton")}
          </button>
        </div>
      </div>

      {/* Google Interactive Map Section */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider px-1">
          Live map
        </h3>
        <Suspense fallback={<div className="h-[280px] rounded-2xl border border-hairline bg-white p-4 text-xs font-bold text-slate">Loading map...</div>}>
          <HomeMap 
            issues={issues} 
            onSelectIssue={onSelectIssue} 
            userLocation={userLocation}
            onUserLocationChange={onUserLocationChange}
          />
        </Suspense>
      </div>

      {/* Searchable, Filterable list section */}
      <IssueListWithFilter
        issues={issues}
        onSelectIssue={onSelectIssue}
        onUpvote={onUpvote}
        upvoteLoadingId={upvoteLoadingId}
        loading={loading}
        onNavigateToReport={() => onNavigate("report")}
      />

      <div className="flex flex-col items-center gap-2 text-center">
        {hasMoreIssues ? (
          <button
            type="button"
            onClick={onLoadMoreIssues}
            disabled={loadingMoreIssues}
            className="min-h-[44px] rounded-xl border border-hairline bg-white px-4 text-xs font-bold text-ink shadow-2xs hover:bg-paper disabled:opacity-60"
          >
            {loadingMoreIssues ? "Loading more records..." : "Load more saved records"}
          </button>
        ) : (
          <p className="text-[10.5px] font-medium text-[#334155]">
            Showing all records loaded by the current query page.
          </p>
        )}
      </div>

      {/* Progress & Live Network Stats */}
      <div className="bg-white border border-hairline p-4 rounded-2xl flex flex-col gap-3 shadow-xs">
        <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-marigold" />
          Loaded Report Stats
        </h3>

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="p-2.5 bg-paper rounded-xl border border-hairline">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#334155]">Reported</p>
            <p id="stats-total-reported" className="text-sm font-display font-black text-marigold">{issues.length}</p>
          </div>
          <div className="p-2.5 bg-paper rounded-xl border border-hairline">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#334155]">Executing</p>
            <p id="stats-in-progress" className="text-sm font-display font-black text-[#3B82F6]">
              {issues.filter(i => i.status === "in_progress" || i.status === "verified").length}
            </p>
          </div>
          <div className="p-2.5 bg-paper rounded-xl border border-hairline">
            <p className="text-[10px] font-mono uppercase tracking-wider text-[#334155]">Resolved</p>
            <p id="stats-resolved" className="text-sm font-display font-black text-verify">
              {issues.filter(i => i.status === "resolved").length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#E9F7F5] border border-verify/10 p-2.5 rounded-xl">
          <CheckCircle2 className="w-3.5 h-3.5 text-verify flex-shrink-0" />
          <p className="text-xs text-[#334155] leading-snug font-medium">
            Metrics are calculated from the records currently loaded in this prototype, with synthetic demo records labelled separately.
          </p>
        </div>
      </div>

      {/* Footer Decoration */}
      <div className="flex items-center justify-center gap-1.5 py-1 text-center">
        <Users className="w-3.5 h-3.5 text-[#334155]" />
        <span className="text-[10px] text-[#334155] font-mono tracking-widest uppercase">
          Independent Civic Prototype
        </span>
      </div>
    </div>
  );
}
