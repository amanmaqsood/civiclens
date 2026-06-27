import React, { useMemo, useState } from "react";
import { ArrowUp, MapPin, Search } from "lucide-react";
import { motion } from "motion/react";
import { IssueReport } from "../types";
import { humanizeCategory } from "../utils/humanize";
import { useLanguage } from "../context/LanguageContext";
import { ISSUE_STATUS_KEYS, IssueStatusKey, issueStatusLabel } from "../constants/status";

interface IssueListWithFilterProps {
  issues: IssueReport[];
  onSelectIssue: (id: string) => void;
  onUpvote: (id: string) => Promise<void>;
  upvoteLoadingId: string | null;
  loading?: boolean;
  onNavigateToReport?: () => void;
}

type StatusFilter = "All" | IssueStatusKey;

export default function IssueListWithFilter({
  issues,
  onSelectIssue,
  onUpvote,
  upvoteLoadingId,
  loading = false,
  onNavigateToReport,
}: IssueListWithFilterProps) {
  const { language, t } = useLanguage();
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All");
  const [searchTerm, setSearchTerm] = useState("");

  const filters: StatusFilter[] = ["All", ...ISSUE_STATUS_KEYS];

  const filteredIssues = useMemo(() => {
    return issues.filter((issue) => {
      const matchesStatus = activeFilter === "All" || issue.status === activeFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        issue.category.toLowerCase().includes(term) ||
        issue.description.toLowerCase().includes(term) ||
        (issue.title && issue.title.toLowerCase().includes(term)) ||
        (issue.locationName && issue.locationName.toLowerCase().includes(term));
      return matchesStatus && matchesSearch;
    });
  }, [issues, activeFilter, searchTerm]);

  const getStatusClasses = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-marigold/10 border-marigold/25 text-[#7A4300]";
      case "in_progress":
        return "bg-[#3B82F6]/10 border-[#3B82F6]/25 text-[#1D4ED8]";
      case "resolved":
        return "bg-verify/10 border-verify/25 text-[#047857]";
      default:
        return "bg-slate/10 border-slate/25 text-[#334155]";
    }
  };

  return (
    <div id="issue-list-with-filter" className="flex flex-col gap-4 font-sans">
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate" />
        <input
          type="text"
          placeholder="Search registered incidents..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-hairline bg-white py-2.5 pl-10 pr-4 text-base text-ink shadow-2xs outline-none transition-colors placeholder:text-slate/60 focus:border-marigold focus:ring-1 focus:ring-marigold"
        />
      </div>

      <div className="no-scrollbar flex select-none gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {filters.map((filter) => {
          const isSelected = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`min-h-[44px] whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
                isSelected
                  ? "border-ink bg-ink text-paper shadow-2xs"
                  : "border-hairline bg-white text-[#334155] hover:border-slate/40 hover:text-ink"
              }`}
            >
              {filter === "All" ? "All" : issueStatusLabel(filter)}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between px-1 text-sm font-bold text-[#334155]">
        <span>Reports</span>
        <span>{filteredIssues.length} matching</span>
      </div>

      <div className="flex flex-col gap-3">
        {loading ? (
          [1, 2, 3].map((item) => (
            <div key={item} className="flex animate-pulse flex-col gap-3 rounded-2xl border border-hairline bg-white p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="h-5 w-16 rounded-full bg-slate-200" />
              </div>
              <div className="flex gap-3">
                <div className="h-14 w-14 shrink-0 rounded-xl bg-slate-200" />
                <div className="min-w-0 flex-1">
                  <div className="mb-2 h-4 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-200" />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-hairline/65 pt-2.5">
                <div className="h-3 w-12 rounded bg-slate-200" />
                <div className="h-7 w-24 rounded-xl bg-slate-200" />
              </div>
            </div>
          ))
        ) : filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-hairline bg-white p-6 text-center shadow-xs">
            <p className="text-sm font-medium text-[#334155]">No active records match the filter.</p>
            {onNavigateToReport && (
              <button
                type="button"
                onClick={onNavigateToReport}
                className="min-h-[44px] rounded-xl bg-marigold px-4 py-2 text-base font-bold text-ink shadow-3xs hover:bg-marigold/90"
              >
                File a New Report
              </button>
            )}
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              key={issue.id}
              className="relative flex flex-col gap-3 rounded-2xl border border-hairline bg-white p-4 shadow-[0_3px_12px_-3px_rgba(14,26,43,0.04)] transition-all hover:border-slate/30 hover:shadow-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="rounded-lg border border-hairline bg-paper px-2 py-1 text-sm font-mono text-ink">
                    {humanizeCategory(issue.category)}
                  </span>
                  {issue.priorityScore !== undefined && (
                    <span className="flex items-center gap-0.5 rounded-lg border border-white/5 bg-ink px-2 py-1 text-sm font-semibold text-marigold">
                      Score {Math.round(issue.priorityScore)} pts
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {issue.isDemoData && (
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-sm font-bold text-[#334155]">
                      DEMO
                    </span>
                  )}
                  <span className={`rounded-lg border px-2 py-1 text-sm font-semibold ${getStatusClasses(issue.status)}`}>
                    {issueStatusLabel(issue.status)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectIssue(issue.id)}
                className="flex w-full gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-marigold"
                aria-label={`View details of ticket ${issue.ticketId}`}
              >
                {issue.image && (
                  <div className="h-14 w-14 flex-shrink-0 select-none overflow-hidden rounded-xl border border-hairline bg-paper">
                    <img
                      src={issue.image}
                      alt={`Civic incident category: ${issue.category.replace(/_/g, " ")}`}
                      width={56}
                      height={56}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1 pr-1">
                  <h4 className="line-clamp-1 text-lg font-bold leading-snug text-ink transition-colors group-hover:text-marigold">
                    {language === "hi"
                      ? (issue.titleHi || issue.title || "Geotagged Civic Incident")
                      : (issue.title || "Geotagged Civic Incident")}
                  </h4>
                  <p className="mt-1 line-clamp-2 text-base font-normal leading-relaxed text-[#334155]">
                    {language === "hi"
                      ? (issue.summaryHi || issue.summary || issue.description)
                      : (issue.summary || issue.description)}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[#334155]">
                    <MapPin className="h-3 w-3 text-marigold" />
                    <span className="truncate text-sm font-medium">{issue.locationName || "Reported Location"}</span>
                  </div>
                </div>
              </button>

              <div className="mt-0.5 flex items-center justify-between border-t border-hairline/80 pt-2.5">
                <span className="text-sm font-mono text-[#334155]">{issue.ticketId}</span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSelectIssue(issue.id)}
                    className="min-h-[44px] rounded-xl px-3 text-sm font-bold text-[#334155] hover:bg-paper hover:text-ink"
                  >
                    {t("card.details")}
                  </button>
                  <button
                    disabled={upvoteLoadingId === issue.id}
                    onClick={() => onUpvote(issue.id)}
                    className="flex min-h-[44px] items-center gap-1 rounded-xl border border-hairline bg-paper px-3 py-2 text-sm font-bold text-ink transition-colors hover:bg-marigold hover:text-ink disabled:opacity-50"
                  >
                    <ArrowUp className="h-3 w-3" />
                    <span>
                      {upvoteLoadingId === issue.id
                        ? "..."
                        : `${issue.citizenUpvotes} ${
                            language === "hi"
                              ? "Support"
                              : issue.citizenUpvotes === 1
                                ? "Upvote"
                                : "Upvotes"
                          }`}
                    </span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
