import React from "react";
import { AlertTriangle } from "lucide-react";

interface ReportClarificationViewProps {
  clarificationQuestion: string;
  clarificationResponse: string;
  setClarificationResponse: (val: string) => void;
  onSubmitClarification: (proceedAnyway: boolean) => void;
}

export default function ReportClarificationView({
  clarificationQuestion,
  clarificationResponse,
  setClarificationResponse,
  onSubmitClarification,
}: ReportClarificationViewProps) {
  const isResponseEmpty = !clarificationResponse.trim();

  return (
    <div className="flex flex-col gap-4.5 px-4 py-5 font-sans text-ink">
      <div className="bg-alert/5 border border-alert/20 p-4 rounded-2xl flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-alert/10 text-alert rounded-xl">
            <AlertTriangle className="w-4.5 h-4.5 text-alert" />
          </div>
          <div>
            <p className="text-[9px] font-mono text-alert uppercase tracking-wider">Verification Required</p>
            <h3 className="text-xs font-bold text-ink leading-tight">Camera ambiguity active</h3>
          </div>
        </div>
        
        <div className="p-3 bg-white border border-hairline rounded-xl mt-0.5">
          <p className="text-slate font-mono uppercase text-[8.5px] tracking-wide">Inspection Ambiguity Query</p>
          <p className="text-[11.5px] font-semibold text-ink leading-normal mt-1 font-sans">
            "{clarificationQuestion || "Verify additional attributes of the documented photograph."}"
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[9pt] font-mono text-slate uppercase tracking-wider">
          Verify Incident Answers
        </label>
        <textarea
          value={clarificationResponse}
          onChange={(e) => setClarificationResponse(e.target.value)}
          placeholder="e.g., Water is gushing from the seam of a ruptured 4-inch ductile iron piping."
          className="w-full text-xs border border-hairline bg-white p-3 rounded-xl focus:outline-none focus:border-marigold focus:ring-1 focus:ring-marigold min-h-[90px] text-ink font-sans leading-relaxed"
        />
      </div>

      <div className="flex flex-col gap-2.5 mt-1">
        <button
          type="button"
          disabled={isResponseEmpty}
          onClick={() => onSubmitClarification(false)}
          className={`w-full flex items-center justify-center gap-2 font-bold text-sm py-2.5 px-4 rounded-xl shadow-2xs transition-all border ${
            !isResponseEmpty 
              ? "bg-marigold text-ink border-hairline hover:bg-marigold/90 cursor-pointer" 
              : "bg-paper border-hairline text-slate cursor-not-allowed"
          }`}
          style={{ minHeight: "38px" }}
        >
          Confirm Verification Answers
        </button>
        
        <button
          type="button"
          onClick={() => onSubmitClarification(true)}
          className="w-full text-[10.5px] font-sans font-semibold text-slate hover:text-ink text-center py-1.5 cursor-pointer"
        >
          Proceed with best AI estimate
        </button>
      </div>
    </div>
  );
}
