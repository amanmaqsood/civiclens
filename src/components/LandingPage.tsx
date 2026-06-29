import React, { Suspense, lazy, useMemo, useState } from "react";
import { Camera, CheckCircle2, GitMerge, MapPinned, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ActiveView, IssueReport } from "../types";
import IssueListWithFilter from "./IssueListWithFilter";
import Onboarding from "./Onboarding";
import { useLanguage } from "../context/LanguageContext";
import { isInternalSmokeTestIssue } from "../utils/issueVisibility";

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
  const [showAllDemoData, setShowAllDemoData] = useState(false);

  const { visibleIssues, demoIssues, hiddenDemoCount, publicIssues } = useMemo(() => {
    const publicIssues = issues.filter((issue) => !isInternalSmokeTestIssue(issue));
    const real = publicIssues.filter((issue) => !issue.isDemoData);
    const demo = publicIssues.filter((issue) => issue.isDemoData);
    const curatedDemo = [...demo]
      .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0))
      .slice(0, 3);
    const defaultStories = curatedDemo.length > 0 ? curatedDemo : real.slice(0, 3);
    return {
      visibleIssues: showAllDemoData ? publicIssues : defaultStories,
      demoIssues: demo,
      hiddenDemoCount: Math.max(0, demo.length - curatedDemo.length),
      publicIssues,
    };
  }, [issues, showAllDemoData]);

  const activeCount = visibleIssues.filter((issue) => issue.status === "submitted" || issue.status === "verified" || issue.status === "in_progress").length;
  const resolvedCount = visibleIssues.filter((issue) => issue.status === "resolved").length;

  const proofCards = [
    {
      icon: Camera,
      title: t("proof.field.title"),
      body: t("proof.field.body"),
    },
    {
      icon: Sparkles,
      title: t("proof.agent.title"),
      body: t("proof.agent.body"),
    },
    {
      icon: ShieldCheck,
      title: t("proof.human.title"),
      body: t("proof.human.body"),
    },
  ];

  return (
    <div id="landing-page-root" className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-5 pb-24 font-sans text-ink sm:px-6 lg:px-8 lg:py-8">
      {showOnboarding && <Onboarding onDismiss={() => setShowOnboarding(false)} />}

      {showDemoBanner && demoIssues.length > 0 && (
        <div className="rounded-2xl border border-marigold/35 bg-marigold/10 p-4 text-ink shadow-3xs">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-marigold shadow-3xs">
              <Users className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold">{t("demo.title")}</p>
              <p className="mt-1 max-w-3xl text-base leading-relaxed text-ink-2">
                {t("demo.banner")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowDemoBanner(false)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-xl font-bold text-slate hover:bg-white/70 hover:text-ink"
              aria-label={t("demo.dismiss")}
            >
              &times;
            </button>
          </div>
        </div>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.1fr)] lg:items-stretch">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink p-6 text-white shadow-[0_18px_60px_-40px_rgba(14,26,43,0.9)] sm:p-8">
          <div className="relative z-10 flex h-full min-h-[360px] flex-col justify-between gap-8">
            <div className="flex flex-col gap-5">
              <span className="w-fit rounded-lg bg-marigold px-3 py-1 text-sm font-bold text-ink">
                {t("hero.badge")}
              </span>
              <div className="max-w-2xl">
                <h2 className="text-4xl font-black leading-[1.02] tracking-normal text-white sm:text-5xl lg:text-6xl">
                  {t("hero.title")}
                </h2>
                <p className="mt-5 max-w-[62ch] text-lg leading-relaxed text-white/78">
                  {t("hero.subtitle")}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  id="report-issue-btn"
                  onClick={() => onNavigate("report")}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-marigold px-5 text-base font-bold text-ink shadow-sm transition active:scale-[0.98]"
                  aria-label={t("hero.reportButton")}
                >
                  <Camera className="h-5 w-5" />
                  {t("hero.reportButton")}
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById("issue-list-with-filter")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/8 px-5 text-base font-bold text-white transition hover:bg-white/12 active:scale-[0.98]"
                >
                  <MapPinned className="h-5 w-5 text-marigold" />
                  {t("hero.viewIssues")}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {proofCards.map((card) => {
                const Icon = card.icon;
                return (
                  <div key={card.title} className="rounded-2xl border border-white/10 bg-white/8 p-4">
                    <Icon className="h-5 w-5 text-marigold" />
                    <p className="mt-3 text-base font-bold text-white">{card.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-white/70">{card.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-hairline bg-white p-4 shadow-[0_12px_42px_-34px_rgba(14,26,43,0.7)] sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-ink">{t("hero.mapTitle")}</h3>
              <p className="mt-1 text-base text-ink-2">{t("hero.mapSubtitle")}</p>
            </div>
            {demoIssues.length > 0 && (
              <span className="rounded-lg border border-marigold/30 bg-marigold/10 px-3 py-1 text-sm font-bold text-marigold-ink">
                {t("hero.syntheticVisible")}
              </span>
            )}
          </div>
          <Suspense fallback={<div className="h-[320px] rounded-2xl border border-hairline bg-paper p-4 text-base font-bold text-slate">{t("hero.loadingMap")}</div>}>
            <HomeMap
              issues={visibleIssues}
              onSelectIssue={onSelectIssue}
              userLocation={userLocation}
              onUserLocationChange={onUserLocationChange}
            />
          </Suspense>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-hairline bg-white p-5 shadow-xs">
          <p className="text-sm font-bold text-ink-2">{t("hero.loadedRecords")}</p>
          <p id="stats-total-reported" className="mt-2 text-4xl font-black text-marigold">{visibleIssues.length}</p>
          <p className="mt-1 text-base text-ink-2">{t("hero.visibleRecords")}</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white p-5 shadow-xs">
          <p className="text-sm font-bold text-ink-2">{t("hero.activeCases")}</p>
          <p id="stats-in-progress" className="mt-2 text-4xl font-black text-[#2563EB]">{activeCount}</p>
          <p className="mt-1 text-base text-ink-2">{t("hero.activeCasesHint")}</p>
        </div>
        <div className="rounded-2xl border border-hairline bg-white p-5 shadow-xs">
          <p className="text-sm font-bold text-ink-2">{t("hero.resolvedRecords")}</p>
          <p id="stats-resolved" className="mt-2 text-4xl font-black text-verify">{resolvedCount}</p>
          <p className="mt-1 text-base text-ink-2">{t("hero.resolvedHint")}</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h3 className="text-2xl font-black text-ink">{t("hero.caseStories")}</h3>
            <p className="mt-1 max-w-3xl text-base leading-relaxed text-ink-2">
              {t("hero.metricsNote")}
            </p>
          </div>
          {!showAllDemoData && hiddenDemoCount > 0 && (
            <button
              type="button"
              id="show-all-demo-data"
              onClick={() => setShowAllDemoData(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-hairline bg-white px-4 text-base font-bold text-ink shadow-2xs hover:bg-paper"
            >
              <GitMerge className="h-4 w-4 text-marigold" />
              {t("hero.showAllDemo")} ({hiddenDemoCount} hidden)
            </button>
          )}
        </div>

        <IssueListWithFilter
          issues={visibleIssues}
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
              className="min-h-[44px] rounded-xl border border-hairline bg-white px-4 text-base font-bold text-ink shadow-2xs hover:bg-paper disabled:opacity-60"
            >
              {loadingMoreIssues ? t("hero.loadingMore") : t("hero.loadMore")}
            </button>
          ) : (
            <p className="text-sm font-medium text-ink-2">
              {t("hero.showingAll")}
            </p>
          )}
        </div>
      </section>

      <div className="flex items-center justify-center gap-2 py-2 text-center">
        <CheckCircle2 className="h-4 w-4 text-verify" />
        <span className="text-sm font-semibold text-ink-2">
          {t("app.boundary")}
        </span>
      </div>
    </div>
  );
}
