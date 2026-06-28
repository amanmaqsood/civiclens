import React from "react";
import { CheckCircle2, Copy, MapPin } from "lucide-react";
import { ActiveView, IssueReport } from "../types";
import { humanizeCategory } from "../utils/humanize";

interface SuccessPageProps {
  report: Partial<IssueReport> | null;
  onNavigate: (view: ActiveView) => void;
  isMerged?: boolean;
}

export default function SuccessPage({ report, onNavigate, isMerged }: SuccessPageProps) {
  const ticketId = React.useMemo(() => {
    if (report?.ticketId) return report.ticketId;
    const letters = "CIVIC";
    const digits = Math.floor(100000 + Math.random() * 900000);
    return `${letters}-${digits}`;
  }, [report?.ticketId]);

  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState<string | null>(null);

  const handleCopyTicket = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(ticketId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("Copy failed. Select the ticket ID manually if clipboard permission is blocked.");
    }
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-6 font-sans">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-verify/30 bg-verify/10 shadow-2xs">
          <CheckCircle2 className="h-10 w-10 animate-bounce text-verify" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-ink">
            {isMerged ? "Evidence Linked Successfully" : "Report Logged Successfully"}
          </h2>
          <p className="mt-1 text-sm font-medium text-slate">
            {isMerged
              ? "Your supporting photo and notes have been linked to speed up resolution."
              : "Saved to CivicLens. This prototype record is not filed with any government system."}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-hairline bg-paper shadow-xs">
        <div className="flex items-center justify-between border-b border-hairline bg-hairline/20 px-4 py-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-normal text-slate">
              {isMerged ? "Linked CivicLens Ticket ID" : "CivicLens Ticket ID"}
            </p>
            <p className="font-mono text-base font-bold text-marigold">{ticketId}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyTicket}
            className="flex min-h-[44px] items-center gap-1.5 rounded-md border border-hairline bg-paper px-2.5 py-1 text-sm text-ink shadow-3xs transition-all hover:border-marigold"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        {copyError && (
          <p role="alert" className="border-b border-hairline bg-alert/10 px-4 py-2 text-sm font-semibold text-alert">
            {copyError}
          </p>
        )}

        <div className="flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="font-medium text-slate">Category</p>
              <p className="mt-0.5 font-bold text-ink">{report?.category ? humanizeCategory(report.category) : "Civic Issue"}</p>
            </div>
            <div>
              <p className="font-medium text-slate">Status</p>
              <p className="mt-0.5 inline-flex items-center gap-1 font-semibold text-verify">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-verify" />
                {isMerged ? "Linked File" : "Saved"}
              </p>
            </div>
          </div>

          <div className="border-t border-hairline pt-3">
            <p className="text-sm font-medium text-slate">Location Captured</p>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-marigold" />
              <span className="truncate">{report?.locationName || "Current Location"}</span>
            </div>
          </div>

          {report?.description && (
            <div className="border-t border-hairline pt-3">
              <p className="text-sm font-medium text-slate">Supporting evidence notes</p>
              <p className="mt-1 text-sm font-medium italic leading-normal text-slate">
                "{report.description}"
              </p>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-hairline pt-3 text-sm font-medium text-slate">
            <span className="font-bold uppercase tracking-normal text-verify">
              {isMerged ? "Citizen voice linked" : "Stored in Firebase"}
            </span>
            <span>Pilot record - not a government filing</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-marigold/30 bg-marigold/10 p-4">
        <h4 className="text-sm font-bold uppercase tracking-normal text-marigold">
          {isMerged ? "How Duplication Control Assists" : "Next Verification Stage"}
        </h4>
        <p className="text-sm font-semibold leading-relaxed text-ink">
          {isMerged
            ? "By gathering additional proof on this item, you reduce duplicate review effort. Multiple reports for one issue can help prioritize prompt verification and remediation."
            : "Your report is now saved on the prototype map and review queue. No government system was contacted. Track it with this CivicLens Ticket ID."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onNavigate("landing")}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-marigold px-6 py-3.5 font-display text-base font-bold text-ink shadow-xs transition duration-200 hover:bg-opacity-90"
        >
          Return to Hub
        </button>
        <button
          type="button"
          onClick={() => onNavigate("report")}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-hairline bg-paper px-6 py-3 text-base font-semibold text-ink transition hover:bg-hairline/30"
        >
          Report Another Issue
        </button>
      </div>
    </div>
  );
}
