import React, { useState, useMemo } from "react";
import { ArrowUp, MapPin, Search } from "lucide-react";
import { IssueReport } from "../types";
import { motion } from "motion/react";
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

  // Exact Status color tokens matching specification
  const getStatusClasses = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-marigold/10 border-marigold/25 text-[#7A4300]";
      case "in_progress":
        return "bg-[#3B82F6]/10 border-[#3B82F6]/25 text-[#1D4ED8]";
      case "resolved":
        return "bg-verify/10 border-verify/25 text-[#047857]";
      default: // Submitted
        return "bg-slate/10 border-slate/25 text-[#334155]";
    }
  };

  return (
    <div id="issue-list-with-filter" className="flex flex-col gap-4 font-sans">
      {/* Search Input */}
      <div className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate" />
        <input
          type="text"
          placeholder="Search registered incidents..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-hairline outline-none focus:border-marigold focus:ring-1 focus:ring-marigold bg-white text-ink transition-colors font-sans shadow-2xs placeholder:text-slate/60"
        />
      </div>

      {/* Filter Segmented Row */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar select-none">
        {filters.map((filter) => {
          const isSelected = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`text-xs font-sans font-semibold px-2.5 py-1 rounded-full border transition-all cursor-pointer whitespace-nowrap uppercase tracking-wider ${
                isSelected
                  ? "bg-ink border-ink text-paper shadow-2xs"
              : "bg-white border-hairline text-[#334155] hover:text-ink hover:border-slate/40"
              }`}
            >
              {filter === "All" ? "All" : issueStatusLabel(filter)}
            </button>
          );
        })}
      </div>

      {/* Matching Header */}
      <div className="flex justify-between items-center text-xs font-mono font-bold text-[#334155] uppercase tracking-widest px-1">
        <span>Reports</span>
        <span>{filteredIssues.length} matching</span>
      </div>

      {/* Responsive List items */}
      <div className="flex flex-col gap-3">
        {loading ? (
          /* Loading skeletons */
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-hairline rounded-2xl p-4 flex flex-col gap-3 animate-pulse shadow-2xs">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-slate-200 rounded w-24" />
                <div className="h-5 bg-slate-200 rounded-full w-16" />
              </div>
              <div className="flex gap-3">
                <div className="w-14 h-14 bg-slate-200 rounded-xl shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
              </div>
              <div className="border-t border-hairline/65 pt-2.5 flex justify-between items-center">
                <div className="h-3 bg-slate-200 rounded w-12" />
                <div className="h-7 bg-slate-200 rounded-xl w-24" />
              </div>
            </div>
          ))
        ) : filteredIssues.length === 0 ? (
          <div className="bg-white border border-hairline rounded-2xl p-6 text-center shadow-xs flex flex-col items-center gap-3">
            <p className="text-[13px] font-medium text-[#334155]">No active records match the filter.</p>
            {onNavigateToReport && (
              <button
                type="button"
                onClick={onNavigateToReport}
                className="text-xs bg-marigold text-ink font-bold px-4 py-2 rounded-xl hover:bg-marigold/90 cursor-pointer shadow-3xs"
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
              className="bg-white border border-hairline rounded-2xl p-4 shadow-[0_3px_12px_-3px_rgba(14,26,43,0.04)] flex flex-col gap-3 relative transition-all hover:shadow-xs hover:border-slate/30"
            >
              {/* Top Tags Row */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs bg-paper text-ink font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border border-hairline">
                    {humanizeCategory(issue.category)}
                  </span>
                  {issue.priorityScore !== undefined && (
                    <span className="text-xs bg-ink text-marigold font-mono font-semibold px-2 py-0.5 rounded-full border border-white/5 flex items-center gap-0.5 select-none md:scale-100">
                      ★ {Math.round(issue.priorityScore)} pts
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {issue.isDemoData && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-100 text-[#334155] uppercase tracking-wider">
                      DEMO
                    </span>
                  )}
                  <span className={`text-xs font-mono font-semibold uppercase tracking-wider border px-2 py-0.5 rounded-full ${getStatusClasses(issue.status)}`}>
                    {issueStatusLabel(issue.status)}
                  </span>
                </div>
              </div>

              {/* Dynamic summary click area */}
              <button
                type="button"
                onClick={() => onSelectIssue(issue.id)}
                className="flex gap-3 cursor-pointer group text-left w-full focus:outline-none"
                aria-label={`View details of ticket ${issue.ticketId}`}
              >
                {issue.image && (
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-paper flex-shrink-0 border border-hairline select-none">
                    <img
                      src={issue.image}
                      alt={`Civic incident category: ${issue.category.replace(/_/g, " ")}`}
                      width={56}
                      height={56}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-1">
                  <h4 className="text-sm font-semibold text-ink line-clamp-1 leading-snug group-hover:text-marigold transition-colors font-sans">
                    {language === "hi"
                      ? (issue.titleHi || issue.title || "Geotagged Civic Incident")
                      : (issue.title || "Geotagged Civic Incident")}
                  </h4>
                  <p className="text-[13px] text-[#334155] line-clamp-2 leading-relaxed mt-0.5 font-sans font-normal">
                    {language === "hi"
                      ? (issue.summaryHi || issue.summary || issue.description)
                      : (issue.summary || issue.description)}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-[#334155] font-sans">
                    <MapPin className="w-3 h-3 text-marigold" />
                    <span className="text-xs truncate font-medium">{issue.locationName || "Reported Location"}</span>
                  </div>
                </div>
              </button>

              {/* Card Footer row */}
              <div className="border-t border-hairline/80 pt-2.5 flex items-center justify-between mt-0.5">
                <span className="text-xs font-mono text-[#334155] uppercase tracking-tight">
                  {issue.ticketId}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSelectIssue(issue.id)}
                    className="text-xs font-sans font-semibold text-[#334155] hover:text-ink px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    {t("card.details")}
                  </button>
                  <button
                    disabled={upvoteLoadingId === issue.id}
                    onClick={() => onUpvote(issue.id)}
                    className="flex items-center gap-1 bg-paper hover:bg-marigold hover:text-ink px-3 py-1.5 rounded-xl text-xs font-sans font-bold text-ink border border-hairline transition-colors cursor-pointer"
                    style={{ minHeight: "34px" }}
                  >
                    <ArrowUp className="w-3 h-3" />
                    <span>
                      {upvoteLoadingId === issue.id 
                        ? "..." 
                        : `${issue.citizenUpvotes} ${
                            language === "hi" 
                              ? "समर्थन" 
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
