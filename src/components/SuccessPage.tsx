import React from "react";
import { CheckCircle2, Copy, MapPin, Share2, Calendar } from "lucide-react";
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

  const handleCopyTicket = () => {
    navigator.clipboard.writeText(ticketId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-6 font-sans">
      {/* Visual Header Success Badge */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-16 h-16 rounded-full bg-verify/10 flex items-center justify-center border border-verify/30 shadow-2xs">
          <CheckCircle2 className="w-10 h-10 text-verify animate-bounce" />
        </div>
        <div>
          <h2 className="text-xl font-bold font-display text-ink tracking-tight">
            {isMerged ? "Evidence Linked Successfully" : "Report Logged Successfully"}
          </h2>
          <p className="text-xs text-slate font-medium mt-1">
            {isMerged 
              ? "Your supporting photo & notes have been linked to speed up resolution."
              : "Saved to CivicLens. This is a prototype — it is not filed with any government system."}
          </p>
        </div>
      </div>

      {/* Official Complaint Ticket Receipt Card */}
      <div className="bg-paper border border-hairline rounded-2xl overflow-hidden shadow-xs">
        {/* Ticket ID Tag */}
        <div className="bg-hairline/20 border-b border-hairline px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate uppercase tracking-wider">
              {isMerged ? "Canonical Ticket Linked" : "Ticket Registration Number"}
            </p>
            <p className="text-base font-mono font-bold text-marigold">{ticketId}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyTicket}
            className="flex items-center gap-1.5 text-xs text-ink bg-paper border border-hairline hover:border-marigold rounded-md py-1 px-2.5 transition-all cursor-pointer shadow-3xs"
            style={{ minHeight: "36px" }}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>

        {/* Details List */}
        <div className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-slate font-medium">Category</p>
              <p className="font-bold text-ink mt-0.5">{report?.category ? humanizeCategory(report.category) : "Civic Issue"}</p>
            </div>
            <div>
              <p className="text-slate font-medium">Status</p>
              <p className="font-semibold text-verify inline-flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-verify inline-block animate-pulse"></span>
                {isMerged ? "Linked File" : "Saved"}
              </p>
            </div>
          </div>

          <div className="border-t border-hairline pt-3">
            <p className="text-xs text-slate font-medium">Location Captured</p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink mt-1">
              <MapPin className="w-3.5 h-3.5 text-marigold flex-shrink-0" />
              <span className="truncate">{report?.locationName || "Current Location"}</span>
            </div>
          </div>

          {report?.description && (
            <div className="border-t border-hairline pt-3">
              <p className="text-xs text-slate font-medium">Supporting Evidence notes</p>
              <p className="text-xs text-slate leading-normal mt-1 italic font-medium">
                "{report.description}"
              </p>
            </div>
          )}

          <div className="border-t border-hairline pt-3 flex items-center justify-between text-[11px] text-slate font-medium">
            <span className="font-bold text-verify uppercase tracking-wide">
              {isMerged ? "🛡️ Citizen Voice Co-Signed" : "Stored in Firebase"}
            </span>
            <span>Prototype · not a government filing</span>
          </div>
        </div>
      </div>

      {/* Advisory Message */}
      <div className="p-4 bg-marigold/10 border border-marigold/30 rounded-2xl flex flex-col gap-2">
        <h4 className="text-xs font-bold text-marigold uppercase tracking-wide">
          {isMerged ? "How Duplication Control Assists" : "Next Verification Stage"}
        </h4>
        <p className="text-xs text-ink leading-relaxed font-semibold">
          {isMerged 
            ? "By gathering additional proof on this item, you prevent bureaucratic overhead. Multiple active reports for a single issue prioritize prompt verification & remediation."
            : "Your report is now saved on the prototype map and review queue. No government system was contacted. Track it with this ticket."}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onNavigate("landing")}
          className="w-full flex items-center justify-center bg-marigold hover:bg-opacity-90 font-display font-bold text-ink text-base py-3.5 px-6 rounded-xl transition duration-200 shadow-xs cursor-pointer"
          style={{ minHeight: "48px" }}
        >
          Return to Hub
        </button>
        <button
          onClick={() => onNavigate("report")}
          className="w-full flex items-center justify-center gap-2 border border-hairline bg-paper font-semibold text-ink hover:bg-hairline/30 text-base py-3 px-6 rounded-xl transition cursor-pointer"
          style={{ minHeight: "44px" }}
        >
          Report Another Issue
        </button>
      </div>
    </div>
  );
}
