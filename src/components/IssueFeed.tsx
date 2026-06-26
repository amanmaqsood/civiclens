import React from "react";
import { ArrowUp, MapPin, Clock, MessageSquare } from "lucide-react";
import { IssueReport } from "../types";
import { humanizeCategory } from "../utils/humanize";
import { issueStatusLabel } from "../constants/status";

interface IssueFeedProps {
  issues: IssueReport[];
  onUpvote: (id: string) => Promise<void>;
  upvoteLoadingId: string | null;
}

export default function IssueFeed({ issues, onUpvote, upvoteLoadingId }: IssueFeedProps) {
  if (issues.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-6 text-center shadow-3xs">
        <p className="text-sm font-semibold text-slate-700">No Citizen Reports Yet</p>
        <p className="text-xs text-slate-400 mt-1">Be the first to flag a civic hazard in your sector.</p>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-indigo-50 text-indigo-700 border-indigo-100";
      case "in_progress":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "resolved":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      default:
        return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Recent Citizen Grievances
        </h3>
        <span className="text-[10px] text-slate-400 font-medium">Real-time Feed</span>
      </div>

      <div className="flex flex-col gap-3">
        {issues.map((issue) => (
          <div 
            key={issue.id} 
            className="bg-white border border-slate-100 rounded-2xl p-4 shadow-3xs flex flex-col gap-3 relative transition-all hover:border-slate-200"
          >
            {/* Upper Badge Line */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                  {humanizeCategory(issue.category)}
                </span>
                {issue.isDemoData && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-slate-500/10 text-slate-500/80">
                    DEMO
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${getStatusColor(issue.status)}`}>
                {issueStatusLabel(issue.status)}
              </span>
            </div>

            {/* Layout Split: Preview image & Details */}
            <div className="flex gap-3">
              {issue.image && (
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                  <img 
                    src={issue.image} 
                    alt={`Civic incident category: ${humanizeCategory(issue.category)}`} 
                    width={64} 
                    height={64} 
                    loading="lazy" 
                    className="w-full h-full object-cover" 
                  />
                </div>
              )}
              
              <div className="flex-1 min-w-0 pr-1">
                <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
                  {issue.description}
                </p>
                
                <div className="flex items-center gap-1 mt-1 text-slate-500">
                  <MapPin className="w-3 h-3 text-[#4F46E5] flex-shrink-0" />
                  <span className="text-[11px] truncate font-medium">{issue.locationName}</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions: Support (Upvote) Button and Ticket ID */}
            <div className="border-t border-slate-50 pt-2 flex items-center justify-between mt-1">
              <span className="text-[10px] font-mono font-bold text-slate-400">
                {issue.ticketId}
              </span>

              <button
                type="button"
                disabled={upvoteLoadingId === issue.id}
                onClick={() => onUpvote(issue.id)}
                className="flex items-center gap-1.5 bg-indigo-50/80 hover:bg-[#4F46E5] hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold text-[#4F46E5] transition-all cursor-pointer"
                style={{ minHeight: "36px" }}
                aria-label={`Support and upvote issue ${issue.ticketId}`}
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>
                  {upvoteLoadingId === issue.id ? "..." : `${issue.citizenUpvotes} ${issue.citizenUpvotes === 1 ? "Support" : "Supports"}`}
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
