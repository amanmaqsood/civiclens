import React from "react";
import { Camera, CheckCircle2, TrendingUp, Users } from "lucide-react";
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
    <div id="landing-page-root" className="flex flex-col gap-5 px-4 py-5 font-sans pb-16">
      {/* Banner Card / Hero */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl relative overflow-hidden shadow-sm">
        <div className="absolute -right-12 -bottom-12 w-40 h-40 rounded-full bg-[#4F46E5] opacity-25 blur-2xl font-sans" />
        
        <div className="relative z-10 flex flex-col gap-3">
          <span className="self-start text-[9px] font-extrabold uppercase tracking-widest bg-amber-400 text-slate-950 px-2.5 py-1 rounded-full">
            🇮🇳 Digital India Civic Portal
          </span>
          <h2 className="text-xl font-extrabold tracking-tight leading-tight">
            Flag community hazards.<br />Empower resolutions.
          </h2>
          <button
            id="report-issue-btn"
            onClick={() => onNavigate("report")}
            className="mt-1 w-full flex items-center justify-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] font-bold text-white text-xs py-3 px-5 rounded-xl transition duration-200 shadow-sm active:scale-[0.98] cursor-pointer"
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
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
          Active Incident Map
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

      {/* Progress & Accountability Tracker */}
      <div className="bg-slate-100 border border-slate-200/50 p-4 rounded-2xl flex flex-col gap-3">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5 text-[#4F46E5]" />
          Live Network Stats
        </h3>

        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200/30">
            <p className="text-[9px] font-bold text-slate-400">Total Reported</p>
            <p id="stats-total-reported" className="text-sm font-black text-amber-500">{issues.length}</p>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200/30">
            <p className="text-[9px] font-bold text-slate-400">In Progress</p>
            <p id="stats-in-progress" className="text-sm font-black text-indigo-600">
              {issues.filter(i => i.status === "In Progress" || i.status === "Verified").length}
            </p>
          </div>
          <div className="p-2.5 bg-white rounded-xl border border-slate-200/30">
            <p className="text-[9px] font-bold text-slate-400">Resolved</p>
            <p id="stats-resolved" className="text-sm font-black text-emerald-600">
              {issues.filter(i => i.status === "Resolved").length}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50/80 border border-emerald-100/50 p-2.5 rounded-xl">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
          <p className="text-[10px] text-slate-700 leading-snug font-medium">
            Recent: Bengaluru road hazard resolved in 24 hrs.
          </p>
        </div>
      </div>

      {/* Footer Decoration */}
      <div className="flex items-center justify-center gap-1.5 py-1 text-center">
        <Users className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-[9px] text-slate-400 font-extrabold tracking-widest uppercase">
          Digital India Citizen Initiative
        </span>
      </div>
    </div>
  );
}
