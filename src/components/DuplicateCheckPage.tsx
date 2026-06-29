import React from "react";
import { AlertCircle, Plus, ShieldCheck, ArrowRightLeft } from "lucide-react";
import { IssueReport } from "../types";
import { humanizeCategory } from "../utils/humanize";

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
    <div id="duplicate-warning-view" className="flex min-h-screen flex-col gap-5 bg-slate-50 px-4 py-6 font-sans">
      <div className="flex flex-col gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-slate-800 shadow-3xs">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600" />
          <h2 className="text-base font-black">Possible duplicate detected</h2>
        </div>
        <p className="text-base font-medium leading-relaxed text-slate-600">
          An active <strong>{humanizeCategory(candidate.category)}</strong> report was discovered just{" "}
          <strong>{distance.toFixed(0)}m</strong> away. To prevent duplicate tickets, you can combine yours into
          the existing case as a co-supporting signal.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="relative aspect-video w-full bg-slate-900">
          {candidate.image ? (
            <img
              src={candidate.image}
              alt="Active ticket"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-base font-semibold text-slate-500">
              No image preview
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-lg bg-black/60 px-2.5 py-1 text-sm font-extrabold text-white backdrop-blur-md">
            Active issue
          </span>
          <span className="absolute right-3 top-3 rounded-lg bg-emerald-500/90 px-2.5 py-1 text-sm font-extrabold text-white">
            {(similarity * 100).toFixed(0)}% similarity
          </span>
        </div>

        <div className="flex flex-col gap-2 p-4">
          <h3 className="font-mono text-sm font-bold text-slate-500">
            Ticket: {candidate.ticketId} - reported {timeAgo(candidate.timestamp)}
          </h3>
          <h4 className="text-base font-bold leading-tight text-slate-800">
            {candidate.title || "Civic incident"}
          </h4>
          <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
            {candidate.summary || candidate.description}
          </p>
        </div>
      </div>

      {reasons && reasons.length > 0 && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-3xs">
          <h3 className="flex items-center gap-1 text-sm font-extrabold text-slate-500">
            <ArrowRightLeft className="h-3.5 w-3.5 text-marigold" />
            AI comparison reasons
          </h3>
          <ul className="flex flex-col gap-2 pl-1.5 text-sm font-medium leading-relaxed text-slate-600">
            {reasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-sm text-amber-500" aria-hidden="true">
                  -
                </span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-2.5">
        <button
          type="button"
          disabled={isProcessing}
          onClick={onMerge}
          className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-marigold px-4 py-3.5 text-base font-bold text-white shadow-xs transition hover:bg-[#4338CA] disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4 flex-shrink-0" />
          <span>Add my report as evidence to this case</span>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={onCreateNew}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-bold text-slate-700 shadow-3xs transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <span>Report as a new issue</span>
        </button>

        <button
          type="button"
          disabled={isProcessing}
          onClick={onCancel}
          className="min-h-[44px] w-full rounded-xl text-center text-sm font-bold text-slate-500 transition-colors hover:bg-white hover:text-slate-700 disabled:opacity-50"
        >
          Cancel and edit report
        </button>
      </div>
    </div>
  );
}
