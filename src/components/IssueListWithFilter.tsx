import React, { useState, useMemo } from "react";
import { ArrowUp, MapPin, Search } from "lucide-react";
import { IssueReport } from "../types";
import { motion } from "motion/react";

interface IssueListWithFilterProps {
  issues: IssueReport[];
  onSelectIssue: (id: string) => void;
  onUpvote: (id: string) => Promise<void>;
  upvoteLoadingId: string | null;
}

type StatusFilter = "All" | "Submitted" | "Verified" | "In Progress" | "Resolved";

export default function IssueListWithFilter({
  issues,
  onSelectIssue,
  onUpvote,
  upvoteLoadingId,
}: IssueListWithFilterProps) {
  const [activeFilter, setActiveFilter] = useState<StatusFilter>("All");
  const [searchTerm, setSearchTerm] = useState("");

  const filters: StatusFilter[] = ["All", "Submitted", "Verified", "In Progress", "Resolved"];

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Verified":
        return "bg-indigo-50 border-indigo-100 text-indigo-700";
      case "In Progress":
        return "bg-amber-50 border-amber-100 text-amber-700";
      case "Resolved":
        return "bg-emerald-50 border-emerald-100 text-emerald-700";
      default:
        return "bg-slate-50 border-slate-100 text-slate-600";
    }
  };

  return (
    <div id="issue-list-with-filter" className="flex flex-col gap-4 font-sans">
      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search issues by category, title, description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-[#4F46E5] bg-white text-slate-700 transition-colors"
        />
      </div>

      {/* Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
        {filters.map((filter) => {
          const isSelected = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`text-[10px] sm:text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? "bg-slate-900 border-slate-900 text-white shadow-3xs"
                  : "bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Counter */}
      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
        <span>Filtered Feed</span>
        <span>{filteredIssues.length} matching</span>
      </div>

      {/* Scrollable grid list */}
      <div className="flex flex-col gap-3">
        {filteredIssues.length === 0 ? (
          <div className="bg-white border border-slate-150 rounded-2xl p-6 text-center shadow-3xs">
            <p className="text-xs font-bold text-slate-500">No active reports match this filter.</p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              key={issue.id}
              className="bg-white border border-slate-150 hover:border-slate-300 rounded-2xl p-4 shadow-3xs flex flex-col gap-3 relative transition-all"
            >
              {/* Header tags */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5 items-center">
                  <span className="text-[9px] bg-slate-100 text-slate-700 font-extrabold px-2 py-0.5 rounded-full">
                    {issue.category}
                  </span>
                  {issue.priorityScore !== undefined && (
                    <span className="text-[9px] bg-slate-900 text-amber-300 font-extrabold px-2 py-0.5 rounded-full border border-slate-800 flex items-center gap-0.5">
                      ★ {issue.priorityScore} Pts
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {issue.isDemoData && (
                    <span className="text-[9px] font-extrabold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Demo
                    </span>
                  )}
                  <span className={`text-[9px] font-extrabold border px-2 py-0.5 rounded-full ${getStatusColor(issue.status)}`}>
                    {issue.status}
                  </span>
                </div>
              </div>

              {/* Dynamic summary and image */}
              <div
                onClick={() => onSelectIssue(issue.id)}
                className="flex gap-3 cursor-pointer group"
              >
                {issue.image && (
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100/50">
                    <img
                      src={issue.image}
                      alt={issue.category}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0 pr-1">
                  <h4 className="text-xs font-bold text-slate-800 line-clamp-1 leading-snug group-hover:text-[#4F46E5] transition-colors">
                    {issue.title || "Geotagged Civic Incident"}
                  </h4>
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mt-0.5">
                    {issue.summary || issue.description}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-slate-400">
                    <MapPin className="w-3 h-3 text-[#4F46E5]" />
                    <span className="text-[10px] truncate font-medium">{issue.locationName || "Reported Sector"}</span>
                  </div>
                </div>
              </div>

              {/* Footer actions */}
              <div className="border-t border-slate-50 pt-2.5 flex items-center justify-between mt-1">
                <span className="text-[9px] font-mono font-bold text-slate-400">
                  {issue.ticketId}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onSelectIssue(issue.id)}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg cursor-pointer"
                  >
                    View Analysis
                  </button>
                  <button
                    disabled={upvoteLoadingId === issue.id}
                    onClick={() => onUpvote(issue.id)}
                    className="flex items-center gap-1.5 bg-indigo-50 hover:bg-[#4F46E5] hover:text-white px-3 py-1.5 rounded-xl text-[10px] font-bold text-[#4F46E5] transition-all cursor-pointer"
                    style={{ minHeight: "36px" }}
                  >
                    <ArrowUp className="w-3 h-3" />
                    <span>
                      {upvoteLoadingId === issue.id ? "..." : `${issue.citizenUpvotes} Upvote`}
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
