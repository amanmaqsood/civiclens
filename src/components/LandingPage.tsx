import React from "react";
import { Camera, TrendingUp, CheckCircle2, Users } from "lucide-react";
import { ActiveView, IssueReport } from "../types";
import HomeMap from "./HomeMap";
import IssueListWithFilter from "./IssueListWithFilter";

interface LandingPageProps {
  onNavigate: (view: ActiveView) => void;
  issues: IssueReport[];
  onUpvote: (id: string) => Promise<void>;
  upvoteLoadingId: string | null;
  onSelectIssue: (id: string) => void;
}

export default function LandingPage({
  onNavigate,
  issues,
  onUpvote,
  upvoteLoadingId,
  onSelectIssue,
}: LandingPageProps) {
  return (
    <div id="landing-page-root" className="flex flex-col gap-4 px-4 py-4 font-sans pb-16">
      {/* Banner Card / Hero */}
      <div className="bg-ink text-white p-5 rounded-2xl relative overflow-hidden shadow-[0_6px_24px_-8px_rgba(14,26,43,0.3)] border border-white/5">
        <div className="absolute -right-12 -bottom-12 w-40 h-40 rounded-full bg-marigold/10 blur-2xl" />
        
        <div className="relative z-10 flex flex-col gap-3">
          <span className="self-start text-[10px] font-mono lg:text-xs font-bold uppercase tracking-widest bg-marigold text-ink px-2.5 py-0.5 rounded-full select-none">
            OFFICIAL AUDIT LEDGER
          </span>
          <h2 className="text-xl font-display font-black tracking-tight leading-tight text-white animate-fade-in">
            Flag local hazard.<br />Witness live resolution.
          </h2>
          <button
            id="report-issue-btn"
            onClick={() => onNavigate("report")}
            className="mt-1 w-full flex items-center justify-center gap-2 bg-marigold hover:bg-marigold/95 font-bold text-ink text-sm py-3 px-5 rounded-xl transition duration-150 active:scale-[0.98] cursor-pointer font-sans"
            style={{ minHeight: "44px" }}
            aria-label="Report a new civic issue"
          >
            <Camera className="w-4 h-4 flex-shrink-0" />
            Report Local Incident
          </button>
        </div>
      </div>

      {/* Google Interactive Map Section */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider px-1">
          Live map
        </h3>
        <HomeMap issues={issues} onSelectIssue={onSelectIssue} />
      </div>

      {/* Searchable, Filterable list section */}
      <IssueListWithFilter
        issues={issues}
        onSelectIssue={onSelectIssue}
        onUpvote={onUpvote}
        upvoteLoadingId={upvoteLoadingId}
      />

      {/* Progress & Live Network Stats */}
      <div className="bg-white border border-hairline p-4 rounded-2xl flex flex-col gap-3 shadow-xs">
        <h3 className="text-xs font-display font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-marigold" />
          Live Network Stats
        </h3>

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="p-2.5 bg-paper rounded-xl border border-hairline">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate">Reported</p>
            <p id="stats-total-reported" className="text-sm font-display font-black text-marigold">{issues.length}</p>
          </div>
          <div className="p-2.5 bg-paper rounded-xl border border-hairline">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate">Executing</p>
            <p id="stats-in-progress" className="text-sm font-display font-black text-[#3B82F6]">
              {issues.filter(i => i.status === "In Progress" || i.status === "Verified").length}
            </p>
          </div>
          <div className="p-2.5 bg-paper rounded-xl border border-hairline">
            <p className="text-[10px] font-mono uppercase tracking-wider text-slate">Resolved</p>
            <p id="stats-resolved" className="text-sm font-display font-black text-verify">
              {issues.filter(i => i.status === "Resolved").length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[#E9F7F5] border border-verify/10 p-2.5 rounded-xl">
          <CheckCircle2 className="w-3.5 h-3.5 text-verify flex-shrink-0" />
          <p className="text-xs text-slate leading-snug font-medium">
            Recent: Bengaluru road hazard resolved in 24 hrs.
          </p>
        </div>
      </div>

      {/* Footer Decoration */}
      <div className="flex items-center justify-center gap-1.5 py-1 text-center">
        <Users className="w-3.5 h-3.5 text-slate/50" />
        <span className="text-[10px] text-slate/60 font-mono tracking-widest uppercase">
          Digital India Citizen Initiative
        </span>
      </div>
    </div>
  );
}
