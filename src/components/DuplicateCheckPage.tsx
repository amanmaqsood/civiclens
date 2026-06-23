import React from "react";
import { AlertCircle, Plus, FileSpreadsheet, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { IssueReport } from "../types";

interface DuplicateCheckPageProps {
  newReport: Partial<IssueReport>;
  candidate: IssueReport;
  distance: number;
  reasons: string[];
  similarity: number;
  onMerge: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

function timeAgo(dateString?: string): string {
  if (!dateString) return "some time ago";
  const now = Date.now();
  const past = Date.parse(dateString);
  if (isNaN(past)) return "recently";
  const diffMs = now - past;
  const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function DuplicateCheckPage({
  newReport,
  candidate,
  distance,
  reasons,
  similarity,
  onMerge,
  onCreateNew,
  onCancel,
  isProcessing,
}: DuplicateCheckPageProps) {
  return (
    <div id="duplicate-warning-view" className="flex flex-col gap-5 px-4 py-6 font-sans bg-slate-50 min-h-screen">
      {/* Upper Warning Panel */}
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex flex-col gap-2.5 shadow-3xs text-slate-800">
        <div className="flex gap-2 items-center text-amber-800">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
          <h2 className="text-sm font-black uppercase tracking-wider">Possible Duplicate Detected</h2>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed font-medium">
          An active <strong>{candidate.category}</strong> report was discovered just <strong>{distance.toFixed(0)}m</strong> away. 
          To prevent duplicate tickets, you can combine yours into the existing case as a co-supporting signal.
        </p>
      </div>

      {/* Target Active Candidate Case details */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="bg-slate-900 aspect-video w-full relative">
          {candidate.image ? (
            <img
              src={candidate.image}
              alt="Active ticket"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-semibold">No Image Preview</div>
          )}
          <span className="absolute left-3 top-3 bg-black/60 backdrop-blur-md text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
            Active issue
          </span>
          <span className="absolute right-3 top-3 bg-emerald-500/90 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full">
            {(similarity * 100).toFixed(0)}% Similarity
          </span>
        </div>

        <div className="p-4 flex flex-col gap-2">
          <h3 className="text-xs font-mono font-bold text-slate-400">
            TICKET: {candidate.ticketId} • reported {timeAgo(candidate.timestamp)}
          </h3>
          <h4 className="text-xs font-bold text-slate-800 leading-tight">
            {candidate.title || "Civic Incident"}
          </h4>
          <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            {candidate.summary || candidate.description}
          </p>
        </div>
      </div>

      {/* Rationale breakdown from Gemini AI */}
      {reasons && reasons.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-2.5 shadow-3xs">
          <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <ArrowRightLeft className="w-3.5 h-3.5 text-[#4F46E5]" />
            AI Comparison reasons
          </h3>
          <ul className="flex flex-col gap-2 pl-1.5 text-xs text-slate-600 leading-relaxed font-medium">
            {reasons.map((reason, idx) => (
              <li key={idx} className="flex gap-2 items-start">
                <span className="text-amber-500 text-xs">●</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Primary Choices */}
      <div className="flex flex-col gap-2.5 mt-2">
        <button
          type="button"
          disabled={isProcessing}
          onClick={onMerge}
          className="w-full flex items-center justify-center gap-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold py-3.5 px-4 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
          style={{ minHeight: "46px" }}
        >
          <ShieldCheck className="w-4.5 h-4.5 flex-shrink-0" />
          <span>Add my report as evidence to this case</span>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={onCreateNew}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold py-3 px-4 rounded-xl shadow-3xs transition cursor-pointer disabled:opacity-50"
          style={{ minHeight: "44px" }}
        >
          <Plus className="w-4 h-4 flex-shrink-0 text-slate-500" />
          <span>Report as a new issue</span>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={onCancel}
          className="w-full text-center text-slate-400 hover:text-slate-600 text-[11px] font-bold tracking-wider uppercase py-2 cursor-pointer transition-colors"
        >
          Cancel & Edit Report
        </button>
      </div>
    </div>
  );
}
