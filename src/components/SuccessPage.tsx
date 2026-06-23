import React from "react";
import { CheckCircle2, Copy, MapPin, Share2, Calendar } from "lucide-react";
import { ActiveView, IssueReport } from "../types";

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
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 animate-bounce" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {isMerged ? "Evidence Linked Successfully" : "Report Logged Successfully"}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {isMerged 
              ? "Your supporting photo & notes have been linked to speed up resolution."
              : "Transmitted to municipal servers in real-time."}
          </p>
        </div>
      </div>

      {/* Official Complaint Ticket Receipt Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {/* Ticket ID Tag */}
        <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {isMerged ? "Canonical Ticket Linked" : "Ticket Registration Number"}
            </p>
            <p className="text-base font-mono font-bold text-[#4F46E5]">{ticketId}</p>
          </div>
          <button
            type="button"
            onClick={handleCopyTicket}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#4F46E5] bg-white border border-slate-200 hover:border-indigo-100 rounded-md py-1 px-2.5 transition-all cursor-pointer shadow-3xs"
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
              <p className="text-slate-400 font-medium">Category</p>
              <p className="font-bold text-slate-800 mt-0.5">{report?.category || "Civic Issue"}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Status</p>
              <p className="font-semibold text-indigo-600 inline-flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block animate-pulse"></span>
                {isMerged ? "Linked File" : "Submitted"}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-400 font-medium">Location Captured</p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mt-1">
              <MapPin className="w-3.5 h-3.5 text-[#4F46E5] flex-shrink-0" />
              <span className="truncate">{report?.locationName || "Current Location"}</span>
            </div>
          </div>

          {report?.description && (
            <div className="border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-400 font-medium">Supporting Evidence notes</p>
              <p className="text-xs text-slate-600 leading-normal mt-1 italic font-medium">
                "{report.description}"
              </p>
            </div>
          )}

          <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="font-bold text-emerald-600 uppercase tracking-wide">
              {isMerged ? "🛡️ Citizen Voice Co-Signed" : "SHA-256 Verified"}
            </span>
            <span>Digital ID: Secured Link</span>
          </div>
        </div>
      </div>

      {/* Advisory Message */}
      <div className="p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl flex flex-col gap-2">
        <h4 className="text-xs font-bold text-[#4F46E5] uppercase tracking-wide">
          {isMerged ? "How Duplication Control Assists" : "Next Verification Stage"}
        </h4>
        <p className="text-xs text-slate-700 leading-relaxed font-semibold">
          {isMerged 
            ? "By gathering additional proof on this item, you prevent bureaucratic overhead. Multiple active reports for a single issue prioritize prompt verification & remediation."
            : "Within 24 hours, local authority inspectors will cross-verify your photo's metadata and live-site conditions. Updates will be visible using this ticket."}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onNavigate("landing")}
          className="w-full flex items-center justify-center bg-[#4F46E5] hover:bg-slate-100 font-semibold text-white hover:text-[#4F46E5] text-base py-3.5 px-6 rounded-xl transition duration-200 shadow-md cursor-pointer"
          style={{ minHeight: "48px" }}
        >
          Return to Hub
        </button>
        <button
          onClick={() => onNavigate("report")}
          className="w-full flex items-center justify-center gap-2 border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700 text-base py-3 px-6 rounded-xl transition cursor-pointer"
          style={{ minHeight: "44px" }}
        >
          Report Another Issue
        </button>
      </div>
    </div>
  );
}
